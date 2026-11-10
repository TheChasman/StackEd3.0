//! Secret resolution via the local SpockLock daemon.
//!
//! Doctrine: secrets live in process memory only, never on disk. We resolve a
//! credential the instant it's needed, hold it in a local variable for the one
//! HTTP call, and drop it. The daemon is loopback-only (localhost:9090); we
//! never expose vault resolution beyond this process.

use serde::Deserialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::time::Duration;

const DAEMON_URL: &str = "https://localhost:9090/v1/resolve";
pub const CLIENT_CERT_NAME: &str = "stacked3";

/// Cert directory: `STACKED_SPOCKLOCK_CERT_DIR`, else `SPOCKLOCK_CERT_DIR`,
/// else the daemon's platform default.
pub fn cert_dir_from(env: impl Fn(&str) -> Option<String>, home: &Path) -> PathBuf {
    if let Some(dir) = env("STACKED_SPOCKLOCK_CERT_DIR") {
        return PathBuf::from(dir);
    }
    if let Some(dir) = env("SPOCKLOCK_CERT_DIR") {
        return PathBuf::from(dir);
    }
    #[cfg(target_os = "macos")]
    {
        home.join("Library")
            .join("Application Support")
            .join("spocklock")
            .join("certs")
    }
    #[cfg(not(target_os = "macos"))]
    {
        home.join(".config").join("spocklock").join("certs")
    }
}

fn cert_dir() -> PathBuf {
    let home = std::env::var("HOME").map(PathBuf::from).unwrap_or_default();
    cert_dir_from(|key| std::env::var(key).ok(), &home)
}

/// mTLS client: trusts only the SpockLock CA and presents the `stacked3`
/// client identity. Missing files produce an actionable error; there is no
/// plaintext fallback.
pub fn build_client(cert_dir: &Path) -> Result<reqwest::Client, String> {
    let missing = || {
        format!(
            "SpockLock client certificate not found in {}; ask Chas to run: spocklock-daemon cert-generate client --name {}",
            cert_dir.display(),
            CLIENT_CERT_NAME
        )
    };
    let read = |name: &str| std::fs::read(cert_dir.join(name)).map_err(|_| missing());

    let ca_pem = read("ca.pem")?;
    let mut identity_pem = read(&format!("{CLIENT_CERT_NAME}.pem"))?;
    identity_pem.extend_from_slice(&read(&format!("{CLIENT_CERT_NAME}-key.pem"))?);

    let ca_cert = reqwest::Certificate::from_pem(&ca_pem)
        .map_err(|e| format!("invalid SpockLock CA certificate: {e}"))?;
    let identity = reqwest::Identity::from_pem(&identity_pem)
        .map_err(|e| format!("invalid SpockLock client certificate: {e}"))?;

    reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .tls_built_in_root_certs(false)
        .add_root_certificate(ca_cert)
        .identity(identity)
        .build()
        .map_err(|e| format!("failed to create SpockLock client: {e}"))
}

#[derive(Deserialize)]
struct ResolveResponse {
    value: String,
}

/// Resolve `item`/`field` from the SpockLock daemon, returning the secret value.
/// Errors are human-readable and never contain the secret.
pub async fn resolve(item: &str, field: &str) -> Result<String, String> {
    let client = build_client(&cert_dir())?;

    let response = client
        .post(DAEMON_URL)
        .json(&json!({ "item": item, "field": field }))
        .send()
        .await
        .map_err(|e| format!("SpockLock daemon unreachable: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "SpockLock could not resolve '{}' (daemon returned {})",
            item,
            response.status()
        ));
    }

    let body: ResolveResponse = response
        .json()
        .await
        .map_err(|e| format!("failed to parse SpockLock response: {}", e))?;

    let value = body.value.trim().to_string();
    if value.is_empty() {
        return Err(format!("SpockLock returned an empty value for '{}'", item));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_dir(tag: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "stacked-spocklock-{tag}-{}-{id}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn daemon_url_is_https_loopback() {
        assert!(DAEMON_URL.starts_with("https://localhost:"));
    }

    #[test]
    fn cert_dir_precedence() {
        let home = Path::new("/home/test");
        let none = |_key: &str| None;
        let stacked_only =
            |key: &str| (key == "STACKED_SPOCKLOCK_CERT_DIR").then(|| "/stacked".to_string());
        let both = |key: &str| match key {
            "STACKED_SPOCKLOCK_CERT_DIR" => Some("/stacked".to_string()),
            "SPOCKLOCK_CERT_DIR" => Some("/spocklock".to_string()),
            _ => None,
        };
        let spocklock_only =
            |key: &str| (key == "SPOCKLOCK_CERT_DIR").then(|| "/spocklock".to_string());

        assert_eq!(cert_dir_from(both, home), PathBuf::from("/stacked"));
        assert_eq!(cert_dir_from(stacked_only, home), PathBuf::from("/stacked"));
        assert_eq!(
            cert_dir_from(spocklock_only, home),
            PathBuf::from("/spocklock")
        );
        #[cfg(target_os = "macos")]
        assert_eq!(
            cert_dir_from(none, home),
            home.join("Library")
                .join("Application Support")
                .join("spocklock")
                .join("certs")
        );
        #[cfg(not(target_os = "macos"))]
        assert_eq!(
            cert_dir_from(none, home),
            home.join(".config").join("spocklock").join("certs")
        );
    }

    #[test]
    fn missing_client_cert_gives_actionable_error() {
        let dir = temp_dir("empty");
        let err = build_client(&dir).unwrap_err();
        assert!(
            err.contains("cert-generate client --name stacked3"),
            "{err}"
        );
        assert!(err.contains(&dir.display().to_string()), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn builds_client_with_throwaway_certs() {
        if std::process::Command::new("openssl")
            .arg("version")
            .output()
            .is_err()
        {
            eprintln!("skipping: openssl not available");
            return;
        }
        let dir = temp_dir("certs");
        let run = |args: &[&str]| {
            let status = std::process::Command::new("openssl")
                .args(args)
                .current_dir(&dir)
                .output()
                .unwrap();
            assert!(status.status.success(), "openssl {args:?} failed");
        };
        run(&[
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            "ca-key.pem",
            "-out",
            "ca.pem",
            "-days",
            "1",
            "-nodes",
            "-subj",
            "/CN=stacked-test-ca",
        ]);
        run(&[
            "req",
            "-newkey",
            "rsa:2048",
            "-keyout",
            "stacked3-key.pem",
            "-out",
            "stacked3.csr",
            "-nodes",
            "-subj",
            "/CN=stacked3",
        ]);
        run(&[
            "x509",
            "-req",
            "-in",
            "stacked3.csr",
            "-CA",
            "ca.pem",
            "-CAkey",
            "ca-key.pem",
            "-CAcreateserial",
            "-out",
            "stacked3.pem",
            "-days",
            "1",
        ]);

        build_client(&dir).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
