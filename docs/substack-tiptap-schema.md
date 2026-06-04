# Substack TipTap / ProseMirror Schema

**Extracted live from Substack's draft editor** (`chasman1.substack.com`),
2026-06-04. The editor element: `div.tiptap.ProseMirror.mousetrap`.

Substack's editor is **TipTap** with 86 custom **node types** and 8 **mark types**.
The internal `draft_body` field stores JSON conforming to this schema. No
markdown layer exists; the JSON *is* the canonical format.

---

## Architecture

```
captionedImage (block container)
  ├── image2 | image3 (block, atom — the image data)
  └── caption (block — the figcaption)
```

Images never appear inline in paragraphs. `image` (the legacy inline node from
`@tiptap/extension-image`) still exists in the schema but appears unused in
current drafts.

Links use the `link` **mark** on text nodes (not an inline node).

The hero image has no special node type — it's just `image2` with `topImage: true`.

---

## Nodes

### Text Content

| Node | Group | Key Attributes |
|------|-------|---------------|
| `doc` | — | — |
| `paragraph` | block | `textAlign` (default `null`) |
| `heading` | block, defining | `level` (1, default), `textAlign` (null) |
| `text` | inline | — |
| `hardBreak` | inline, selectable:false | — |
| `blockquote` | block, defining | — |
| `bulletList` | block, list | — |
| `orderedList` | block, list | `start` (1), `type` (null) |
| `listItem` | defining | — |
| `codeBlock` | block, defining | `language` (null) |
| `horizontalRule` | block | — |

### Images

#### `image2` — Primary Image (block, atom)

| Attribute | Type | Default | Notes |
|-----------|------|---------|-------|
| `src` | string | `""` | S3 URL (source of truth) |
| `srcNoWatermark` | string\|null | `null` | |
| `fullscreen` | any\|null | `null` | |
| `imageSize` | any\|null | `null` | |
| `height` | number\|null | `null` | |
| `width` | number\|null | `null` | |
| `resizeWidth` | number\|null | `null` | |
| `bytes` | number\|null | `null` | File size |
| `alt` | string\|null | `null` | Alt text |
| `title` | string\|null | `null` | |
| `type` | string\|null | `null` | MIME (e.g. `"image/jpeg"`) |
| `href` | string\|null | `null` | Link target when image is clicked |
| `belowTheFold` | boolean | `false` | Lazy load flag |
| **`topImage`** | boolean | `false` | **Hero/cover image flag** |
| `internalRedirect` | string\|null | `null` | |
| `isProcessing` | boolean | `false` | Upload-in-progress marker |
| `align` | string\|null | `null` | `"center"`, `"left"`, etc. |
| `offset` | boolean | `false` | |

#### `image3` — Newer Image Variant (block)

| Attribute | Type | Default |
|-----------|------|---------|
| `src` | string\|null | `null` |
| `alt` | string\|null | `null` |
| `title` | string\|null | `null` |
| `href` | string\|null | `null` |
| `width` | string | `"100%"` |
| `height` | string | `"auto"` |
| `size` | string | `"normal"` |
| `align` | string | `"center"` |

#### `image` — Legacy Inline Image

| Attribute | Type | Default |
|-----------|------|---------|
| `src` | string | `""` |
| `height` | number\|null | `null` |
| `width` | number\|null | `null` |
| `alt` | string\|null | `null` |
| `title` | string\|null | `null` |

#### `captionedImage` — Image + Caption Container (block, defining)

Wraps one `image2`/`image3` and optionally one `caption`. No attributes.

#### `caption` — Figcaption Content (block, defining, isolating)

A block-level container for caption text (contains `paragraph` + inline
content). No attributes.

#### `imageGallery` — Multi-Image Container (block, atom)

| Attribute | Type | Default |
|-----------|------|---------|
| `gallery` | object | `{}` |
| `isEditorNode` | boolean | `false` |

