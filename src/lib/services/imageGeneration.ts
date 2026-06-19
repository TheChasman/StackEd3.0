import { invoke } from '@tauri-apps/api/core';

export const IMAGE_GENERATION_MODELS = [
  { id: 'openai/gpt-5.4-image-2', label: 'ChatGPT Image 2' },
  { id: 'google/gemini-3.1-flash-image-preview', label: 'NanoBanana 2' },
] as const;

export type ImageGenerationModel = (typeof IMAGE_GENERATION_MODELS)[number]['id'];

export interface ImageGenerationRequest {
  prompt: string;
  model: ImageGenerationModel;
}

export interface GeneratedImage {
  data_url: string;
  model: ImageGenerationModel;
}

export interface SavedGeneratedImage {
  name: string;
  path: string;
  data_url: string;
}

export async function generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error('Prompt required');
  return invoke<GeneratedImage>('generate_openrouter_image', {
    prompt,
    model: request.model,
  });
}

export async function saveGeneratedImageToArtwork(params: {
  articlePath: string;
  prompt: string;
  dataUrl: string;
}): Promise<SavedGeneratedImage> {
  const articlePath = params.articlePath.trim();
  if (!articlePath) throw new Error('Article path required');

  const dataUrl = params.dataUrl.trim();
  if (!dataUrl.startsWith('data:image/')) throw new Error('Generated image data URL required');

  return invoke<SavedGeneratedImage>('save_generated_image_to_artwork', {
    articlePath,
    prompt: params.prompt.trim(),
    dataUrl,
  });
}
