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
  for (const cb of subscribers) cb(buffer);
}

export function recordEntry(entry: RecorderEntry): void {
  buffer.push(entry);
  while (buffer.length > RING_CAPACITY) buffer.shift();
  notify();
}

export function clearBuffer(): void {
  buffer.length = 0;
  notify();
}

export function getBuffer(): RecorderEntry[] {
  return buffer;
}

export function subscribe(cb: (entries: RecorderEntry[]) => void): () => void {
  subscribers.add(cb);
  cb(buffer);
  return () => { subscribers.delete(cb); };
}

export function useRecorder(): { entries: RecorderEntry[] } {
  // Svelte 5 runes-style accessor; consumers can re-bind via subscribe() if they
  // need an unsubscribe handle.
  return { entries: buffer };
}
