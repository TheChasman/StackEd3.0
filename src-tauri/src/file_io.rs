use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static PENDING_OPEN_FILE_PATH: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize)]
pub struct ArtworkImage {
    name: String,
    path: String,
    data_url: String,
}

pub fn is_article_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".md")
}

pub fn set_pending_open_file_path(path: String) {
    if is_article_path(&path) {
        *PENDING_OPEN_FILE_PATH.lock().unwrap() = Some(path);
    }
}

fn take_pending_open_file_path() -> Option<String> {
    PENDING_OPEN_FILE_PATH.lock().unwrap().take()
}

pub fn first_markdown_arg<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter().skip(1).find(|arg| is_article_path(arg))
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    std::fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {}", path.display(), e))
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    std::fs::write(&path, contents)
        .map_err(|e| format!("failed to write {}: {}", path.display(), e))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    std::fs::remove_file(&path).map_err(|e| format!("failed to delete {}: {}", path.display(), e))
}

#[tauri::command]
pub fn list_files(path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(path);
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("failed to read directory {}: {}", path.display(), e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read entry: {}", e))?;
        if let Some(name) = entry.file_name().into_string().ok() {
            files.push(name);
        }
    }
    Ok(files)
}

fn is_supported_artwork(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "gif" | "jpeg" | "jpg" | "png" | "svg" | "webp"
            )
        })
        .unwrap_or(false)
}

fn mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("gif") => "image/gif",
        Some("jpeg") | Some("jpg") => "image/jpeg",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);

        encoded.push(TABLE[(b0 >> 2) as usize] as char);
        encoded.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        encoded.push(if chunk.len() > 1 {
            TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            TABLE[(b2 & 0b0011_1111) as usize] as char
        } else {
            '='
        });
    }

    encoded
}

fn find_artwork_dir(article_path: Option<&str>) -> Result<Option<PathBuf>, String> {
    if let Some(article_path) = article_path {
        let article_path = PathBuf::from(article_path);
        let start_dir = if article_path.is_dir() {
            article_path.as_path()
        } else {
            article_path.parent().unwrap_or_else(|| Path::new(""))
        };

        for ancestor in start_dir.ancestors() {
            let candidate = ancestor.join("_artwork").join("hero");
            if candidate.is_dir() {
                return Ok(Some(candidate));
            }
        }
    }

    let candidate = std::env::current_dir()
        .map_err(|e| format!("failed to resolve current directory: {}", e))?
        .join("_artwork")
        .join("hero");

    Ok(candidate.is_dir().then_some(candidate))
}

#[tauri::command]
pub fn list_artwork_images(article_path: Option<String>) -> Result<Vec<ArtworkImage>, String> {
    let Some(artwork_dir) = find_artwork_dir(article_path.as_deref())? else {
        return Ok(Vec::new());
    };

    let entries = std::fs::read_dir(&artwork_dir)
        .map_err(|e| format!("failed to read directory {}: {}", artwork_dir.display(), e))?;

    let mut images = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read entry: {}", e))?;
        let path = entry.path();
        if !path.is_file() || !is_supported_artwork(&path) {
            continue;
        }

        let bytes = std::fs::read(&path)
            .map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        images.push(ArtworkImage {
            name,
            path: path.display().to_string(),
            data_url: format!("data:{};base64,{}", mime_type(&path), base64_encode(&bytes)),
        });
    }

    images.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(images)
}

#[tauri::command]
pub fn create_dir_recursive(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("failed to create directory {}: {}", path.display(), e))
}

fn article_folder_paths(path: &Path) -> Result<(PathBuf, PathBuf, String), String> {
    let title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| format!("failed to derive article title for {}", path.display()))?
        .to_string();
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let parent_name = parent
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let article_folder = if parent_name == title {
        parent.to_path_buf()
    } else {
        parent.join(&title)
    };
    Ok((
        article_folder.join(format!("{}.md", title)),
        article_folder.join("artwork"),
        title,
    ))
}

