// Which space is on screen (design spec §2): an explicit state machine, not
// a router. Exactly one space renders at a time.
import { documentStore } from './document.svelte';

export type View = 'library' | 'write' | 'plan' | 'finish';

class ViewStore {
  current = $state<View>('library');

  /** A document was opened — write is the default space. */
  openDocument(): void {
    this.current = 'write';
  }

  goLibrary(): void {
    this.current = 'library';
  }

  showPlan(): void {
    if (documentStore.scaffold) this.current = 'plan';
  }

  showFinish(): void {
    if (documentStore.scaffold) this.current = 'finish';
  }

  /** Back from Plan/Finish — to Write when a document is open, else Library. */
  backToWrite(): void {
    this.current = documentStore.scaffold ? 'write' : 'library';
  }

  reset(): void {
    this.current = 'library';
  }
}

export const viewStore = new ViewStore();
