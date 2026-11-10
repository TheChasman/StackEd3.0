//! Fixed-purpose Substack window commands: the only scripts that may run in
//! the `substack-auth` window are the bundled bridge and a navigate-to-
//! publication URL built from a validated slug. Replaces the arbitrary
//! `eval_in_webview` command.
use tauri::Manager;

pub const SUBSTACK_LABEL: &str = "substack-auth";

const BRIDGE_SCRIPT: &str = include_str!("substack_bridge.js");

/// `^[a-z0-9][a-z0-9-]{0,62}$`, without the regex crate.
pub fn validate_publication(publication: &str) -> Result<(), String> {
    let bytes = publication.as_bytes();
    let ok = (1..=63).contains(&bytes.len())
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-')
        && bytes[0] != b'-';
    if ok {
        Ok(())
    } else {
        Err("invalid publication slug".to_string())
    }
}

pub fn navigate_script(publication: &str) -> Result<String, String> {
    validate_publication(publication)?;
    Ok(format!(
        "window.location.href = \"https://{publication}.substack.com\";"
    ))
}

fn substack_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(SUBSTACK_LABEL)
        .ok_or_else(|| format!("Webview '{}' not found", SUBSTACK_LABEL))
}

#[tauri::command]
pub fn substack_inject_bridge(app: tauri::AppHandle) -> Result<(), String> {
    substack_window(&app)?
        .eval(BRIDGE_SCRIPT)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn substack_navigate(app: tauri::AppHandle, publication: String) -> Result<(), String> {
    let script = navigate_script(&publication)?;
    substack_window(&app)?
        .eval(&script)
        .map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_bad_publication_slug() {
        for bad in ["x.evil.com/", "a'b", "", &"a".repeat(64)] {
            assert!(
                validate_publication(bad).is_err(),
                "expected {bad:?} to be rejected"
            );
        }
    }

    #[test]
    fn accepts_normal_slug() {
        assert!(validate_publication("chasnewport").is_ok());
        assert!(validate_publication("a").is_ok());
        assert!(validate_publication(&"a".repeat(63)).is_ok());
    }

    #[test]
    fn navigate_script_is_exact() {
        assert_eq!(
            navigate_script("chasnewport").unwrap(),
            "window.location.href = \"https://chasnewport.substack.com\";"
        );
        assert!(navigate_script("x.evil.com/").is_err());
    }

    #[test]
    fn bridge_script_is_the_former_injected_script() {
        assert!(BRIDGE_SCRIPT.contains("substack:request"));
        assert!(BRIDGE_SCRIPT.contains("substack:response"));
        assert!(BRIDGE_SCRIPT.contains("__substackInjected"));
    }
}
