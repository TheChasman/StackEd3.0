// Tauri WebView transport for Substack's private API.
//
// Creates a WebviewWindow at the user's publication URL. The WebView holds
// the session cookie after the user logs in once. Injected JS makes
// same-origin fetch() calls to /api/v1/* — the cookie is attached
// automatically, even if httpOnly.
//
// Communication flow:
// 1. Main app emits `substack:request` with { id, method, url, body }
// 2. Injected JS in WebView makes the fetch call
// 3. JS emits `substack:response` with { id, ok, status, body }
// 4. Main app resolves the promise matching the id

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';

const WINDOW_LABEL = 'substack-auth';
const REQUEST_EVENT = 'substack:request';
const RESPONSE_EVENT = 'substack:response';

interface PendingRequest {
  resolve: (response: SubstackResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * The script injected into the Substack WebView. It listens for
 * `substack:request` events, makes same-origin fetch calls, and
 * emits `substack:response` events with the results.
 */
const INJECTED_SCRIPT = `
(function() {
  const { listen, emit } = window.__TAURI__.event;
  listen('${REQUEST_EVENT}', async (event) => {
    const { id, method, url, body } = event.payload;
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== null && body !== undefined) {
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      const resp = await fetch(url, opts);
      const text = await resp.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      emit('${RESPONSE_EVENT}', {
        id,
        ok: resp.ok,
        status: resp.status,
        body: parsed,
      });
    } catch (err) {
      emit('${RESPONSE_EVENT}', {
        id,
        ok: false,
        status: 0,
        body: { error: String(err) },
      });
    }
  });
})();
`;

export class WebViewTransport implements SubstackTransport {
  private publication: string;
  private window: WebviewWindow | null = null;
  private pending = new Map<string, PendingRequest>();
  private unlisten: (() => void) | null = null;
  private initialized = false;

  constructor(publication: string) {
    this.publication = publication;
  }

  /**
   * Initialize the WebView window and inject the listener script.
   * Creates a visible window the first time so the user can log in.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Listen for responses from the injected script
    this.unlisten = await listen<{ id: string; ok: boolean; status: number; body: unknown }>(
      RESPONSE_EVENT,
      (event) => {
        const { id, ok, status, body } = event.payload;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        pending.resolve({ ok, status, body });
      },
    );

    // Create or reuse the WebView window
    const existing = await WebviewWindow.getByLabel(WINDOW_LABEL);
    if (existing) {
      this.window = existing;
    } else {
      const url = `https://${this.publication}.substack.com`;
      this.window = new WebviewWindow(WINDOW_LABEL, {
        url,
        title: 'Substack Login',
        width: 900,
        height: 700,
        visible: true,
      });
      // Wait for the window to load
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (this.window) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    // Inject the listener script once the page is ready
    await this.injectScript();

    this.initialized = true;
  }

  private async injectScript(): Promise<void> {
    if (!this.window) return;
    // Small delay to ensure the page is loaded enough for __TAURI__ to be available
    await new Promise((r) => setTimeout(r, 500));
    // Use the Rust-side eval command since the Tauri 2 JS API doesn't expose eval()
    await invoke('eval_in_webview', { label: WINDOW_LABEL, script: INJECTED_SCRIPT });
  }

  /**
   * Send a request to the Substack API via the WebView.
   */
  private async send(method: string, url: string, body?: unknown): Promise<SubstackResponse> {
    await this.init();

    const id = crypto.randomUUID();
    const response = new Promise<SubstackResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Substack API request timed out: ${method} ${url}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timeout });
    });

    await emit(REQUEST_EVENT, { id, method, url, body: body ?? null });
    return response;
  }

  async uploadImage(dataUrl: string): Promise<ImageUploadResult> {
    const response = await this.send(
      'POST',
      `/api/v1/image`,
      { image: dataUrl },
    );
    if (!response.ok) {
      throw new Error(`Image upload failed: ${response.status}`);
    }
    return response.body as ImageUploadResult;
  }

  async createDraft(body: unknown): Promise<SubstackResponse> {
    return this.send('POST', '/api/v1/drafts', body);
  }

  async updateDraft(draftId: number, body: unknown): Promise<SubstackResponse> {
    return this.send('PUT', `/api/v1/drafts/${draftId}`, body);
  }

  async publishDraft(draftId: number, body: unknown): Promise<SubstackResponse> {
    return this.send('PUT', `/api/v1/drafts/${draftId}/publish`, body);
  }

  async scheduleDraft(draftId: number, body: unknown): Promise<SubstackResponse> {
    return this.send('POST', `/api/v1/drafts/${draftId}/scheduled_release`, body);
  }

  async unscheduleDraft(draftId: number): Promise<SubstackResponse> {
    return this.send('DELETE', `/api/v1/drafts/${draftId}/scheduled_release`);
  }

  async createNote(body: unknown): Promise<SubstackResponse> {
    // Notes go to the account host (substack.com), not the publication host
    return this.send('POST', '/api/v1/comment/feed', body);
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.init();
      // Check by trying a lightweight endpoint
      const response = await this.send('GET', '/api/v1/user/profile/self');
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Clean up: close the window and stop listening. */
  async destroy(): Promise<void> {
    this.unlisten?.();
    this.unlisten = null;
    const win = await WebviewWindow.getByLabel(WINDOW_LABEL);
    if (win) await win.close();
    this.window = null;
    this.initialized = false;
  }
}
