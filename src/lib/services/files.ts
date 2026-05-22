import { parseMarkdownFile, serializeArticleFile } from '$lib/utils/frontmatter';
import { FRONTMATTER_DEFAULTS } from '$lib/types/article';
import type { ArticleFrontmatter, ParsedFile } from '$lib/types/article';
import { addRecentFile } from '$lib/services/storage';

export async function openFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function openFile(handle?: FileSystemFileHandle): Promise<ParsedFile> {
  const fileHandle =
    handle ??
    (await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      multiple: false,
    }))[0];

  const file = await fileHandle.getFile();
  const content = await file.text();
  const { frontmatter: raw, body, fieldOrder } = parseMarkdownFile(content);

  // Merge with defaults so no field is ever undefined
  const frontmatter: ArticleFrontmatter = {
    ...FRONTMATTER_DEFAULTS,
    ...(raw as Partial<ArticleFrontmatter>),
  };

  await addRecentFile(fileHandle, frontmatter.title || file.name).catch(() => {});

  return { frontmatter, body, fieldOrder, fileHandle };
}

export async function saveFile(
  fileHandle: FileSystemFileHandle,
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<void> {
  const content = serializeArticleFile(frontmatter, fieldOrder, body);
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
