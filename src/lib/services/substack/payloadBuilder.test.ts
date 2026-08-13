import { describe, expect, it } from 'vitest';
import {
  emptyScaffold,
  isPostPayload,
  isNotePayload,
  type PMDoc,
  type PostPayload,
  type NotePayload,
} from '$lib/types/scaffold';
import {
  buildCreateDraftRequest,
  buildUpdateDraftRequest,
  buildPublishRequest,
  buildScheduleRequest,
  buildCreateNoteRequest,
  findForeignImages,
  rewriteImageAttrs,
} from './payloadBuilder';

function postScaffold() {
  const scaffold = emptyScaffold('post');
  if (isPostPayload(scaffold.payload)) {
    scaffold.payload.draft_title = 'Test';
    scaffold.payload.draft_body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };
    scaffold.payload.draft_bylines = [{ id: 1, publicationUserId: 2 }];
  }
  return scaffold;
}

describe('draft payload builders', () => {
  it('stringifies the body when creating a draft', () => {
    const scaffold = postScaffold();
    const request = buildCreateDraftRequest(scaffold);

    expect(request.draft_body).toBe(JSON.stringify((scaffold.payload as PostPayload).draft_body));
    expect(typeof request.draft_body).toBe('string');
    expect(request.draft_title).toBe('Test');
    expect(request.draft_bylines).toEqual([{ id: 1, publicationUserId: 2 }]);
  });

  it('throws when creating a draft from a non-post scaffold', () => {
    expect(() => buildCreateDraftRequest(emptyScaffold('note'))).toThrow(
      'Cannot build draft request from a non-post scaffold',
    );
  });

  it('stringifies the body when updating a draft', () => {
    const scaffold = postScaffold();

    expect(buildUpdateDraftRequest(scaffold).draft_body).toBe(
      JSON.stringify((scaffold.payload as PostPayload).draft_body),
    );
  });

  it('builds publish options from the post payload', () => {
    const scaffold = postScaffold();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.send = false;
      scaffold.payload.share_automatically = true;
    }

    expect(buildPublishRequest(scaffold)).toEqual({
      send: false,
      share_automatically: true,
    });
  });

  it('returns null for an unscheduled post', () => {
    expect(buildScheduleRequest(postScaffold())).toBeNull();
  });

  it('builds a schedule request with trigger_at and post_audience', () => {
    const scaffold = postScaffold();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.trigger_at = '2026-04-01T12:00:00.000Z';
      scaffold.payload.post_audience = 'paid_subscribers_only';
    }

    expect(buildScheduleRequest(scaffold)).toEqual({
      trigger_at: '2026-04-01T12:00:00.000Z',
      post_audience: 'paid_subscribers_only',
    });
  });
});

describe('note payload builder', () => {
  it('builds a note with an object body and schemaVersion', () => {
    const scaffold = emptyScaffold('note');
    if ('bodyJson' in scaffold.payload) {
      scaffold.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A note' }] }],
      };
      scaffold.payload.replyMinimumRole = 'paid_subscriber';
    }

    const request = buildCreateNoteRequest(scaffold);
    expect(request.bodyJson).toEqual({
      type: 'doc',
      attrs: { schemaVersion: 'v1', title: null },
      content: (scaffold.payload as NotePayload).bodyJson.content,
    });
    expect(typeof request.bodyJson).toBe('object');
    expect(request.replyMinimumRole).toBe('paid_subscriber');
  });

  it('throws when creating a note from a non-note scaffold', () => {
    expect(() => buildCreateNoteRequest(postScaffold())).toThrow(
      'Cannot build note request from a non-note scaffold',
    );
  });
});

describe('image helpers', () => {
  const imageDoc: PMDoc = {
    type: 'doc',
    content: [
      {
        type: 'blockquote',
        content: [
          { type: 'image2', attrs: { src: 'https://example.com/foreign.png' } },
          {
            type: 'image2',
            attrs: { src: 'https://substack-post-media.s3.amazonaws.com/image.png' },
          },
          { type: 'image2', attrs: { src: 'https://publication.substack.com/image.png' } },
          { type: 'image2', attrs: { src: 'data:image/png;base64,abc' } },
        ],
      },
    ],
  };

  it('finds foreign image2 URLs but skips Substack CDN and data URLs', () => {
    expect(findForeignImages(imageDoc)).toMatchObject([
      {
        path: [0, 0],
        src: 'https://example.com/foreign.png',
      },
    ]);
  });

  it('rewrites image attributes in a new document', () => {
    const uploadResult = {
      url: 'https://substack-post-media.s3.amazonaws.com/uploaded.png',
      bytes: 1234,
      imageWidth: 800,
      imageHeight: 600,
    };
    const rewritten = rewriteImageAttrs(imageDoc, [0, 0], uploadResult);
    const originalImage = imageDoc.content[0].content?.[0];
    const rewrittenImage = rewritten.content[0].content?.[0];

    expect(rewritten).not.toBe(imageDoc);
    expect(rewrittenImage).toMatchObject({
      type: 'image2',
      attrs: {
        src: uploadResult.url,
        width: uploadResult.imageWidth,
        height: uploadResult.imageHeight,
        bytes: uploadResult.bytes,
      },
    });
    expect(originalImage?.attrs?.src).toBe('https://example.com/foreign.png');
  });
});
