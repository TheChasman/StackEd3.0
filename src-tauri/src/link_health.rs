use serde::Serialize;
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

async fn check_with_timeout(raw: String, timeout: Duration) -> LinkCheckResult {
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
    let client = match reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            if attempt.previous().len() > 5 {
                attempt.error("Too many redirects")
            } else if !["http", "https"].contains(&url.scheme())
                || !url.username().is_empty()
                || url.password().is_some()
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
            let result = tauri::async_runtime::block_on(check_with_timeout(
                format!("{}/{path}", server.base),
                Duration::from_secs(2),
            ));
            assert_eq!(result.status, expected, "{path}: {}", result.reason);
        }
    }
    #[test]
    fn timeout_is_unverified_not_dead() {
        let server = Server::new();
        let result = tauri::async_runtime::block_on(check_with_timeout(
            format!("{}/slow", server.base),
            Duration::from_millis(30),
        ));
        assert_eq!(result.status, LinkStatus::Unknown);
    }
    #[test]
    fn refuses_unsafe_schemes_and_handles_non_http_links() {
        for (url, expected) in [
            ("not a URL", LinkStatus::Dead),
            ("javascript:alert(1)", LinkStatus::Dead),
            ("file:///etc/passwd", LinkStatus::Dead),
            ("mailto:hello@example.com", LinkStatus::Unknown),
            ("https://user:secret@example.com", LinkStatus::Unknown),
        ] {
            let result = tauri::async_runtime::block_on(check_with_timeout(
                url.into(),
                Duration::from_secs(1),
            ));
            assert_eq!(result.status, expected, "{url}");
        }
    }
}
