use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const OPENAI_IMAGE_MODEL: &str = "openai/gpt-5.4-image-2";
const NANOBANANA_MODEL: &str = "google/gemini-3.1-flash-image-preview";
const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_SECRET_ITEM: &str = "spock-openrouter";
const OPENROUTER_SECRET_FIELD: &str = "credential";

#[derive(Serialize)]
pub struct GeneratedImage {
    data_url: String,
    model: String,
}

fn is_allowed_model(model: &str) -> bool {
    matches!(model, OPENAI_IMAGE_MODEL | NANOBANANA_MODEL)
}

fn build_openrouter_payload(prompt: &str, model: &str) -> Value {
    json!({
        "model": model,
        "modalities": ["image", "text"],
        "messages": [{ "role": "user", "content": prompt }],
    })
}

fn extract_generated_image_url(response: &Value) -> Result<String, String> {
    response["choices"][0]["message"]["images"][0]["image_url"]["url"]
        .as_str()
        .or_else(|| response["choices"][0]["message"]["images"][0]["url"].as_str())
        .filter(|url| url.starts_with("data:image/") || url.starts_with("https://"))
        .map(String::from)
        .ok_or_else(|| "OpenRouter response did not include a generated image".to_string())
}

const SPOCKLOCK_DAEMON_URL: &str = "http://localhost:9090/v1/resolve";

#[derive(Deserialize)]
struct SpocklockResolveResponse {
    value: String,
}

fn resolve_openrouter_api_key() -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("failed to create SpockLock client: {}", e))?;

    let response = client
        .post(SPOCKLOCK_DAEMON_URL)
        .json(&json!({ "item": OPENROUTER_SECRET_ITEM, "field": OPENROUTER_SECRET_FIELD }))
        .send()
        .map_err(|e| format!("SpockLock daemon unreachable: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "SpockLock daemon returned {}",
            response.status()
        ));
    }

    let body: SpocklockResolveResponse = response
        .json()
        .map_err(|e| format!("failed to parse SpockLock response: {}", e))?;

    let key = body.value.trim().to_string();
    if key.is_empty() {
        return Err("SpockLock returned an empty OpenRouter key".to_string());
    }
    Ok(key)
}

fn post_openrouter_image(prompt: &str, model: &str, api_key: &str) -> Result<Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("failed to create OpenRouter client: {}", e))?;

    let response = client
        .post(OPENROUTER_URL)
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://stacked.local")
        .header("X-Title", "StackEd")
        .json(&build_openrouter_payload(prompt, model))
        .send()
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("failed to read OpenRouter response: {}", e))?;
    if !status.is_success() {
        return Err(format!("OpenRouter request failed with status {}", status));
    }

    serde_json::from_str(&body).map_err(|e| format!("failed to parse OpenRouter response: {}", e))
}

#[tauri::command]
pub fn generate_openrouter_image(prompt: String, model: String) -> Result<GeneratedImage, String> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    if !is_allowed_model(&model) {
        return Err("Unsupported image model".to_string());
    }

    let api_key = resolve_openrouter_api_key()?;
    let response = post_openrouter_image(prompt, &model, &api_key)?;
    let data_url = extract_generated_image_url(&response)?;
    Ok(GeneratedImage { data_url, model })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_only_configured_image_models() {
        assert!(is_allowed_model("openai/gpt-5.4-image-2"));
        assert!(is_allowed_model("google/gemini-3.1-flash-image-preview"));
        assert!(!is_allowed_model("openai/gpt-4o-mini"));
    }

    #[test]
    fn test_build_openrouter_payload_requests_image_output() {
        let payload = build_openrouter_payload("Draw a rainbow", "openai/gpt-5.4-image-2");

        assert_eq!(payload["model"], "openai/gpt-5.4-image-2");
        assert_eq!(payload["modalities"], json!(["image", "text"]));
        assert_eq!(payload["messages"][0]["content"], "Draw a rainbow");
    }

    #[test]
    fn test_extracts_data_url_from_openrouter_images_field() {
        let response = json!({
            "choices": [{
                "message": {
                    "images": [{
                        "image_url": {
                            "url": "data:image/png;base64,aGVybw=="
                        }
                    }]
                }
            }]
        });

        let data_url = extract_generated_image_url(&response).unwrap();

        assert_eq!(data_url, "data:image/png;base64,aGVybw==");
    }

    #[test]
    fn test_extract_rejects_missing_image() {
        let response = json!({
            "choices": [{
                "message": {
                    "content": "No image."
                }
            }]
        });

        assert_eq!(
            extract_generated_image_url(&response).unwrap_err(),
            "OpenRouter response did not include a generated image"
        );
    }

    #[test]
    fn test_spocklock_daemon_url_is_localhost() {
        assert!(SPOCKLOCK_DAEMON_URL.starts_with("http://localhost:"));
    }
}
