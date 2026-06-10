// Simplified YAML frontmatter for Markdown articles (Substack structure + pre-posting SEO)
export interface ArticleFrontmatter {
  IMAGE: string;            // Hero image src (URL or data-URI)
  SPARK: string;            // Raw idea seed
  TITLE: string;            // Article title
  SUBTITLE: string;         // Hook promise
  HOOK: string;             // Refined opening
  LANDING: string;          // Closing thought
  SEO_TITLE: string;        // Search/social title
  SEO_DESCRIPTION: string;  // Search/social description
  SEO_SLUG: string;         // URL-safe slug
  SEO_TAGS: string[];       // Short topical tags
  created: string;          // ISO timestamp
  updated: string;          // ISO timestamp
}

// Defaults for a freshly loaded article with missing fields
export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: '',
  TITLE: '',
  SUBTITLE: '',
  HOOK: '',
  LANDING: '',
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '',
  updated: '',
};

export const FRONTMATTER_FIELD_ORDER: (keyof ArticleFrontmatter)[] = [
  'IMAGE',
  'SPARK',
  'TITLE',
  'SUBTITLE',
  'HOOK',
  'LANDING',
  'SEO_TITLE',
  'SEO_DESCRIPTION',
  'SEO_SLUG',
  'SEO_TAGS',
  'created',
  'updated',
];

// Field permission types (separate from frontmatter structure)
export type FieldOwner = 'author' | 'stackpipe' | 'ai';
export type FieldAccess = 'free' | 'padlocked' | 'readonly';

export interface FieldPermission {
  owner: FieldOwner;
  access: FieldAccess;
  content_field: boolean;
}

export interface PermissionsManifest {
  version: number;
  description: string;
  fields: Record<string, FieldPermission>;
}


// Parsed StackEd article file (before loading into the store)
export interface ParsedFile {
  frontmatter: ArticleFrontmatter;
  body: string;
  fieldOrder: string[];
  fileHandle: FileSystemFileHandle | null;
  filePath: string | null;
  dirty?: boolean;
}
