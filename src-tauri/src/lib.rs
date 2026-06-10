mod file_io;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

#[cfg(desktop)]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::default(app)?;

    let new_item = MenuItem::with_id(app, "file-new", "New…", true, Some("CmdOrCtrl+N"))?;
    let new_tab_item = MenuItem::with_id(app, "file-new-tab", "New Tab", true, Some("CmdOrCtrl+T"))?;
    let open_item = MenuItem::with_id(app, "file-open", "Open…", true, Some("CmdOrCtrl+O"))?;
    let save_item = MenuItem::with_id(app, "file-save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_as_item = MenuItem::with_id(
        app,
        "file-save-as",
        "Save As…",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;

    let file_menu = Submenu::with_id_and_items(
        app,
        "file",
        "File",
        true,
        &[
            &new_item,
            &new_tab_item,
            &open_item,
            &PredefinedMenuItem::separator(app)?,
            &save_item,
            &save_as_item,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        menu.remove_at(1)?;
        menu.insert(&file_menu, 1)?;
    }

    #[cfg(not(target_os = "macos"))]
    menu.prepend(&file_menu)?;

    Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Forward the file path from the second instance to this one
            if let Some(path) = file_io::first_markdown_arg(argv.into_iter()) {
                let _ = app.emit("stacked:open-file", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(desktop)]
            {
                let menu = build_menu(app.handle())?;
                app.handle().set_menu(menu)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_name = match event.id().as_ref() {
                "file-new" => Some("stacked:menu-new"),
                "file-new-tab" => Some("stacked:menu-new"),
                "file-open" => Some("stacked:menu-open"),
                "file-save" => Some("stacked:menu-save"),
                "file-save-as" => Some("stacked:menu-save-as"),
                _ => None,
            };

            if let Some(event_name) = event_name {
                let _ = app.emit(event_name, ());
            }
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
            file_io::organize_pipeline_article,
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
