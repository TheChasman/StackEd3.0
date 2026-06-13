// Simplified YAML frontmatter for Markdown articles (Substack structure + pre-posting SEO)
export interface ArticleFrontmatter {
  IMAGE: string;
  SPARK: string;
  TITLE: string;
  SUBTITLE: string;
  HOOK: string;
  LANDING: string;
  TITLE_SELECTED: string;      // [✓]-chosen Alt TITLE text, or ''
  SUBTITLE_SELECTED: string;   // [✓]-chosen Alt SUBTITLE text, or ''
  HOOK_SELECTED: string;       // [✓]-chosen Alt HOOK text, or ''
  LANDING_SELECTED: string;    // [✓]-chosen Alt LANDING text, or ''
  AI_GEN: boolean;             // true = generative mode, false = rescan mode
  SEO_TITLE: string;
  SEO_DESCRIPTION: string;
  SEO_SLUG: string;
  SEO_TAGS: string[];
  created: string;
  updated: string;
}

// Defaults for a freshly loaded article with missing fields
export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: '',
  TITLE: '',
  SUBTITLE: '',
  HOOK: '',
  LANDING: '',
  TITLE_SELECTED: '',
  SUBTITLE_SELECTED: '',
  HOOK_SELECTED: '',
  LANDING_SELECTED: '',
  AI_GEN: false,
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
  'TITLE_SELECTED',
  'SUBTITLE_SELECTED',
  'HOOK_SELECTED',
  'LANDING_SELECTED',
  'AI_GEN',
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
