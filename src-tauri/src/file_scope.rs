//! Path confinement for every file IPC command: only safe paths under the
//! user's home directory, with per-operation extension allowlists.
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    ReadText,
    ReadImage,
    Write,
    WriteImage,
    Delete,
    Dir,
}

pub fn check(path: &str, access: Access) -> Result<PathBuf, String> {
    let home =
        std::env::var("HOME").map_err(|_| "path not allowed: HOME is not set".to_string())?;
    check_in(Path::new(&home), path, access)
}

fn err(reason: &str) -> Result<PathBuf, String> {
    Err(format!("path not allowed: {reason}"))
}

fn allowed_extension(path: &Path, access: Access) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    match access {
        Access::Dir => true,
        Access::ReadText => matches!(ext.as_deref(), Some("md" | "json" | "txt")),
        Access::ReadImage | Access::WriteImage => {
            matches!(
                ext.as_deref(),
                Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "svg")
            )
        }
        Access::Write | Access::Delete => matches!(ext.as_deref(), Some("md" | "json")),
    }
}

/// Resolve `path` against symlinks and `..` by canonicalising the nearest
/// existing ancestor and re-appending the remainder, so paths that do not
/// exist yet (new article folders) can still be checked.
fn resolve(path: &Path) -> Result<PathBuf, String> {
    let mut ancestor = path;
    let mut remainder: Vec<&std::ffi::OsStr> = Vec::new();
    loop {
        if ancestor.exists() {
            break;
        }
        match ancestor.file_name() {
            Some(name) => {
                remainder.push(name);
                ancestor = ancestor
                    .parent()
                    .ok_or_else(|| "path not allowed: no existing ancestor".to_string())?;
            }
            None => return err("no existing ancestor"),
        }
    }
    let mut resolved = std::fs::canonicalize(ancestor).map_err(|e| {
        format!(
            "path not allowed: cannot resolve {}: {e}",
            ancestor.display()
        )
    })?;
    for part in remainder.iter().rev() {
        resolved.push(part);
    }
    Ok(resolved)
}

pub fn check_in(home: &Path, path: &str, access: Access) -> Result<PathBuf, String> {
    let path = Path::new(path);
    if !path.is_absolute() {
        return err("path must be absolute");
    }
    let home = std::fs::canonicalize(home)
        .map_err(|e| format!("path not allowed: cannot resolve home: {e}"))?;
    let resolved = resolve(path)?;
    let relative = match resolved.strip_prefix(&home) {
        Ok(rel) => rel,
        Err(_) => return err("path is outside the home directory"),
    };
    for component in relative.components() {
        let name = component.as_os_str().to_string_lossy();
        if name.starts_with('.') {
            return err("hidden paths are not allowed");
        }
    }
    if relative
        .components()
        .next()
        .map(|c| c.as_os_str() == "Library")
        .unwrap_or(false)
    {
        return err("paths under ~/Library are not allowed");
    }
    if !allowed_extension(&resolved, access) {
        return err("extension not allowed for this operation");
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempHome(PathBuf);

    impl TempHome {
        fn new() -> Self {
            let id = COUNTER.fetch_add(1, Ordering::SeqCst);
            let root = std::env::temp_dir().join(format!(
                "stacked-file-scope-test-{}-{}",
                std::process::id(),
                id
            ));
            std::fs::create_dir_all(&root).unwrap();
            // Canonicalise: macOS temp dirs sit behind symlinks.
            TempHome(std::fs::canonicalize(root).unwrap())
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempHome {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn err_of(result: Result<PathBuf, String>) -> String {
        result.expect_err("expected path to be refused")
    }

    #[test]
    fn allows_markdown_under_home() {
        let home = TempHome::new();
        let file = home.path().join("notes.md");
        std::fs::write(&file, "hi").unwrap();
        let checked = check_in(home.path(), file.to_str().unwrap(), Access::ReadText).unwrap();
        assert_eq!(checked, file);
    }

    #[test]
    fn allows_new_article_folder_under_home() {
        let home = TempHome::new();
        let dir = home.path().join("A").join("B");
        let file = dir.join("c.md");
        assert!(check_in(home.path(), dir.to_str().unwrap(), Access::Dir).is_ok());
        assert_eq!(
            check_in(home.path(), file.to_str().unwrap(), Access::Write).unwrap(),
            file
        );
    }

    #[test]
    fn rejects_outside_home() {
        let home = TempHome::new();
        let err = err_of(check_in(home.path(), "/etc/hosts", Access::ReadText));
        assert!(err.starts_with("path not allowed: "), "{err}");
    }

    #[test]
    fn rejects_dot_components_and_library() {
        let home = TempHome::new();
        for p in [
            home.path().join(".ssh").join("id_ed25519"),
            home.path().join(".zshrc"),
            home.path()
                .join("Library")
                .join("LaunchAgents")
                .join("x.plist"),
        ] {
            let err = err_of(check_in(home.path(), p.to_str().unwrap(), Access::ReadText));
            assert!(err.starts_with("path not allowed: "), "{err}");
        }
    }

    #[test]
    fn rejects_traversal_and_symlink_escape() {
        let home = TempHome::new();
        let notes = home.path().join("notes");
        std::fs::create_dir_all(&notes).unwrap();

        let traversal = home.path().join("notes").join("..").join(".zshrc");
        let err = err_of(check_in(
            home.path(),
            traversal.to_str().unwrap(),
            Access::Write,
        ));
        assert!(err.starts_with("path not allowed: "), "{err}");

        let ssh = home.path().join(".ssh");
        std::fs::create_dir_all(&ssh).unwrap();
        std::os::unix::fs::symlink(&ssh, home.path().join("link")).unwrap();
        let via_link = home.path().join("link").join("x.md");
        let err = err_of(check_in(
            home.path(),
            via_link.to_str().unwrap(),
            Access::Write,
        ));
        assert!(err.starts_with("path not allowed: "), "{err}");
    }

    #[test]
    fn rejects_wrong_extension() {
        let home = TempHome::new();
        for (name, access) in [
            ("run.sh", Access::Write),
            ("job.plist", Access::Write),
            ("key.pem", Access::ReadText),
            ("hero.png", Access::Write),
            ("notes.txt", Access::Delete),
        ] {
            let p = home.path().join(name);
            let err = err_of(check_in(home.path(), p.to_str().unwrap(), access));
            assert!(err.starts_with("path not allowed: "), "{err}");
        }
        // Allowed counterparts pass.
        assert!(check_in(
            home.path(),
            home.path().join("hero.png").to_str().unwrap(),
            Access::WriteImage
        )
        .is_ok());
        assert!(check_in(
            home.path(),
            home.path().join("hero.png").to_str().unwrap(),
            Access::ReadImage
        )
        .is_ok());
    }

    #[test]
    fn rejects_relative_path() {
        let home = TempHome::new();
        let err = err_of(check_in(home.path(), "notes/notes.md", Access::ReadText));
        assert!(err.starts_with("path not allowed: "), "{err}");
    }
}
