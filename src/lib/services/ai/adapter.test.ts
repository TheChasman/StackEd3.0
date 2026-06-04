import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdapter } from './adapter';
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';

describe('createAdapter', () => {
  it('returns a ClaudeAdapter for "claude"', () => {
    const adapter = createAdapter('claude', 'sk-ant-test');
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it('returns an OpenAIAdapter for "openai"', () => {
    const adapter = createAdapter('openai', 'sk-openai-test');
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });
});

describe('ClaudeAdapter', () => {
  it('constructs with an API key', () => {
    expect(() => new ClaudeAdapter('sk-ant-test')).not.toThrow();
  });

  it('throws on empty API key', () => {
    expect(() => new ClaudeAdapter('')).toThrow('API key required');
  });

  it('search calls the Anthropic client with versioned web_search tool', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Summary of result. https://example.com' }],
    });

    const adapter = new ClaudeAdapter('sk-ant-test');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any)['client'].messages.create = mockCreate;

    const result = await adapter.search('Paris architecture');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({ type: 'web_search_20260209' }),
        ]),
      }),
    );
    expect(result.summary).toContain('Summary of result');
    expect(result.query).toBe('Paris architecture');
  });
});

describe('OpenAIAdapter', () => {
  it('constructs with an API key', () => {
    expect(() => new OpenAIAdapter('sk-openai-test')).not.toThrow();
  });

  it('throws on empty API key', () => {
    expect(() => new OpenAIAdapter('')).toThrow('API key required');
  });

  it('search calls the OpenAI client', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      output_text: 'OpenAI research summary.',
      output: [],
    });

    const adapter = new OpenAIAdapter('sk-openai-test');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any)['client'].responses.create = mockCreate;

    const result = await adapter.search('Paris architecture');

    expect(mockCreate).toHaveBeenCalled();
    expect(result.summary).toBe('OpenAI research summary.');
    expect(result.query).toBe('Paris architecture');
  });
});
