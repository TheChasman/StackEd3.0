import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  checkBodyLinks,
  checkFragment,
  CHECKING,
  linkHealth,
  nodeLinks,
  type LinkHealthService,
} from '$lib/services/linkHealth';
import type { PMDoc } from '$lib/types/scaffold';

export const LinkHealth = Extension.create<{ service: LinkHealthService }>({
  name: 'linkHealth',
  addOptions() {
    return { service: linkHealth };
  },
  addProseMirrorPlugins() {
    const service = this.options.service;
    const key = new PluginKey<DecorationSet>('linkHealth');
    function decorations(doc: ProseMirrorNode) {
      const items: Decoration[] = [];
      const body = doc.toJSON() as PMDoc;
      doc.descendants((node, pos) => {
        const urls = nodeLinks(node.toJSON());
        if (!urls.length) return;
        const url = urls[0];
        const health = url.startsWith('#')
          ? checkFragment(url, body)
          : (service.get(url) ?? CHECKING);
        const attrs = {
          class: `link-health-${health.status}`,
          title: `${health.status}: ${health.reason}`,
        };
        items.push(
          node.isText
            ? Decoration.inline(pos, pos + node.nodeSize, attrs)
            : Decoration.node(pos, pos + node.nodeSize, attrs),
        );
      });
      return DecorationSet.create(doc, items);
    }
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (tr, old, _, state) =>
            tr.docChanged || tr.getMeta(key) ? decorations(state.doc) : old,
        },
        props: { decorations: (state) => key.getState(state) },
        view(view) {
          let alive = true;
          let scheduled = false;
          const refresh = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
              scheduled = false;
              if (!alive) return;
              view.dispatch(view.state.tr.setMeta(key, true));
            });
          };
          const unsubscribe = service.subscribe(refresh);
          queueMicrotask(() => {
            if (alive) void checkBodyLinks(view.state.doc.toJSON() as PMDoc, {}, service);
          });
          return {
            update(updatedView) {
              void checkBodyLinks(updatedView.state.doc.toJSON() as PMDoc, {}, service);
            },
            destroy() {
              alive = false;
              unsubscribe();
            },
          };
        },
      }),
    ];
  },
});