#[tauri::command]
pub fn organize_pipeline_article(
    file_path: String,
    pipeline_folder_path: String,
) -> Result<String, String> {
    if pipeline_folder_path.trim().is_empty() {
        return Ok(file_path);
    }

    let path = PathBuf::from(&file_path);
    if !is_article_path(&file_path) || !path.is_file() {
        return Ok(file_path);
    }

    let pipeline = std::fs::canonicalize(PathBuf::from(&pipeline_folder_path)).map_err(|e| {
        format!(
            "failed to resolve pipeline folder {}: {}",
            pipeline_folder_path, e
        )
    })?;
    let source = std::fs::canonicalize(&path)
        .map_err(|e| format!("failed to resolve article file {}: {}", path.display(), e))?;

    if !source.starts_with(&pipeline) {
        return Ok(file_path);
    }

    let (destination, artwork_path, _) = article_folder_paths(&source)?;
    if source != destination {
        if destination.exists() {
            return Err(format!(
                "refusing to overwrite existing file {}",
                destination.display()
            ));
        }
        if let Some(parent) = destination.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create directory {}: {}", parent.display(), e))?;
        }
        std::fs::rename(&source, &destination).map_err(|e| {
            format!(
                "failed to move {} to {}: {}",
                source.display(),
                destination.display(),
                e
            )
        })?;
    }

    std::fs::create_dir_all(&artwork_path).map_err(|e| {
        format!(
            "failed to create directory {}: {}",
            artwork_path.display(),
            e
        )
    })?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn initial_file_path() -> Option<String> {
    first_markdown_arg(std::env::args()).or_else(take_pending_open_file_path)
}

#[tauri::command]
pub fn read_markdown_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(file_path);
    ensure_single_backup(&path)?;
    std::fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {}", path.display(), e))
}

#[tauri::command]
pub fn write_markdown_file(file_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create directory {}: {}",
                parent.display(),
                e
            )
        })?;
    }
    std::fs::write(&path, content).map_err(|e| format!("failed to write {}: {}", path.display(), e))
}

fn backup_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("failed to derive backup name for {}", path.display()))?;
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let mut backup_name = file_name.to_os_string();
    backup_name.push(".bak");
    Ok(parent.join(".stacked-backups").join(backup_name))
}

