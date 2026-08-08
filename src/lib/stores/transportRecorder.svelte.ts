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

export function recordEntry(entry: RecorderEntry): void {
  void entry;
}

export function clearBuffer(): void {
  // no-op
}

export function getBuffer(): RecorderEntry[] {
  return [];
}

export function subscribe(cb: (entries: RecorderEntry[]) => void): () => void {
  void cb;
  return () => {};
}

export function useRecorder(): { entries: RecorderEntry[] } {
  return { entries: [] };
}
