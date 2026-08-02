// Publishing orchestrator — ties together image upload, draft creation,
// and scheduling. Uses the SubstackTransport interface so the actual
// network calls can be swapped (WebView, browser, etc.).
//
// Flow:
// 1. Scan draft_body for foreign image URLs
// 2. Upload each via transport.uploadImage()
// 3. Rewrite image2 attrs with returned URL/dimensions/bytes
// 4. POST /api/v1/drafts to create the draft
// 5. If trigger_at is set: POST /api/v1/drafts/{id}/scheduled_release
// 6. If send=true and no trigger_at: PUT /api/v1/drafts/{id}/publish
//
// The caller (UI) must confirm with the user before calling publish().

import type { Scaffold, PMDoc } from '$lib/types/scaffold';
import { isPostPayload, isNotePayload, withBody } from '$lib/types/scaffold';
import type { SubstackTransport, ImageUploadResult, SubstackResponse } from './transport';
import { SubstackApiError } from './transport';
import {
  buildCreateDraftRequest,
  buildUpdateDraftRequest,
  buildPublishRequest,
  buildScheduleRequest,
  buildCreateNoteRequest,
  findForeignImages,
  rewriteImageAttrs,
} from './payloadBuilder';

export interface PublishResult {
  draftId: number | null;
  scheduled: boolean;
  published: boolean;
  noteId: string | null;
}

/**
 * Upload all foreign images in the scaffold's body and return a scaffold
 * with rewritten image2 attrs. This is step 1-3 of the publish flow.
 */
export async function uploadImages(
  scaffold: Scaffold,
  transport: SubstackTransport,
  readImageAsDataUrl: (src: string) => Promise<string>,
): Promise<Scaffold> {
  const body = isPostPayload(scaffold.payload)
    ? scaffold.payload.draft_body
    : isNotePayload(scaffold.payload)
      ? scaffold.payload.bodyJson
      : { type: 'doc' as const, content: [] };

  const foreignImages = findForeignImages(body);
  if (foreignImages.length === 0) return scaffold;

  let updatedBody = body;
  for (const img of foreignImages) {
    const dataUrl = await readImageAsDataUrl(img.src);
    const result: ImageUploadResult = await transport.uploadImage(dataUrl);
    updatedBody = rewriteImageAttrs(updatedBody, img.path, {
      url: result.url,
      bytes: result.bytes,
      imageWidth: result.imageWidth,
      imageHeight: result.imageHeight,
    });
  }

  return withBody(scaffold, updatedBody);
}

/**
 * Create a draft on Substack. Does NOT publish or schedule.
 * Returns the draft ID from Substack's response.
 */
export async function createDraft(
  scaffold: Scaffold,
  transport: SubstackTransport,
): Promise<{ draftId: number; response: SubstackResponse }> {
  if (!isPostPayload(scaffold.payload)) {
    throw new Error('Cannot create a draft from a non-post scaffold');
  }
  const body = buildCreateDraftRequest(scaffold);
  const response = await transport.createDraft(body);
  if (!response.ok) {
    throw new SubstackApiError(response.status, response.body, 'Failed to create draft');
  }
  const draftId = (response.body as { id?: number }).id;
  if (typeof draftId !== 'number') {
    throw new SubstackApiError(response.status, response.body, 'Draft created but no ID returned');
  }
  return { draftId, response };
}

/**
 * Schedule a draft for future publication.
 * Uses trigger_at (NOT post_date) per the API spec.
 */
export async function scheduleDraft(
  draftId: number,
  scaffold: Scaffold,
  transport: SubstackTransport,
): Promise<SubstackResponse> {
  const scheduleBody = buildScheduleRequest(scaffold);
  if (!scheduleBody) {
    throw new Error('Scaffold has no trigger_at set');
  }
  const response = await transport.scheduleDraft(draftId, scheduleBody);
  if (!response.ok) {
    throw new SubstackApiError(response.status, response.body, 'Failed to schedule draft');
  }
  return response;
}

/**
 * Publish a draft immediately. Irreversible — caller must confirm.
 */
export async function publishDraft(
  draftId: number,
  scaffold: Scaffold,
  transport: SubstackTransport,
): Promise<SubstackResponse> {
  const publishBody = buildPublishRequest(scaffold);
  const response = await transport.publishDraft(draftId, publishBody);
  if (!response.ok) {
    throw new SubstackApiError(response.status, response.body, 'Failed to publish draft');
  }
  return response;
}

/**
 * Create a Note on Substack.
 */
export async function createNote(
  scaffold: Scaffold,
  transport: SubstackTransport,
): Promise<SubstackResponse> {
  if (!isNotePayload(scaffold.payload)) {
    throw new Error('Cannot create a note from a non-note scaffold');
  }
  const body = buildCreateNoteRequest(scaffold);
  const response = await transport.createNote(body);
  if (!response.ok) {
    throw new SubstackApiError(response.status, response.body, 'Failed to create note');
  }
  return response;
}

/**
 * Full publish flow: upload images → create draft → schedule or publish.
 * The caller MUST confirm with the user before calling this.
 */
export async function publishToSubstack(
  scaffold: Scaffold,
  transport: SubstackTransport,
  readImageAsDataUrl: (src: string) => Promise<string>,
): Promise<PublishResult> {
  // Step 1-3: Upload foreign images
  const withImages = await uploadImages(scaffold, transport, readImageAsDataUrl);

  if (isNotePayload(withImages.payload)) {
    const response = await createNote(withImages, transport);
    return {
      draftId: null,
      scheduled: false,
      published: false,
      noteId: (response.body as { id?: string })?.id ?? null,
    };
  }

  // Step 4: Create draft
  const { draftId } = await createDraft(withImages, transport);

  // Step 5-6: Schedule or publish
  const scheduleBody = buildScheduleRequest(withImages);
  if (scheduleBody) {
    await scheduleDraft(draftId, withImages, transport);
    return { draftId, scheduled: true, published: false, noteId: null };
  }

  const publishBody = buildPublishRequest(withImages);
  if (publishBody.send) {
    await publishDraft(draftId, withImages, transport);
    return { draftId, scheduled: false, published: true, noteId: null };
  }

  // Draft created but not published or scheduled
  return { draftId, scheduled: false, published: false, noteId: null };
}
