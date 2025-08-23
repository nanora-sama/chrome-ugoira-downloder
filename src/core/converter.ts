// Primary encoders (used in production)
import FastGifencEncoder from './fast-gifenc-encoder';
import StableGifEncoder from './stable-gif-encoder';

// Fallback encoder (kept for compatibility)
import AbsoluteFixEncoder from './absolute-fix-encoder';

import { UgoiraFrame, ConversionOptions } from '../types/ugoira';

export default class GifConverter {
  private defaultOptions: ConversionOptions = {
    quality: 10,
    workers: 0, // Web Workerを完全に無効化
    width: undefined,
    height: undefined,
    transparent: false,
    dither: false,
    debug: false
  };

  /**
   * フレームをGIFに変換
   */
  public async convertToGif(
    frames: UgoiraFrame[], 
    options?: {
      conversionOptions?: Partial<ConversionOptions>;
      onProgress?: (progress: number) => void;
    }
  ): Promise<Blob> {
    const conversionOptions = { ...this.defaultOptions, ...options?.conversionOptions };
    
    console.log('[Converter] Starting GIF conversion with', frames.length, 'frames');
    console.log('[Converter] Options:', conversionOptions);

    // 最新解決策: FastGifencEncoder（タイムアウト対策済みgifenc実装）
    try {
      console.log(`[Converter] Using FastGifencEncoder for ${frames.length} frames`);
      const blob = await FastGifencEncoder.encode(frames, {
        onProgress: options?.onProgress
      });
      console.log('[Converter] FastGifencEncoder completed successfully');
      return blob;
    } catch (error) {
      console.error('[Converter] FastGifencEncoder failed:', error);
    }
    
    // フォールバック1: StableGifEncoder（gif.jsによる安定実装）
    try {
      console.log(`[Converter] Using StableGifEncoder for ${frames.length} frames`);
      const blob = await StableGifEncoder.encode(frames, {
        onProgress: options?.onProgress
      });
      console.log('[Converter] StableGifEncoder completed successfully');
      return blob;
    } catch (error) {
      console.error('[Converter] StableGifEncoder failed:', error);
    }

    // フォールバック2: AbsoluteFixEncoder（各フレームを完全画像化）
    try {
      console.log(`[Converter] Using AbsoluteFixEncoder for ${frames.length} frames`);
      const blob = await AbsoluteFixEncoder.encode(frames, {
        onProgress: options?.onProgress
      });
      console.log('[Converter] AbsoluteFixEncoder completed successfully');
      return blob;
    } catch (error) {
      console.error('[Converter] AbsoluteFixEncoder failed:', error);
    }

    // すべてのエンコーダーが失敗した場合
    throw new Error('All GIF encoders failed. Please try again or report this issue.');
  }
}