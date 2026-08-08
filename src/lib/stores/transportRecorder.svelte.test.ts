import { describe, it, expect, beforeEach } from 'vitest';
import { recordEntry, clearBuffer, getBuffer, subscribe } from './transportRecorder.svelte';

describe('transportRecorder store', () => {
  beforeEach(() => clearBuffer());

  it('appends entries in order', () => {
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: { ok: true }, error: null, endedAt: 2 });
    recordEntry({ id: 'b', startedAt: 3, method: 'POST', path: '/y', bodyIn: { z: 1 }, status: 'pending', bodyOut: null, error: null, endedAt: null });
    const buf = getBuffer();
    expect(buf).toHaveLength(2);
    expect(buf[0].id).toBe('a');
    expect(buf[1].id).toBe('b');
  });

  it('clearBuffer empties the buffer', () => {
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 2 });
    expect(getBuffer()).toHaveLength(1);
    clearBuffer();
    expect(getBuffer()).toHaveLength(0);
  });

  it('subscribers receive every entry, then unsubscribe stops them', () => {
    const received: unknown[] = [];
    const unsub = subscribe((buf) => received.push(buf));
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 2 });
    unsub();
    recordEntry({ id: 'b', startedAt: 2, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 3 });
    expect(received).toHaveLength(2); // one initial (empty) snapshot + one after recordEntry
    const lastSnapshot = received[received.length - 1] as { id?: string }[];
    expect(lastSnapshot[0]?.id).toBe('a');
  });

  it('caps the buffer at 200 entries and drops oldest', () => {
    for (let i = 0; i < 210; i++) {
      recordEntry({ id: `e${i}`, startedAt: i, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: i + 1 });
    }
    const buf = getBuffer();
    expect(buf).toHaveLength(200);
    expect(buf[0].id).toBe('e10');
    expect(buf[199].id).toBe('e209');
  });
});
