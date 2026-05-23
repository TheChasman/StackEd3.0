use std::sync::Mutex;

lazy_static::lazy_static! {
  static ref ZOOM_LEVEL: Mutex<f64> = Mutex::new(1.0);
}

#[tauri::command]
pub fn set_zoom(factor: f64) -> Result<(), String> {
  let clamped = factor.max(0.5).min(3.0);
  let mut zoom = ZOOM_LEVEL.lock().map_err(|e| e.to_string())?;
  *zoom = clamped;
  Ok(())
}

#[tauri::command]
pub fn get_zoom() -> Result<f64, String> {
  let zoom = ZOOM_LEVEL.lock().map_err(|e| e.to_string())?;
  Ok(*zoom)
}

#[tauri::command]
pub fn zoom_in() -> Result<f64, String> {
  let mut zoom = ZOOM_LEVEL.lock().map_err(|e| e.to_string())?;
  *zoom = (*zoom * 1.1).min(3.0);
  Ok(*zoom)
}

#[tauri::command]
pub fn zoom_out() -> Result<f64, String> {
  let mut zoom = ZOOM_LEVEL.lock().map_err(|e| e.to_string())?;
  *zoom = (*zoom / 1.1).max(0.5);
  Ok(*zoom)
}

#[tauri::command]
pub fn reset_zoom() -> Result<(), String> {
  let mut zoom = ZOOM_LEVEL.lock().map_err(|e| e.to_string())?;
  *zoom = 1.0;
  Ok(())
}