fn ensure_single_backup(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.is_file() {
        return Ok(None);
    }

    let backup_path = backup_path_for(path)?;
    if backup_path.exists() {
        return Ok(None);
    }

    if let Some(parent) = backup_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!(
                "failed to create backup directory {}: {}",
                parent.display(),
                e
            )
        })?;
    }

    std::fs::copy(path, &backup_path)
        .map_err(|e| format!("failed to create backup {}: {}", backup_path.display(), e))?;
    Ok(Some(backup_path))
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

        assert_eq!(
            path,
            Some("/vault/Articles/Net Zero/Net Zero.md".to_string())
        );
    }

    #[test]
    fn test_first_markdown_arg_ignores_non_markdown_extensions() {
        let path = first_markdown_arg([
            "stacked".to_string(),
            "--some-tauri-flag".to_string(),
            "/vault/Articles/Checkmate/Checkmate.txt".to_string(),
        ]);

        assert_eq!(path, None);
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

    #[test]
    fn test_is_article_path_accepts_only_md() {
        assert!(is_article_path("article.md"));
        assert!(is_article_path("ARTICLE.MD"));
        assert!(!is_article_path("article.txt"));
    }

    #[test]
    fn test_base64_encode() {
        assert_eq!(base64_encode(b"StackEd"), "U3RhY2tFZA==");
    }

    #[test]
    fn test_is_supported_artwork() {
        assert!(is_supported_artwork(Path::new("hero.PNG")));
        assert!(is_supported_artwork(Path::new("hero.webp")));
        assert!(!is_supported_artwork(Path::new("notes.txt")));
    }

    #[test]
    fn test_find_artwork_dir_walks_up_from_article_path() {
        let root = std::env::temp_dir().join(format!(
            "stacked-artwork-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let article_dir = root.join("Checkmate");
        let artwork_dir = root.join("_artwork").join("hero");
        std::fs::create_dir_all(&article_dir).unwrap();
        std::fs::create_dir_all(&artwork_dir).unwrap();

        let article_path = article_dir.join("Checkmate.md");
        let found = find_artwork_dir(Some(article_path.to_str().unwrap())).unwrap();

        assert_eq!(found, Some(artwork_dir));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_read_markdown_file_creates_single_backup() {
        let root = std::env::temp_dir().join(format!(
            "stacked-backup-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();

        let article_path = root.join("Article.md");
        std::fs::write(&article_path, "original").unwrap();

        let content = read_markdown_file(article_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(content, "original");

        let backup_path = root.join(".stacked-backups").join("Article.md.bak");
        assert_eq!(std::fs::read_to_string(&backup_path).unwrap(), "original");

        std::fs::write(&article_path, "changed").unwrap();
        let content = read_markdown_file(article_path.to_string_lossy().to_string()).unwrap();
        assert_eq!(content, "changed");
        assert_eq!(std::fs::read_to_string(&backup_path).unwrap(), "original");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_write_markdown_file_creates_parent_directory() {
        let root = std::env::temp_dir().join(format!(
            "stacked-write-parent-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let article_path = root.join("Article").join("Article.md");

        write_markdown_file(
            article_path.to_string_lossy().to_string(),
            "saved article".to_string(),
        )
        .unwrap();

        assert_eq!(std::fs::read_to_string(&article_path).unwrap(), "saved article");

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_organize_pipeline_article_moves_flat_file_and_creates_artwork() {
        let root = std::env::temp_dir().join(format!(
            "stacked-pipeline-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let article_path = root.join("Checkmate.md");
        std::fs::write(&article_path, "article").unwrap();

        let final_path = organize_pipeline_article(
            article_path.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
        )
        .unwrap();
        let expected_path = root.join("Checkmate").join("Checkmate.md");

        assert_eq!(
            final_path,
            std::fs::canonicalize(&expected_path)
                .unwrap()
                .to_string_lossy()
                .to_string()
        );
        assert!(!article_path.exists());
        assert_eq!(std::fs::read_to_string(&expected_path).unwrap(), "article");
        assert!(root.join("Checkmate").join("artwork").is_dir());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_organize_pipeline_article_keeps_structured_file_and_creates_artwork() {
        let root = std::env::temp_dir().join(format!(
            "stacked-pipeline-structured-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let article_dir = root.join("Checkmate");
        std::fs::create_dir_all(&article_dir).unwrap();
        let article_path = article_dir.join("Checkmate.md");
        std::fs::write(&article_path, "article").unwrap();

        let final_path = organize_pipeline_article(
            article_path.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
        )
        .unwrap();

        assert_eq!(
            final_path,
            std::fs::canonicalize(&article_path)
                .unwrap()
                .to_string_lossy()
                .to_string()
        );
        assert_eq!(std::fs::read_to_string(&article_path).unwrap(), "article");
        assert!(article_dir.join("artwork").is_dir());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_organize_pipeline_article_ignores_files_outside_pipeline() {
        let root = std::env::temp_dir().join(format!(
            "stacked-pipeline-outside-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let pipeline = root.join("pipeline");
        let outside = root.join("outside");
        std::fs::create_dir_all(&pipeline).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        let article_path = outside.join("Checkmate.md");
        std::fs::write(&article_path, "article").unwrap();

        let final_path = organize_pipeline_article(
            article_path.to_string_lossy().to_string(),
            pipeline.to_string_lossy().to_string(),
        )
        .unwrap();

        assert_eq!(final_path, article_path.to_string_lossy().to_string());
        assert!(article_path.exists());
        assert!(!outside.join("Checkmate").exists());

        std::fs::remove_dir_all(root).unwrap();
    }
}
