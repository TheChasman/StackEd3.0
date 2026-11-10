// Import-time HTML sanitiser for article HTML (e.g. marked.parse output)
// before it is converted to a ProseMirror doc. No new dependency: DOMParser
// plus a small allowlist walker. Rendering of scaffold JSON attributes is
// separately safe via textContent node views.
const DROP_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'link',
  'meta',
  'base',
  'form',
]);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster']);

function isBlockedUrl(tag: string, attr: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true;
  if (v.startsWith('data:')) {
    return !(tag === 'img' && attr === 'src' && v.startsWith('data:image/'));
  }
  return false;
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (el: Element): void => {
    for (const child of [...el.children]) {
      const tag = child.tagName.toLowerCase();
      if (DROP_TAGS.has(tag)) {
        if (tag === 'form') {
          // Keep a dropped form's children, sanitised like everything else.
          const parent = child.parentNode!;
          const promoted: Element[] = [];
          while (child.firstChild) {
            const node = child.firstChild;
            parent.insertBefore(node, child);
            if (node.nodeType === 1) promoted.push(node as Element);
          }
          child.remove();
          for (const node of promoted) walk(node);
        } else {
          child.remove();
        }
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || (URL_ATTRS.has(name) && isBlockedUrl(tag, name, attr.value))) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(doc.body);
  // eslint-disable-next-line no-restricted-properties -- read-only serialisation
  return doc.body.innerHTML;
}
