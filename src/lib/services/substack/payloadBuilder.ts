// Substack payload builder — pure TypeScript that converts a Scaffold into
// the JSON bodies Substack's private API expects.
//
// Critical gotchas (from the API research):
// - draft_body is a STRING (stringified ProseMirror JSON), not an object
// - bodyJson on Notes is an OBJECT, not a string
// - trigger_at (NOT post_date) for scheduling
// - Foreign image URLs are silently stripped — must upload via /api/v1/image first
// - image2 needs real width/height/bytes or renders as empty placeholder

import type { Scaffold, PostPayload, NotePayload, PMDoc, PMNode } from '$lib/types/scaffold';
import { isPostPayload, isNotePayload } from '$lib/types/scaffold';

// --- Request types (mirror Substack's API shapes) ---

export interface CreateDraftRequest {
  draft_title: string;
  draft_subtitle: string;
  draft_body: string; // STRINGIFIED ProseMirror JSON
  type: string;
  draft_bylines: { id: number; publicationUserId: number }[];
  draft_section_id?: number | null;
  audience?: string;
  write_comment_permissions?: string;
  search_engine_title?: string;
  search_engine_description?: string;
  slug?: string;
}

export interface UpdateDraftRequest {
  draft_title?: string;
  draft_subtitle?: string;
  draft_body?: string;
  search_engine_title?: string;
  search_engine_description?: string;
  slug?: string;
  audience?: string;
  write_comment_permissions?: string;
  draft_section_id?: number | null;
}

export interface PublishRequest {
  send: boolean;
  share_automatically: boolean;
}

export interface ScheduleRequest {
  trigger_at: string; // ISO 8601
  post_audience: string;
}

export interface CreateNoteRequest {
  bodyJson: PMDoc; // OBJECT, not stringified
  replyMinimumRole: string;
}

// --- Builders ---

export function buildCreateDraftRequest(scaffold: Scaffold): CreateDraftRequest {
  if (!isPostPayload(scaffold.payload)) {
    throw new Error('Cannot build draft request from a non-post scaffold');
  }
  const p = scaffold.payload;
  return {
    draft_title: p.draft_title,
    draft_subtitle: p.draft_subtitle,
    draft_body: JSON.stringify(p.draft_body), // CRITICAL: string, not object
    type: p.type,
    draft_bylines: p.draft_bylines,
    draft_section_id: p.draft_section_id,
    audience: p.audience,
    write_comment_permissions: p.write_comment_permissions,
    search_engine_title: p.search_engine_title || undefined,
    search_engine_description: p.search_engine_description || undefined,
    slug: p.slug || undefined,
  };
}

export function buildUpdateDraftRequest(scaffold: Scaffold): UpdateDraftRequest {
  if (!isPostPayload(scaffold.payload)) {
    throw new Error('Cannot build update request from a non-post scaffold');
  }
  const p = scaffold.payload;
  return {
    draft_title: p.draft_title,
    draft_subtitle: p.draft_subtitle,
    draft_body: JSON.stringify(p.draft_body),
    search_engine_title: p.search_engine_title || undefined,
    search_engine_description: p.search_engine_description || undefined,
    slug: p.slug || undefined,
    audience: p.audience,
    write_comment_permissions: p.write_comment_permissions,
    draft_section_id: p.draft_section_id,
  };
}

export function buildPublishRequest(scaffold: Scaffold): PublishRequest {
  if (!isPostPayload(scaffold.payload)) {
    throw new Error('Cannot build publish request from a non-post scaffold');
  }
  const p = scaffold.payload;
  return {
    send: p.send,
    share_automatically: p.share_automatically,
  };
}

export function buildScheduleRequest(scaffold: Scaffold): ScheduleRequest | null {
  if (!isPostPayload(scaffold.payload)) return null;
  const p = scaffold.payload;
  if (!p.trigger_at) return null;
  return {
    trigger_at: p.trigger_at,
    post_audience: p.post_audience,
  };
}

export function buildCreateNoteRequest(scaffold: Scaffold): CreateNoteRequest {
  if (!isNotePayload(scaffold.payload)) {
    throw new Error('Cannot build note request from a non-note scaffold');
  }
  const p = scaffold.payload;
  return {
    bodyJson: {
      type: 'doc',
      attrs: { schemaVersion: 'v1', title: null },
      content: p.bodyJson.content,
    },
    replyMinimumRole: p.replyMinimumRole,
  };
}

// --- Image scanning (for pre-upload) ---

export interface ForeignImage {
  node: PMNode;
  path: number[]; // index path to the node in the doc tree
  src: string;
}

/**
 * Scan a PMDoc for image2 nodes with non-Substack CDN URLs.
 * These must be uploaded via POST /api/v1/image before sending the draft.
 */
export function findForeignImages(doc: PMDoc): ForeignImage[] {
  const results: ForeignImage[] = [];
  walkNodes(doc.content, [], (node, path) => {
    if (node.type === 'image2' && node.attrs) {
      const src = String(node.attrs.src ?? '');
      if (src && !isSubstackCdnUrl(src)) {
        results.push({ node, path, src });
      }
    }
  });
  return results;
}

function isSubstackCdnUrl(url: string): boolean {
  return (
    url.includes('substack-post-media.s3.amazonaws.com') ||
    url.includes('substack.com') ||
    url.startsWith('data:')
  );
}

function walkNodes(nodes: PMNode[], basePath: number[], fn: (node: PMNode, path: number[]) => void): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const path = [...basePath, i];
    fn(node, path);
    if (node.content) {
      walkNodes(node.content, path, fn);
    }
  }
}

/**
 * Rewrite an image2 node's src/width/height/bytes after upload.
 * Returns a new PMDoc with the updated node.
 */
export function rewriteImageAttrs(doc: PMDoc, path: number[], uploadResult: {
  url: string;
  bytes: number;
  imageWidth: number;
  imageHeight: number;
}): PMDoc {
  const newContent = [...doc.content];
  let target = newContent;
  for (let i = 0; i < path.length - 1; i++) {
    target[path[i]] = { ...target[path[i]] };
    target = target[path[i]].content = [...(target[path[i]].content ?? [])];
  }
  const lastIdx = path[path.length - 1];
  target[lastIdx] = {
    ...target[lastIdx],
    attrs: {
      ...target[lastIdx].attrs,
      src: uploadResult.url,
      bytes: uploadResult.bytes,
      width: uploadResult.imageWidth,
      height: uploadResult.imageHeight,
    },
  };
  return { ...doc, content: newContent };
}
