use std::path::PathBuf;

pub fn first_markdown_arg<I>(args: I) -> Option<String>
where
  I: IntoIterator<Item = String>,
{
  args.into_iter()
    .skip(1)
    .find(|arg| arg.ends_with(".md"))
}

#[tauri::command]
pub fn initial_file_path() -> Option<String> {
  first_markdown_arg(std::env::args())
}

#[tauri::command]
pub fn read_markdown_file(file_path: String) -> Result<String, String> {
  let path = PathBuf::from(file_path);
  std::fs::read_to_string(&path)
    .map_err(|e| format!("failed to read {}: {}", path.display(), e))
}

#[tauri::command]
pub fn write_markdown_file(file_path: String, content: String) -> Result<(), String> {
  let path = PathBuf::from(file_path);
  std::fs::write(&path, content)
    .map_err(|e| format!("failed to write {}: {}", path.display(), e))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_first_markdown_arg_returns_passed_article_path() {
    let path = first_markdown_arg([
      "stacked".to_string(),
      "--some-tauri-flag".to_string(),
      "/vault/Articles/Net Zero/Net Zero.md".to_string(),
    ]);

    assert_eq!(path, Some("/vault/Articles/Net Zero/Net Zero.md".to_string()));
  }

  #[test]
  fn test_first_markdown_arg_ignores_non_markdown_args() {
    let path = first_markdown_arg([
      "stacked".to_string(),
      "--dev".to_string(),
      "not-an-article".to_string(),
    ]);

    assert_eq!(path, None);
  }
}
