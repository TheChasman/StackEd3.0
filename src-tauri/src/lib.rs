mod file_io;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      file_io::initial_file_path,
      file_io::read_markdown_file,
      file_io::write_markdown_file,
      file_io::read_file,
      file_io::write_file,
      file_io::delete_file,
      file_io::list_files,
      file_io::list_artwork_images,
      file_io::create_dir_recursive,
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
    if let tauri::RunEvent::Opened { urls } = event {
      for url in urls {
        let Ok(path) = url.to_file_path() else {
          continue;
        };
        let path = path.to_string_lossy().to_string();
        if file_io::is_article_path(&path) {
          file_io::set_pending_open_file_path(path.clone());
          let _ = app_handle.emit("stacked:open-file", path);
          break;
        }
      }
    }
  });
}
