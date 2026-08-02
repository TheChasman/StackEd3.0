// Scaffold type system — the canonical data model for a StackEd document.
// Every field maps 1:1 to Substack's private API payload names.
// The body is ProseMirror JSON, which is literally the wire format Substack accepts.

// --- ProseMirror JSON (self-contained, no TipTap dependency for portability) ---

export interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

export interface PMDoc {
  type: 'doc';
  attrs?: Record<string, unknown>;
  content: PMNode[];
}

// --- Payload zones (1:1 mirror of Substack API field names) ---

export type PostType = 'newsletter' | 'podcast' | 'thread' | 'video';

export type Audience = 'everyone' | 'only_free' | 'only_paid' | 'founding';

export type CommentPermissions = 'none' | 'only_paid' | 'everyone';

export type ScheduledAudience = 'everyone' | 'subscribers_only' | 'paid_subscribers_only';

export type NoteReplyRole = 'everyone' | 'free_subscriber' | 'paid_subscriber' | 'founding_member';

export interface Byline {
  id: number;
  publicationUserId: number;
}

export interface PostPayload {
  type: PostType;
  draft_title: string;
  draft_subtitle: string;
  draft_body: PMDoc;
  draft_bylines: Byline[];
  draft_section_id: number | null;
  audience: Audience;
  write_comment_permissions: CommentPermissions;
  search_engine_title: string;
  search_engine_description: string;
  slug: string;
  tags: string[];
  send: boolean;
  share_automatically: boolean;
  trigger_at: string | null; // ISO 8601 datetime -> scheduled_release
  post_audience: ScheduledAudience;
  draft_podcast_url: string | null;
  draft_podcast_duration: number | null;
}

export interface NotePayload {
  bodyJson: PMDoc; // object, NOT stringified (differs from posts)
  replyMinimumRole: NoteReplyRole;
}

// --- Workshop zone (never ships to Substack) ---

export interface WorkshopCandidates {
  title: string[];
  subtitle: string[];
  hook: string[];
  landing: string[];
}

export interface Workshop {
  spark: string;
  hook: string;
  landing: string;
  candidates: WorkshopCandidates;
  research: string;
  aiGen: boolean;
}

// --- Remote state (tracked after a draft is created on Substack) ---

export interface RemoteState {
  publication: string;
  draftId: number | null;
  scheduled: boolean;
}

// --- The Scaffold ---

export interface Scaffold {
  id: string;
  kind: 'post' | 'note';
  created: string;
  updated: string;
  remote: RemoteState;
  locked: string[]; // field paths the user pinned; AI may not overwrite
  payload: PostPayload | NotePayload;
  workshop: Workshop;
}

// --- Defaults ---

export function emptyPostPayload(): PostPayload {
  return {
    type: 'newsletter',
    draft_title: '',
    draft_subtitle: '',
    draft_body: { type: 'doc', content: [] },
    draft_bylines: [],
    draft_section_id: null,
    audience: 'everyone',
    write_comment_permissions: 'everyone',
    search_engine_title: '',
    search_engine_description: '',
    slug: '',
    tags: [],
    send: true,
    share_automatically: false,
    trigger_at: null,
    post_audience: 'everyone',
    draft_podcast_url: null,
    draft_podcast_duration: null,
  };
}

export function emptyNotePayload(): NotePayload {
  return {
    bodyJson: { type: 'doc', content: [] },
    replyMinimumRole: 'everyone',
  };
}

export function emptyWorkshop(): Workshop {
  return {
    spark: '',
    hook: '',
    landing: '',
    candidates: { title: [], subtitle: [], hook: [], landing: [] },
    research: '',
    aiGen: false,
  };
}

export function emptyScaffold(kind: 'post' | 'note' = 'post'): Scaffold {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    created: now,
    updated: now,
    remote: { publication: '', draftId: null, scheduled: false },
    locked: [],
    payload: kind === 'post' ? emptyPostPayload() : emptyNotePayload(),
    workshop: emptyWorkshop(),
  };
}

// --- Type guards ---

export function isPostPayload(payload: PostPayload | NotePayload): payload is PostPayload {
  return 'draft_title' in payload;
}

export function isNotePayload(payload: PostPayload | NotePayload): payload is NotePayload {
  return 'bodyJson' in payload;
}

export function isPostScaffold(s: Scaffold): boolean {
  return s.kind === 'post';
}

export function isNoteScaffold(s: Scaffold): boolean {
  return s.kind === 'note';
}

// Convenience accessor: get the body PMDoc regardless of kind
export function getBody(s: Scaffold): PMDoc {
  if (isPostPayload(s.payload)) return s.payload.draft_body;
  return s.payload.bodyJson;
}

// Convenience accessor: set the body PMDoc regardless of kind
export function withBody(s: Scaffold, body: PMDoc): Scaffold {
  if (isPostPayload(s.payload)) {
    return { ...s, payload: { ...s.payload, draft_body: body } };
  }
  return { ...s, payload: { ...s.payload, bodyJson: body } };
}
