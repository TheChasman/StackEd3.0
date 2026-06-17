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

export async function generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error('Prompt required');
  return invoke<GeneratedImage>('generate_openrouter_image', {
    prompt,
    model: request.model,
  });
}
