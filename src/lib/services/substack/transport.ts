// Substack transport interface.
// The desktop implementation uses a Tauri WebView with injected JS that
// calls Substack's private API from the site's own origin (same-origin
// fetch attaches the session cookie automatically, even if httpOnly).
//
// Safety rails (matched to TOS clauses):
// - Human confirmation on every write (enforced by the publisher, not here)
// - Foreground and logged-in only
// - No read/scrape endpoints beyond the user's own drafts
// - Fail loudly on 403/429/captcha

export interface SubstackResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface ImageUploadResult {
  id: number;
  url: string;
  contentType: string;
  bytes: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Transport interface for sending requests to Substack's private API.
 * Desktop: implemented via Tauri WebView with injected fetch.
 * Future (Android/PWA): could be implemented via a browser fetch or a
 * Kotlin plugin that reads CookieManager.
 */
export interface SubstackTransport {
  /** POST /api/v1/image with a base64 data URL. Returns upload metadata. */
  uploadImage(dataUrl: string): Promise<ImageUploadResult>;

  /** POST /api/v1/drafts — create a new draft. Returns { id: number, ... }. */
  createDraft(body: unknown): Promise<SubstackResponse>;

  /** PUT /api/v1/drafts/{id} — update an existing draft. */
  updateDraft(draftId: number, body: unknown): Promise<SubstackResponse>;

  /** PUT /api/v1/drafts/{id}/publish — publish immediately. Irreversible. */
  publishDraft(draftId: number, body: unknown): Promise<SubstackResponse>;

  /** POST /api/v1/drafts/{id}/scheduled_release — schedule for future. */
  scheduleDraft(draftId: number, body: unknown): Promise<SubstackResponse>;

  /** DELETE /api/v1/drafts/{id}/scheduled_release — cancel schedule. */
  unscheduleDraft(draftId: number): Promise<SubstackResponse>;

  /** POST /api/v1/comment/feed — create a Note. */
  createNote(body: unknown): Promise<SubstackResponse>;

  /** Check whether the user is logged in (session cookie present). */
  isLoggedIn(): Promise<boolean>;
}

/**
 * Error thrown when Substack returns a non-OK response.
 * The publisher surfaces these to the user rather than retrying.
 */
export class SubstackApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Substack API error: ${status}`);
    this.status = status;
    this.body = body;
    this.name = 'SubstackApiError';
  }
}