### Marks (Inline Formatting)

| Mark | Attributes |
|------|-----------|
| **`link`** | `href` (null), `target` (`"_blank"`), `rel` (`"noopener noreferrer nofollow"`), `class` (null) |
| `bold` | — |
| `italic` | — |
| `strike` | — |
| `code` | — (excludes `_`) |
| `highlight` | `color` (null) |
| `subscript` | — |
| `superscript` | — |

### Substack Widgets

| Node | Type | Key Attributes |
|------|------|---------------|
| `pullquote` | block, defining | `align` (null), `color` (null) |
| `calloutBlock` | block, defining | — |
| `button` | block, atom | `url` (null), `text` (null), `action` (null), `class` (null) |
| `subscribeWidget` | block, defining | `url` (null), `text` (null), `language` (`"en"`) |
| `captionedShareButton` | block, defining | `url` (null), `text` (null) |
| `captionedWriterReferralButton` | block, defining | `url` (null), `text` (null) |
| `paywall` | block, atom | — |
| `poll` | block, atom | `id` (null) |
| `recipe` | block, atom | `id` (null) |
| `directMessage` | block, atom | `userId`, `userName`, `canDm`, `dmUpgradeOptions`, `isEditorNode` |
| `preformatted_text_block` | block, defining | `params` (`""`), `language` (`"en"`) |
| `fpRecircBlock` | block, atom | `nodeId`, `title`, `postIds`, `showCount`, `posts`, `isEditorNode`, `align` |
| `ctaCaption` | block, defining | — (child of subscribeWidget/shareButton) |
| `referralTier` | block, atom | `isEditorNode`, `numReferralsRequired`, `rewardDescription`, `pub`, `tierNumber` |

### Footnotes & LaTeX

| Node | Type | Attributes |
|------|------|-----------|
| `footnote` | block | `number` (1) |
| `footnoteAnchor` | inline, atom | `number` (1) — placed inside a paragraph |
| `latex_block` | block, defining | `persistentExpression` (`""`), `id` (`""`) |
| `inline_latex` | inline, atom | `persistentExpression` (`""`), `id` (`""`) |
| `highlighted_code_block` | block, defining | `language` (`"plaintext"`), `nodeId` (null) |

### Embeds

