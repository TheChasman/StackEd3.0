// Pipeline stage enum — matches article-schema.yaml pipeline_order
export type PipelineStage =
  | 'spark' | 'hook' | 'opening' | 'research'
  | 'writing' | 'final_draft' | 'seo' | 'fact_check'
  | 'staged' | 'posted';

export type Audience = 'everyone' | 'paid' | 'none';

// All YAML frontmatter fields (stored fields only — body is separate)
export interface ArticleFrontmatter {
  title: string;
  guid: string;
  pipeline_stage: PipelineStage;
  created: string;
  updated: string;
  spark_notes: string;
  hook: string;
  opening: string;
  research_notes: string;
  ai_draft: string;
  fact_check_notes: string;
  legal_notes: string;
  seo_title: string;
  seo_description: string;
  seo_slug: string;
  substack_tags: string[];
  substack_url: string;
  subtitle: string;
  publish_at: string;
  publication: string;
  section: string;
  audience: Audience;
  allow_comments: Audience;
  send_email: boolean;
  content_locked: boolean;
  overrides: string[];
}

// Defaults for a freshly loaded article with missing fields
export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  title: '',
  guid: '',
  pipeline_stage: 'spark',
  created: '',
  updated: '',
  spark_notes: '',
  hook: '',
  opening: '',
  research_notes: '',
  ai_draft: '',
  fact_check_notes: '',
  legal_notes: '',
  seo_title: '',
  seo_description: '',
  seo_slug: '',
  substack_tags: [],
  substack_url: '',
  subtitle: '',
  publish_at: '',
  publication: '',
  section: '',
  audience: 'everyone',
  allow_comments: 'everyone',
  send_email: true,
  content_locked: false,
  overrides: [],
};

// From field-permissions.json
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

// Parsed .md file (before loading into the store)
export interface ParsedFile {
  frontmatter: ArticleFrontmatter;
  body: string;
  fieldOrder: string[];
  fileHandle: FileSystemFileHandle | null;
  filePath: string | null;
}
