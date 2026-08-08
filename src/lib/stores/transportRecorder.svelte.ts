export interface RecorderEntry {
  id: string;
  startedAt: number;
  method: string;
  path: string;
  bodyIn: unknown;
  status: number | 'pending';
  bodyOut: unknown;
  error: string | null;
  endedAt: number | null;
}

const RING_CAPACITY = 200;
const buffer: RecorderEntry[] = [];
const subscribers = new Set<(entries: RecorderEntry[]) => void>();

function notify(): void {
  const snapshot = [...buffer];
  for (const cb of subscribers) cb(snapshot);
}

export function recordEntry(entry: RecorderEntry): void {
  buffer.push(entry);
  while (buffer.length > RING_CAPACITY) buffer.shift();
  notify();
}

/** Finds a pending entry by id and patches its fields in place, then notifies. */
export function updateEntry(id: string, patch: Partial<Omit<RecorderEntry, 'id'>>): void {
  const entry = buffer.find(e => e.id === id);
  if (!entry) return;
  Object.assign(entry, patch);
  notify();
}

export function clearBuffer(): void {
  buffer.length = 0;
  notify();
}

export function getBuffer(): RecorderEntry[] {
  return [...buffer];
}

export function subscribe(cb: (entries: RecorderEntry[]) => void): () => void {
  subscribers.add(cb);
  cb([...buffer]);
  return () => { subscribers.delete(cb); };
}

export function useRecorder(): { entries: RecorderEntry[] } {
  // Svelte 5 runes-style accessor; consumers can re-bind via subscribe() if they
  // need an unsubscribe handle.
  return { entries: buffer };
}
