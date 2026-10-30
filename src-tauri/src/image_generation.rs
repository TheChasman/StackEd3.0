use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::Emitter;

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

async fn resolve_openrouter_api_key() -> Result<String, String> {
    crate::spocklock::resolve(OPENROUTER_SECRET_ITEM, OPENROUTER_SECRET_FIELD).await
}

async fn post_openrouter_image(prompt: &str, model: &str, api_key: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("failed to create OpenRouter client: {}", e))?;

    let response = client
        .post(OPENROUTER_URL)
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://stacked.local")
        .header("X-Title", "StackEd")
        .json(&build_openrouter_payload(prompt, model))
        .send()
        .await
        .map_err(|e| format!("OpenRouter request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("failed to read OpenRouter response: {}", e))?;
    if !status.is_success() {
        return Err(format!("OpenRouter {} — {}", status, body.trim()));
    }

    serde_json::from_str(&body).map_err(|e| format!("failed to parse OpenRouter response: {}", e))
}

#[tauri::command]
pub async fn generate_openrouter_image(
    app: tauri::AppHandle,
    prompt: String,
    model: String,
) -> Result<GeneratedImage, String> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Prompt required".to_string());
    }
    if !is_allowed_model(&model) {
        return Err("Unsupported image model".to_string());
    }

    let _ = app.emit("image-gen:status", "Resolving API key…");
    let api_key = resolve_openrouter_api_key().await?;

    let _ = app.emit("image-gen:status", "Sending to OpenRouter…");
    let response = post_openrouter_image(&prompt, &model, &api_key).await?;

    let _ = app.emit("image-gen:status", "Processing response…");
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
}
