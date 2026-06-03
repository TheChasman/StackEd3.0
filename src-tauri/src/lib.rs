mod file_io;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      file_io::create_dir_recursive,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
