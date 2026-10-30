//! Text AI (SEO + research) via Grok through OpenRouter, keyed from SpockLock.
//!
//! Doctrine: the credential is resolved from the SpockLock daemon at call time
//! and used only for the outbound request from this Rust process. It never
//! crosses into the WebView and is never written to disk. The prompt is built
//! on the frontend (it needs scaffold/context); we only add the key and shape.

use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const SECRET_ITEM: &str = "spock-openrouter";
const SECRET_FIELD: &str = "credential";
const MODEL: &str = "x-ai/grok-4.3";

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
        .ok_or_else(|| "AI response did not include any text content".to_string())
}

/// If the provider returns a top-level `citations` array, extract it.
fn extract_citations(response: &Value) -> Vec<String> {
    response["citations"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|c| c.as_str())
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

async fn post_openrouter(body: &Value, api_key: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("failed to create OpenRouter client: {}", e))?;

    let response = client
        .post(OPENROUTER_URL)
        .bearer_auth(api_key)
        .json(body)
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("failed to read OpenRouter response: {}", e))?;
    if !status.is_success() {
        return Err(format!("OpenRouter {} — {}", status, text.trim()));
    }
    serde_json::from_str(&text).map_err(|e| format!("failed to parse OpenRouter response: {}", e))
}

/// Generate SEO metadata JSON. Returns the raw model text; the frontend parses
/// and validates it (parseSeoDraftJson).
#[tauri::command]
pub async fn generate_seo_text(prompt: String) -> Result<String, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    let api_key = crate::spocklock::resolve(SECRET_ITEM, SECRET_FIELD).await?;
    let body = json!({
        "model": MODEL,
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": { "type": "json_object" },
    });
    let response = post_openrouter(&body, &api_key).await?;
    extract_message_content(&response)
}

/// Run a research query via Grok through OpenRouter.
#[tauri::command]
pub async fn research_web(prompt: String) -> Result<ResearchResult, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    let api_key = crate::spocklock::resolve(SECRET_ITEM, SECRET_FIELD).await?;
    let body = json!({
        "model": MODEL,
        "messages": [{ "role": "user", "content": prompt }],
    });
    let response = post_openrouter(&body, &api_key).await?;
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
            vec![
                "https://a.example".to_string(),
                "https://b.example".to_string()
            ]
        );
    }

    #[test]
    fn citations_default_to_empty() {
        let response = json!({ "choices": [{ "message": { "content": "x" } }] });
        assert!(extract_citations(&response).is_empty());
    }
}
