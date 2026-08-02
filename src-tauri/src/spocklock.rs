//! Secret resolution via the local SpockLock daemon.
//!
//! Doctrine: secrets live in process memory only, never on disk. We resolve a
//! credential the instant it's needed, hold it in a local variable for the one
//! HTTP call, and drop it. The daemon is loopback-only (localhost:9090); we
//! never expose vault resolution beyond this process.

use serde::Deserialize;
use serde_json::json;
use std::time::Duration;

const DAEMON_URL: &str = "http://localhost:9090/v1/resolve";

#[derive(Deserialize)]
struct ResolveResponse {
    value: String,
}

/// Resolve `item`/`field` from the SpockLock daemon, returning the secret value.
/// Errors are human-readable and never contain the secret.
pub async fn resolve(item: &str, field: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("failed to create SpockLock client: {}", e))?;

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

    #[test]
    fn daemon_url_is_loopback_only() {
        assert!(DAEMON_URL.starts_with("http://localhost:"));
    }
}
