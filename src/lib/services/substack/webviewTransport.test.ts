import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi
  .fn<(cmd: string, args?: unknown) => Promise<unknown>>()
  .mockResolvedValue(undefined);
const listenMock = vi.fn().mockResolvedValue(() => {});
const getByLabelMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: (...args: unknown[]) => listenMock(...args),
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getByLabel: (...args: unknown[]) => getByLabelMock(...args) },
}));

import { isSubstackResponse, WebViewTransport } from './webviewTransport';

describe('isSubstackResponse', () => {
  it('ignores malformed responses', () => {
    expect(isSubstackResponse({ id: 1 })).toBe(false);
    expect(isSubstackResponse(null)).toBe(false);
    expect(isSubstackResponse('nope')).toBe(false);
    expect(isSubstackResponse({ id: 'a', ok: true, status: 200 })).toBe(false);
    expect(isSubstackResponse({ id: 'a', ok: true, status: 200, body: {} })).toBe(true);
    expect(isSubstackResponse({ id: 'a', ok: false, status: 0, body: 'err' })).toBe(true);
  });
});

describe('WebViewTransport', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    listenMock.mockClear();
    getByLabelMock.mockReset();
    WebViewTransport.currentPublication = null;
  });

  it('transport never invokes eval_in_webview', async () => {
    getByLabelMock.mockResolvedValue({ close: vi.fn() });
    const transport = new WebViewTransport('chasnewport');
    await transport.init();
    const commands = invokeMock.mock.calls.map(([cmd]) => cmd);
    expect(commands).toContain('substack_inject_bridge');
    expect(commands).not.toContain('eval_in_webview');
    for (const cmd of commands) {
      expect(['substack_inject_bridge', 'substack_navigate']).toContain(cmd);
    }
  });

  it('navigates via substack_navigate when the publication differs', async () => {
    getByLabelMock.mockResolvedValue({ close: vi.fn() });
    WebViewTransport.currentPublication = 'other';
    const transport = new WebViewTransport('chasnewport');
    const init = transport.init();
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('substack_navigate', { publication: 'chasnewport' });
    });
    await init;
  });
});