| Node | Type | Attributes |
|------|------|-----------|
| `youtube2` | block, atom | `videoId`, `startTime`, `endTime` |
| `youtube` | inline, atom | `videoId` (legacy) |
| `vimeo` | block, atom | `videoId`, `videoKey`, `belowTheFold` |
| `twitter2` | block, atom | `url`, `full_text`, `username`, `name`, `profile_image_url`, `date`, `photos`, `quoted_tweet`, `reply_count`, `retweet_count`, `like_count`, `impression_count`, `expanded_url`, `video_url`, `belowTheFold` |
| `twitter` | inline, atom | `url`, `html`, `author`, `author_name`, `date` (legacy) |
| `instagram` | block, atom | `instagram_id`, `title`, `author_name`, `thumbnail_url`, `like_count`, `comment_count`, `profile_pic_url`, `follower_count`, `timestamp`, `belowTheFold` |
| `tiktok` | block, atom | `url`, `title`, `thumbnail_url`, `author`, `embed_url`, `author_url`, `belowTheFold` |
| `bluesky` | block, atom | `postId`, `authorDid`, `authorName`, `authorHandle`, `authorAvatarUrl`, `text`, `createdAt`, `uri`, `imageUrls` |
| `spotify2` | block, atom | `image`, `title`, `subtitle`, `description`, `url`, `belowTheFold`, `noScroll` |
| `spotify` | inline, atom | `image`, `title`, `subtitle`, `description`, `url` (legacy) |
| `soundcloud` | block, atom | `url`, `title`, `description`, `thumbnail_url`, `author_name`, `author_url`, `targetUrl` |
| `bandcamp` | block, atom | `url`, `title`, `description`, `thumbnail_url`, `author`, `embed_url`, `is_album` |
| `applePodcast` | block, atom | `url`, `isEpisode`, `imageUrl`, `title`, `podcastTitle`, `podcastByline`, `duration`, `numEpisodes`, `targetUrl`, `releaseDate` |
| `datawrapper` | block, atom | `url`, `thumbnail_url`, `thumbnail_url_full`, `height`, `title`, `description` |
| `polymarket` | block, atom | `eventSlug`, `marketSlug`, `profileName`, `belowTheFold`, `fullEmbedUrl`, `isGraphMode` |
| `prediction_market` | block, atom | `url`, `thumbnail_url` |
| `manifold` | block, atom | `url`, `thumbnail_url` |
| `lichess` | block, atom | `url`, `thumbnail_url` |
| `opensea` | block, atom | `collection`, `collection_slug`, `creator`, `description`, `image_url`, `name`, `animation_url`, `nft_logo_url`, `permalink`, `youtube_url`, `belowTheFold` |
| `kindle` | block, atom | `kindleId`, `imageUrl` |
| `gitgist` | block, atom | `innerHTML`, `stylesheet` |
| `embeddedPost` | block, atom | `id`, `url`, `publication_id`, `publication_name`, `publication_logo_url`, `title`, `truncated_body_text`, `date`, `like_count`, `comment_count`, `bylines`, `utm_campaign`, `belowTheFold`, `type`, `language`, `source` |
| `embeddedPublication` | block, atom | `id`, `name`, `logo_url`, `base_url`, `hero_text`, `author_name`, `show_subscribe`, `logo_bg_color`, `language` |
| `communityPost` | block, atom | `url`, `postId`, `communityPost`, `author` |
| `communityChat` | block, atom | `url`, `subdomain`, `pub` |
| `digestPostEmbed` | block, atom | `nodeId`, `caption`, `cta`, `showBylines`, `size`, `isEditorNode`, `title`, `publishedBylines`, `post_date`, `cover_image`, `cover_image_alt`, `canonical_url`, `section_name`, `video_upload_id`, `id`, `type`, `reaction_count`, `comment_count`, `publication_id`, `publication_name`, `publication_logo_url`, `belowTheFold`, `youtube_url`, `show_links`, `feed_url` |
| `pinterest` | block, atom | `url`, `thumbnail_url`, `title`, `author_name`, `author_url`, `belowTheFold` |
| `meeting` | block, atom | `name`, `avatarUrl`, `url`, `isEditorNode` |

### Files

| Node | Type | Attributes |
|------|------|-----------|
| `video` | block, atom | `mediaUploadId` (null), `duration` (null) |
| `audio` | block, atom | `label`, `mediaUploadId`, `duration`, `downloadable`, `isEditorNode` |
| `audioUrl` | block, atom | `label`, `url`, `duration` |
| `file` | block, atom | `filename`, `filetype`, `filesize`, `href`, `title`, `description`, `thumbnail`, `fileKey`, `dirty`, `raw_href`, `error`, `empty` |
| `pdf` | block, atom | (same as `file`) |
| `xlsx` | block, atom | (same as `file`) |
| `ebook` | block, atom | (same as `file`) |
| `comic` | block, atom | (same as `file`) |
| `code_embed` | block, atom | `uuid`, `content_hash`, `post_id`, `width` |

### Miscellaneous

