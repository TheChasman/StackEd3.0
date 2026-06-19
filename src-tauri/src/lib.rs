mod file_io;
mod image_generation;

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::menu::IsMenuItem;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

const MAX_RECENTS: usize = 20;
const RECENT_MENU_EVENT_PREFIX: &str = "file-open-recent-";

#[derive(Default)]
struct RecentMenuState(Mutex<HashMap<String, String>>);

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentMenuEntry {
    title: String,
    file_path: String,
}

#[cfg(desktop)]
fn build_menu(
    app: &tauri::AppHandle,
    recent_entries: &[RecentMenuEntry],
) -> tauri::Result<Menu<tauri::Wry>> {
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
    let mut open_recent_items = Vec::new();
    if recent_entries.is_empty() {
        open_recent_items.push(MenuItem::with_id(
            app,
            "file-open-recent-empty",
            "No Recent Files",
            false,
            None::<&str>,
        )?);
    } else {
        for (index, entry) in recent_entries.iter().take(MAX_RECENTS).enumerate() {
            open_recent_items.push(MenuItem::with_id(
                app,
                format!("{RECENT_MENU_EVENT_PREFIX}{index}"),
                &entry.title,
                true,
                None::<&str>,
            )?);
        }
    }
    let open_recent_refs: Vec<&dyn IsMenuItem<tauri::Wry>> = open_recent_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<tauri::Wry>)
        .collect();
    let open_recent_menu = Submenu::with_id_and_items(
        app,
        "file-open-recent",
        "Open Recent",
        true,
        &open_recent_refs,
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
            &open_recent_menu,
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

#[tauri::command]
#[cfg(desktop)]
fn set_recent_files_menu(
    app: tauri::AppHandle,
    state: tauri::State<'_, RecentMenuState>,
    entries: Vec<RecentMenuEntry>,
) -> Result<(), String> {
    let recent_entries: Vec<RecentMenuEntry> = entries.into_iter().take(MAX_RECENTS).collect();
    {
        let mut map = state.0.lock().map_err(|_| "failed to lock recent menu state")?;
        map.clear();
        for (index, entry) in recent_entries.iter().enumerate() {
            map.insert(
                format!("{RECENT_MENU_EVENT_PREFIX}{index}"),
                entry.file_path.clone(),
            );
        }
    }

    let menu = build_menu(&app, &recent_entries).map_err(|e| e.to_string())?;
    app.set_menu(menu)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[cfg(not(desktop))]
fn set_recent_files_menu(_entries: Vec<RecentMenuEntry>) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = file_io::first_markdown_arg(argv.into_iter()) {
                let _ = app.emit("stacked:open-file", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    let app = builder
        .manage(RecentMenuState::default())
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
                let menu = build_menu(app.handle(), &[])?;
                app.handle().set_menu(menu)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_id = event.id().as_ref();
            let event_name = match event_id {
                "file-new" => Some("stacked:menu-new"),
                "file-new-tab" => Some("stacked:menu-new-tab"),
                "file-open" => Some("stacked:menu-open"),
                "file-save" => Some("stacked:menu-save"),
                "file-save-as" => Some("stacked:menu-save-as"),
                _ => None,
            };

            if let Some(event_name) = event_name {
                let _ = app.emit(event_name, ());
                return;
            }

            if event_id.starts_with(RECENT_MENU_EVENT_PREFIX) {
                let recent_path = {
                    let state = app.state::<RecentMenuState>();
                    state
                        .0
                        .lock()
                        .ok()
                        .and_then(|map| map.get(event_id).cloned())
                };
                if let Some(file_path) = recent_path {
                    let _ = app.emit("stacked:menu-open-recent", file_path);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            file_io::initial_file_path,
            file_io::read_markdown_file,
            file_io::write_markdown_file,
            file_io::read_file,
            file_io::file_exists,
            file_io::write_file,
            file_io::delete_file,
            file_io::list_files,
            file_io::list_artwork_images,
            file_io::save_generated_image_to_artwork,
            file_io::read_image_data_url,
            file_io::create_dir_recursive,
            file_io::organize_pipeline_article,
            image_generation::generate_openrouter_image,
            set_recent_files_menu,
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
