import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import {
  generateImage,
  IMAGE_GENERATION_MODELS,
  saveGeneratedImageToArtwork,
} from './imageGeneration';

describe('imageGeneration service', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      data_url: 'data:image/png;base64,aGVybw==',
      model: 'openai/gpt-5.4-image-2',
    });
  });

  it('offers ChatGPT Image and NanoBanana model choices', () => {
    expect(IMAGE_GENERATION_MODELS).toEqual([
      { id: 'openai/gpt-5.4-image-2', label: 'ChatGPT Image 2' },
      { id: 'google/gemini-3.1-flash-image-preview', label: 'NanoBanana 2' },
    ]);
  });

  it('generates an image through the Tauri OpenRouter command', async () => {
    const result = await generateImage({
      prompt: 'Hydrogen colour code infographic',
      model: 'google/gemini-3.1-flash-image-preview',
    });

    expect(invokeMock).toHaveBeenCalledWith('generate_openrouter_image', {
      prompt: 'Hydrogen colour code infographic',
      model: 'google/gemini-3.1-flash-image-preview',
    });
    expect(result).toEqual({
      data_url: 'data:image/png;base64,aGVybw==',
      model: 'openai/gpt-5.4-image-2',
    });
  });

  it('rejects blank prompts before invoking OpenRouter', async () => {
    await expect(generateImage({ prompt: '   ', model: 'openai/gpt-5.4-image-2' })).rejects.toThrow(
      'Prompt required',
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('saves generated images into the current article artwork folder', async () => {
    invokeMock.mockResolvedValueOnce({
      path: '/vault/O_Substack/A_Checkmate/_artwork/hero-concept.png',
      name: 'hero-concept.png',
      data_url: 'data:image/png;base64,aGVybw==',
    });

    const saved = await saveGeneratedImageToArtwork({
      articlePath: '/vault/O_Substack/A_Checkmate/Checkmate.md',
      prompt: '  Hero concept  ',
      dataUrl: 'data:image/png;base64,aGVybw==',
    });

    expect(invokeMock).toHaveBeenCalledWith('save_generated_image_to_artwork', {
      articlePath: '/vault/O_Substack/A_Checkmate/Checkmate.md',
      prompt: 'Hero concept',
      dataUrl: 'data:image/png;base64,aGVybw==',
    });
    expect(saved.path).toBe('/vault/O_Substack/A_Checkmate/_artwork/hero-concept.png');
  });

  it('rejects saving a generated image without an article path', async () => {
    await expect(
      saveGeneratedImageToArtwork({
        articlePath: '  ',
        prompt: 'Hero concept',
        dataUrl: 'data:image/png;base64,aGVybw==',
      }),
    ).rejects.toThrow('Article path required');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