| Node | Type | Notes |
|------|------|-------|
| `mention` | inline, atom | `id`, `label`, `mentionSuggestionChar` |
| `substack_mentions` | inline, atom | `name`, `id`, `type`, `url`, `photo_url`, `uuid` |
| `substack_mentions_extension` | inline, atom | `id`, `label`, `mentionSuggestionChar` |
| `cashtag` | inline, atom | `symbol` |
| `referral_link` | block, atom | `name`, `subdomain` |
| `sponsorshipCampaign` | block, atom | `id`, `campaignPostId`, `pub` |
| `templateComment` | block | `params` |
| `augmentation_placeholder` | block, atom | `request_id`, `url`, `src`, `type` |
| `assetError` | block, defining | `url` |
| `fragmentNode` | block | — |
| `install_substack_app` | block, atom | `logo_url`, `publication_name`, `publication_subdomain`, `author_name`, `language` |
| `preview_in_substack_app` | block, atom | `pub`, `uuid` |

---

## JSON Examples

### Inline Link

```json
{
  "type": "text",
  "text": "click here",
  "marks": [{
    "type": "link",
    "attrs": {
      "href": "https://example.com",
      "target": "_blank",
      "rel": "noopener noreferrer nofollow",
      "class": null
    }
  }]
}
```

### Hero Image with Caption

```json
{
  "type": "captionedImage",
  "content": [
    {
      "type": "image2",
      "attrs": {
        "src": "https://substack-post-media.s3.amazonaws.com/public/images/abc_1456x1048.png",
        "width": 1456,
        "height": 1048,
        "bytes": 272367,
        "alt": "Alt text here",
        "type": "image/png",
        "href": "https://example.com/full-res",
        "topImage": true,
        "belowTheFold": false,
        "isProcessing": false,
        "align": null,
        "offset": false,
        "srcNoWatermark": null,
        "fullscreen": null,
        "imageSize": null,
        "resizeWidth": null,
        "title": null,
        "internalRedirect": null
      }
    },
    {
      "type": "caption",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "This is the caption text." }]
        }
      ]
    }
  ]
}
```

### Image as Clickable Link

Use the `href` attribute on `image2`:

```json
{ "type": "image2", "attrs": { "src": "...", "href": "https://destination.com", ... } }
```

The published DOM renders this as `<a class="image-link image2">` wrapping the
`<img>`. There is no separate markdown-style `[![alt](img)](url)` construction.

### Full Draft Document

```json
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Title" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "Subtitle" }] },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Some " },
        { "type": "text", "text": "bold", "marks": [{ "type": "bold" }] },
        { "type": "text", "text": " and " },
        { "type": "text", "text": "linked", "marks": [{ "type": "link", "attrs": { "href": "https://example.com", "target": "_blank", "rel": "noopener noreferrer nofollow", "class": null } }] },
        { "type": "text", "text": " text." }
      ]
    },
    { "type": "captionedImage", "content": [ ... ] },
    { "type": "horizontalRule" },
    {
      "type": "subscribeWidget",
      "attrs": { "url": "%%checkout_url%%", "text": "Subscribe", "language": "en" },
      "content": [
        { "type": "ctaCaption", "content": [{ "type": "text", "text": "Join the newsletter." }] }
      ]
    }
  ]
}
```

---

## Draft API Integration

Substack stores drafts via `POST https://{pub}.substack.com/api/v1/drafts`
with `draft_body` set to this JSON (stringified).

The community reverse-engineered approach (JPres-Projects
`draft_create.py`) copies an existing unpublished draft's structure, replaces
`draft_body`, and POSTs it back. The key gotcha: `draft_bylines[].id` must
equal `draft_bylines[].user_id` (not a separate UUID).

---

## References

- **TipTap**: [tiptap.dev](https://tiptap.dev/) — `nodeType.spec` maps 1:1 to
  TipTap extension `addAttributes()`
- **Thirdbear Chrome extension**: [GitHub](https://github.com/thethirdbearsolutions/chrome-extension-substack-backups) —
  fetches `draft_body` raw via `GET /api/v1/drafts/{id}`
- **JPres-Projects Substack-API**: [GitHub](https://github.com/JPres-Projects/Substack-API) —
  reverse-engineered draft creation with full content JSON

*Schema snapshot from `chasman1.substack.com` draft editor, 2026-06-04.*
