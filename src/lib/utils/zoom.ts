import { getCurrentWebview } from '@tauri-apps/api/webview';

let currentZoom = 1.0;

export async function getZoom(): Promise<number> {
  return currentZoom;
}

export async function setZoom(factor: number): Promise<void> {
  const clamped = Math.max(0.5, Math.min(3.0, factor));
  currentZoom = clamped;
  await getCurrentWebview().setZoom(clamped);
}

export async function zoomIn(): Promise<number> {
  const newZoom = Math.min(currentZoom * 1.1, 3.0);
  await setZoom(newZoom);
  return newZoom;
}

export async function zoomOut(): Promise<number> {
  const newZoom = Math.max(currentZoom / 1.1, 0.5);
  await setZoom(newZoom);
  return newZoom;
}

export async function resetZoom(): Promise<void> {
  await setZoom(1.0);
}

export function setupZoomShortcuts(): void {
  document.addEventListener('keydown', async (e) => {
    if (e.key === '+' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      await zoomIn();
    } else if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      await zoomOut();
    } else if ((e.key === '0' || e.key === ')') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      await resetZoom();
    }
  });
}
