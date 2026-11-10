use serde::Serialize;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::sync::Arc;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LinkStatus {
    Working,
    Dead,
    Unknown,
}

#[derive(Clone, Debug, Serialize)]
pub struct LinkCheckResult {
    pub status: LinkStatus,
    pub reason: String,
}

fn result(status: LinkStatus, reason: impl Into<String>) -> LinkCheckResult {
    LinkCheckResult {
        status,
        reason: reason.into(),
    }
}

#[tauri::command]
pub async fn check_link(url: String) -> LinkCheckResult {
    check_with_timeout(url, Duration::from_secs(10)).await
}

fn is_blocked_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_multicast()
                // CGNAT 100.64.0.0/10
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0b1100_0000) == 0b0100_0000)
        }
        std::net::IpAddr::V6(v6) => {
            if v6.is_loopback() || v6.is_unspecified() {
                return true;
            }
            if let Some(v4) = v6.to_ipv4() {
                return is_blocked_ip(IpAddr::V4(v4));
            }
            let seg0 = v6.segments()[0];
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                // unique local fc00::/7
                || (seg0 & 0xfe00) == 0xfc00
                // link-local fe80::/10
                || (seg0 & 0xffc0) == 0xfe80
        }
    }
}

// `url::Host` is not a direct dependency. Its display representation brackets
// IPv6 literals, so remove those brackets before parsing the address.
fn host_parts(url: &reqwest::Url) -> Option<(String, Option<IpAddr>)> {
    let host = url.host()?.to_string();
    let unbracketed = host
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(&host);
    Some((unbracketed.to_string(), unbracketed.parse().ok()))
}

/// Synchronous redirect check; domains are checked by the resolver on connect.
fn host_is_blocked_sync(url: &reqwest::Url) -> bool {
    match host_parts(url) {
        None => true,
        Some((host, ip)) => host.eq_ignore_ascii_case("localhost") || ip.is_some_and(is_blocked_ip),
    }
}

fn filter_addrs(addrs: Vec<SocketAddr>, allow_private: bool) -> std::io::Result<Vec<SocketAddr>> {
    if addrs.is_empty() || (!allow_private && addrs.iter().any(|addr| is_blocked_ip(addr.ip()))) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "Blocked or empty DNS result",
        ));
    }
    Ok(addrs)
}

struct FilteringResolver {
    allow_private: bool,
}

