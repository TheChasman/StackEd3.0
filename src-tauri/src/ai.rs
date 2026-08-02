//! Text AI (SEO + research) via xAI's Grok, keyed from SpockLock.
//!
//! Doctrine: the credential is resolved from the SpockLock daemon at call time
//! and used only for the outbound request from this Rust process. It never
//! crosses into the WebView and is never written to disk. The prompt is built
//! on the frontend (it needs scaffold/context); we only add the key and shape.

use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

const XAI_URL: &str = "https://api.x.ai/v1/chat/completions";
const XAI_SECRET_ITEM: &str = "xai-api-key";
const XAI_SECRET_FIELD: &str = "credential";
const XAI_MODEL: &str = "grok-4-fast";

#[derive(Serialize)]
pub struct ResearchResult {
    summary: String,
    citations: Vec<String>,
}

/// Pull the assistant text out of an OpenAI-compatible chat completion.
fn extract_message_content(response: &Value) -> Result<String, String> {
    response["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "xAI response did not include any text content".to_string())
}

/// xAI Live Search returns a top-level `citations` array of URL strings.
fn extract_citations(response: &Value) -> Vec<String> {
    response["citations"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|c| c.as_str()).map(String::from).collect())
        .unwrap_or_default()
}

async fn post_xai(body: &Value, api_key: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("failed to create xAI client: {}", e))?;

    let response = client
        .post(XAI_URL)
        .bearer_auth(api_key)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("xAI request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("failed to read xAI response: {}", e))?;
    if !status.is_success() {
        return Err(format!("xAI {} — {}", status, text.trim()));
    }
    serde_json::from_str(&text).map_err(|e| format!("failed to parse xAI response: {}", e))
}

/// Generate SEO metadata JSON. Returns the raw model text; the frontend parses
/// and validates it (parseSeoDraftJson).
#[tauri::command]
pub async fn generate_seo_text(prompt: String) -> Result<String, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    let api_key = crate::spocklock::resolve(XAI_SECRET_ITEM, XAI_SECRET_FIELD).await?;
    let body = json!({
        "model": XAI_MODEL,
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": { "type": "json_object" },
    });
    let response = post_xai(&body, &api_key).await?;
    extract_message_content(&response)
}

/// Run a web-grounded research query via Grok Live Search.
#[tauri::command]
pub async fn research_web(prompt: String) -> Result<ResearchResult, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    let api_key = crate::spocklock::resolve(XAI_SECRET_ITEM, XAI_SECRET_FIELD).await?;
    let body = json!({
        "model": XAI_MODEL,
        "messages": [{ "role": "user", "content": prompt }],
        "search_parameters": { "mode": "auto", "return_citations": true },
    });
    let response = post_xai(&body, &api_key).await?;
    let summary = extract_message_content(&response)?;
    let citations = extract_citations(&response);
    Ok(ResearchResult { summary, citations })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_message_content() {
        let response = json!({
            "choices": [{ "message": { "content": "  hello world  " } }]
        });
        assert_eq!(extract_message_content(&response).unwrap(), "hello world");
    }

    #[test]
    fn errors_on_missing_content() {
        let response = json!({ "choices": [{ "message": {} }] });
        assert!(extract_message_content(&response).is_err());
    }

    #[test]
    fn extracts_citations_when_present() {
        let response = json!({
            "citations": ["https://a.example", "https://b.example"],
            "choices": [{ "message": { "content": "x" } }]
        });
        assert_eq!(
            extract_citations(&response),
            vec!["https://a.example".to_string(), "https://b.example".to_string()]
        );
    }

    #[test]
    fn citations_default_to_empty() {
        let response = json!({ "choices": [{ "message": { "content": "x" } }] });
        assert!(extract_citations(&response).is_empty());
    }
}
