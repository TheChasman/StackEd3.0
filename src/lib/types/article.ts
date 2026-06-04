// Simplified YAML frontmatter for Markdown articles (7-section Substack structure)
export interface ArticleFrontmatter {
  SPARK: string;     // Raw idea seed
  TITLE: string;     // Article title
  SUBTITLE: string;  // Hook promise
  HOOK: string;      // Refined opening
  LANDING: string;   // Closing thought
  created: string;   // ISO timestamp
  updated: string;   // ISO timestamp
}

// Defaults for a freshly loaded article with missing fields
export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  SPARK: '',
  TITLE: '',
  SUBTITLE: '',
  HOOK: '',
  LANDING: '',
  created: '',
  updated: '',
};

export const FRONTMATTER_FIELD_ORDER: (keyof ArticleFrontmatter)[] = [
  'SPARK',
  'TITLE',
  'SUBTITLE',
  'HOOK',
  'LANDING',
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