impl reqwest::dns::Resolve for FilteringResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name.as_str().to_owned();
        let allow_private = self.allow_private;
        Box::pin(async move {
            let addrs = tauri::async_runtime::spawn_blocking(move || {
                (host.as_str(), 0)
                    .to_socket_addrs()
                    .map(|addrs| addrs.collect())
            })
            .await??;
            let addrs = filter_addrs(addrs, allow_private)?;
            Ok(Box::new(addrs.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

/// Full initial check; resolution errors fail closed.
async fn host_is_private(url: &reqwest::Url) -> bool {
    let Some((host, ip)) = host_parts(url) else {
        return true;
    };
    if let Some(ip) = ip {
        return is_blocked_ip(ip);
    }
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }
    let port = url.port_or_known_default().unwrap_or(80);
    let resolved = tauri::async_runtime::spawn_blocking(move || {
        (host.as_str(), port)
            .to_socket_addrs()
            .map(|addrs| addrs.collect())
    })
    .await;
    match resolved {
        Ok(Ok(addrs)) => filter_addrs(addrs, false).is_err(),
        _ => true,
    }
}
async fn check_with_timeout(raw: String, timeout: Duration) -> LinkCheckResult {
    check_inner(raw, timeout, false).await
}

/// Test-only entry point: the fixture server listens on 127.0.0.1, which the
/// private-address gate must refuse in production.
#[cfg(test)]
async fn check_with_timeout_allowing_private(raw: String, timeout: Duration) -> LinkCheckResult {
    check_inner(raw, timeout, true).await
}

async fn check_inner(raw: String, timeout: Duration, allow_private: bool) -> LinkCheckResult {
    let url = match reqwest::Url::parse(&raw) {
        Ok(url) => url,
        Err(_) => return result(LinkStatus::Dead, "Invalid URL"),
    };
    if ["javascript", "data", "file", "vbscript"].contains(&url.scheme()) {
        return result(LinkStatus::Dead, "Unsafe URL scheme");
    }
    if !["http", "https"].contains(&url.scheme()) {
        return result(
            LinkStatus::Unknown,
            "Only HTTP and HTTPS destinations can be checked",
        );
    }
    if !url.username().is_empty() || url.password().is_some() {
        return result(
            LinkStatus::Unknown,
            "URLs containing credentials cannot be checked",
        );
    }
    if !allow_private && host_is_private(&url).await {
        return result(
            LinkStatus::Unknown,
            "Private or local addresses are not checked",
        );
    }
    let client = match reqwest::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(FilteringResolver { allow_private }))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            let url = attempt.url();
            if attempt.previous().len() > 5 {
                attempt.error("Too many redirects")
            } else if !["http", "https"].contains(&url.scheme())
                || !url.username().is_empty()
                || url.password().is_some()
                || (!allow_private && host_is_blocked_sync(url))
            {
                attempt.error("Unsupported redirect destination")
            } else {
                attempt.follow()
            }
        }))
        .user_agent("StackEd/3 LinkChecker")
        .build()
    {
        Ok(client) => client,
        Err(_) => return result(LinkStatus::Unknown, "Could not initialise link checker"),
    };
    let started = Instant::now();
    // Do not read response bodies: only final response headers establish reachability.
    // GET fallback handles hosts which reject HEAD, including misleading HEAD 404s.
    let head = client.head(url.clone()).timeout(timeout).send().await;
    if let Ok(response) = &head {
        if response.status().is_success() {
            return result(
                LinkStatus::Working,
                format!("HTTP {}", response.status().as_u16()),
            );
        }
    }
    let remaining = timeout.saturating_sub(started.elapsed());
    if remaining.is_zero() {
        return result(LinkStatus::Unknown, "Link check timed out");
    }
    let response = client
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .timeout(remaining)
        .send()
        .await;
    match response {
        Ok(response) => {
            let status = response.status();
            let reason = format!("HTTP {}", status.as_u16());
            if status.is_success() {
                result(LinkStatus::Working, reason)
            } else if status.as_u16() == 404 || status.as_u16() == 410 {
                result(LinkStatus::Dead, reason)
            } else {
                result(LinkStatus::Unknown, format!("Could not verify: {reason}"))
            }
        }
        Err(error) => result(
            LinkStatus::Unknown,
            if error.is_timeout() {
                "Link check timed out"
            } else {
                "Could not reach destination (network, TLS or redirect error)"
            },
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::thread;
    use std::time::Duration;

    struct Server {
        base: String,
        stop: Arc<AtomicBool>,
        worker: Option<thread::JoinHandle<()>>,
    }
    impl Server {
        fn new() -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let base = format!("http://{}", listener.local_addr().unwrap());
            listener.set_nonblocking(true).unwrap();
            let stop = Arc::new(AtomicBool::new(false));
            let signal = stop.clone();
            let worker = thread::spawn(move || {
                while !signal.load(Ordering::Relaxed) {
                    let Ok((mut stream, _)) = listener.accept() else {
                        thread::sleep(Duration::from_millis(2));
                        continue;
                    };
                    // macOS can inherit the listener's nonblocking flag on accept.
                    stream.set_nonblocking(false).unwrap();
                    stream
                        .set_read_timeout(Some(Duration::from_secs(1)))
                        .unwrap();
                    let mut request_bytes = Vec::new();
                    let mut buf = [0; 2048];
                    while !request_bytes.ends_with(b"\r\n\r\n") {
                        match stream.read(&mut buf) {
                            Ok(0) | Err(_) => break,
                            Ok(n) => request_bytes.extend_from_slice(&buf[..n]),
                        }
                    }
                    if !request_bytes.ends_with(b"\r\n\r\n") {
                        continue;
                    }
                    let request = String::from_utf8_lossy(&request_bytes);
                    let parts: Vec<_> = request.split_whitespace().collect();
                    let method = parts.first().copied().unwrap_or("");
                    let path = parts.get(1).copied().unwrap_or("");
                    let credential_location = format!(
                        "Location: http://user:secret@{}/ok\r\n",
                        listener.local_addr().unwrap()
                    );
                    let (code, extra) = match path {
                        "/credential-redirect" => (302, credential_location.as_str()),
                        "/redirect" => (302, "Location: /ok\r\n"),
                        "/loop" => (302, "Location: /loop\r\n"),
                        "/fallback" if method == "HEAD" => (405, ""),
                        "/notfound" => (404, ""),
                        "/gone" => (410, ""),
                        "/blocked" => (403, ""),
                        "/limited" => (429, ""),
                        "/server" => (500, ""),
                        "/slow" => {
                            thread::sleep(Duration::from_millis(150));
                            (200, "")
                        }
                        _ => (200, ""),
                    };
                    let response = format!("HTTP/1.1 {code} Test\r\n{extra}Content-Length: 0\r\nConnection: close\r\n\r\n");
                    let _ = stream.write_all(response.as_bytes());
                }
            });
            Self {
                base,
                stop,
                worker: Some(worker),
            }
        }
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::Relaxed);
            self.worker.take().unwrap().join().unwrap();
        }
    }

    #[test]
    fn fixture_waits_for_complete_request_headers() {
        let server = Server::new();
        let mut stream = TcpStream::connect(server.base.trim_start_matches("http://")).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_millis(50)))
            .unwrap();
        stream.write_all(b"HEAD /ok HTTP/1.1\r\n").unwrap();
        let mut byte = [0];
        assert!(
            stream.read(&mut byte).is_err(),
            "fixture replied to an incomplete request"
        );
        stream.write_all(b"Host: localhost\r\n\r\n").unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(1)))
            .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        assert!(response.starts_with("HTTP/1.1 200"));
    }

    #[test]
    fn checks_final_status_and_falls_back_to_get() {
        let server = Server::new();
        for (path, expected) in [
            ("ok", LinkStatus::Working),
            ("redirect", LinkStatus::Working),
            ("credential-redirect", LinkStatus::Unknown),
            ("fallback", LinkStatus::Working),
            ("notfound", LinkStatus::Dead),
            ("gone", LinkStatus::Dead),
            ("blocked", LinkStatus::Unknown),
            ("limited", LinkStatus::Unknown),
            ("server", LinkStatus::Unknown),
            ("loop", LinkStatus::Unknown),
        ] {
            let result = tauri::async_runtime::block_on(check_with_timeout_allowing_private(
                format!("{}/{path}", server.base),
                Duration::from_secs(2),
            ));
            assert_eq!(result.status, expected, "{path}: {}", result.reason);
        }
    }
    #[test]
    fn timeout_is_unverified_not_dead() {
        let server = Server::new();
        let result = tauri::async_runtime::block_on(check_with_timeout_allowing_private(
            format!("{}/slow", server.base),
            Duration::from_millis(30),
        ));
        assert_eq!(result.status, LinkStatus::Unknown);
    }
    #[test]
    fn blocks_private_ranges() {
        use std::net::IpAddr;
        for blocked in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "fe80::1",
            "fc00::1",
            "0.0.0.0",
            "224.0.0.1",
        ] {
            assert!(
                is_blocked_ip(blocked.parse::<IpAddr>().unwrap()),
                "{blocked} should be blocked"
            );
        }
        for allowed in ["1.1.1.1", "2606:4700::1111"] {
            assert!(
                !is_blocked_ip(allowed.parse::<IpAddr>().unwrap()),
                "{allowed} should be allowed"
            );
        }
    }

    #[test]
    fn blocks_ipv6_literals_before_request_and_on_redirect() {
        for raw in [
            "http://[::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://[::ffff:a9fe:a9fe]/",
        ] {
            let url = reqwest::Url::parse(raw).unwrap();
            let result = tauri::async_runtime::block_on(check_with_timeout(
                raw.into(),
                Duration::from_millis(100),
            ));
            assert_eq!(
                result.reason, "Private or local addresses are not checked",
                "{raw}"
            );
            assert!(host_is_blocked_sync(&url), "redirect: {raw}");
        }
    }

    #[test]
    fn blocks_ipv4_embedded_ipv6_addresses() {
        for raw in [
            "::ffff:127.0.0.1",
            "::ffff:169.254.169.254",
            "::127.0.0.1",
            "::169.254.169.254",
        ] {
            assert!(is_blocked_ip(raw.parse().unwrap()), "{raw}");
        }
        for raw in ["::ffff:1.1.1.1", "::1.1.1.1"] {
            assert!(!is_blocked_ip(raw.parse().unwrap()), "{raw}");
        }
    }

    #[test]
    fn resolver_rejects_any_private_address_and_preserves_public_addresses() {
        let public = vec![
            "1.1.1.1:0".parse().unwrap(),
            "[2606:4700::1111]:0".parse().unwrap(),
        ];
        let mut mixed = public.clone();
        mixed.push("127.0.0.1:0".parse().unwrap());
        assert_eq!(filter_addrs(public.clone(), false).unwrap(), public);
        assert!(filter_addrs(mixed.clone(), false).is_err());
        assert_eq!(filter_addrs(mixed.clone(), true).unwrap(), mixed);
        assert!(filter_addrs(Vec::new(), false).is_err());
    }

    #[test]
    fn resolver_blocks_localhost() {
        use reqwest::dns::Resolve;
        let name = "localhost".parse().unwrap();
        let resolved = tauri::async_runtime::block_on(
            FilteringResolver {
                allow_private: false,
            }
            .resolve(name),
        );
        assert!(resolved.is_err());
    }

    #[test]
    fn check_link_on_localhost_returns_unknown() {
        let result = tauri::async_runtime::block_on(check_with_timeout(
            "http://localhost:1/".into(),
            Duration::from_secs(1),
        ));
        assert_eq!(result.status, LinkStatus::Unknown);
        assert_eq!(result.reason, "Private or local addresses are not checked");
    }
    #[test]
    fn refuses_unsafe_schemes_and_handles_non_http_links() {
        // Built at runtime so the fixture file holds no credential-shaped URI.
        let credential_url = format!("https://user:{}@example.com", "x".repeat(6));
        for (url, expected) in [
            ("not a URL", LinkStatus::Dead),
            ("javascript:alert(1)", LinkStatus::Dead),
            ("file:///etc/passwd", LinkStatus::Dead),
            ("mailto:hello@example.com", LinkStatus::Unknown),
            (credential_url.as_str(), LinkStatus::Unknown),
        ] {
            let result = tauri::async_runtime::block_on(check_with_timeout(
                url.into(),
                Duration::from_secs(1),
            ));
            assert_eq!(result.status, expected, "{url}");
        }
    }
}
