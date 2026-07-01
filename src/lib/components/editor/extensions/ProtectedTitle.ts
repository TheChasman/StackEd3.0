import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const pluginKey = new PluginKey('protectedTitle');

function enforceFirstNodeIsH1(tr: Transaction): Transaction | null {
  const { doc } = tr;
  const schema = doc.type.schema;
  const headingType = schema.nodes.heading;
  const paragraphType = schema.nodes.paragraph;
  if (!headingType) return null;

  const first: ProseMirrorNode | null = doc.firstChild;

  if (!first) {
    const heading = headingType.create({ level: 1 });
    return tr.insert(0, heading);
  }

  if (first.type === headingType && first.attrs.level === 1) {
    return null;
  }

  if (first.type === headingType) {
    return tr.setNodeMarkup(0, undefined, { ...first.attrs, level: 1 });
  }

  if (first.type === paragraphType) {
    return tr.setNodeMarkup(0, headingType, { level: 1 });
  }

  // First node can't hold heading content directly (e.g. an image block) —
  // insert an empty H1 above it instead of trying to convert it.
  const heading = headingType.create({ level: 1 });
  return tr.insert(0, heading);
}

export const ProtectedTitle = Extension.create({
  name: 'protectedTitle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        // TipTap builds the editor's initial state directly from `content`
        // (no transaction goes through `appendTransaction` for it), and its
        // `create`/`onCreate` lifecycle event fires asynchronously (inside a
        // setTimeout), which is too late for code that inspects the doc
        // synchronously right after construction. `view()` runs synchronously
        // as soon as the EditorView is constructed, so we use it to normalize
        // the initial document immediately.
        view(editorView) {
          const fixed = enforceFirstNodeIsH1(editorView.state.tr);
          if (fixed) {
            editorView.dispatch(fixed);
          }
          return {};
        },
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          const fixed = enforceFirstNodeIsH1(tr);
          return fixed;
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { $from } = state.selection;
        const headingType = state.schema.nodes.heading;
        const paragraphType = state.schema.nodes.paragraph;
        const firstNode = state.doc.firstChild;

        const insideFirstNode = firstNode && $from.pos > 0 && $from.pos < firstNode.nodeSize + 1 && $from.before(1) === 0;
        if (!insideFirstNode || firstNode?.type !== headingType) {
          return false;
        }

        const tr = state.tr.deleteSelection();
        const splitPos = tr.selection.from;
        tr.split(splitPos, 1, [{ type: paragraphType }]);
        tr.setSelection(TextSelection.near(tr.doc.resolve(splitPos + 2)));
        view.dispatch(tr);
        return true;
      },
    };
  },
});
