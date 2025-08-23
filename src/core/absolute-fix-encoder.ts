// Absolute Fix Encoder - フレーム重なりを絶対に防ぐ最終解決策
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { UgoiraFrame } from '../types/ugoira';

export class AbsoluteFixEncoder {
  /**
   * 絶対的な解決策: 各フレームを完全な画像として処理
   */
  public static async encode(
    frames: UgoiraFrame[],
    options: {
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<Blob> {
    console.log(`[AbsoluteFixEncoder] Starting absolute fix with ${frames.length} frames`);
    
    if (frames.length === 0) {
      throw new Error('No frames to encode');
    }
    
    try {
      // 1. 最初のフレームから基準サイズを取得
      const firstImage = await this.loadImage(frames[0].blob);
      const canvasWidth = firstImage.width;
      const canvasHeight = firstImage.height;
      URL.revokeObjectURL(firstImage.src);
      
      console.log(`[AbsoluteFixEncoder] Canvas size: ${canvasWidth}x${canvasHeight}`);
      
      // 2. 全フレームを完全な画像として準備（差分なし）
      const fullFrames = await this.createFullFrames(
        frames,
        canvasWidth,
        canvasHeight,
        options
      );
      
      // 3. シンプルなGIFエンコード
      return this.createSimpleGif(fullFrames, frames, canvasWidth, canvasHeight, options);
      
    } catch (error) {
      console.error('[AbsoluteFixEncoder] Absolute encoding failed:', error);
      throw error;
    }
  }
  
  /**
   * 各フレームを完全な画像として作成（差分なし、重なりなし）
   */
  private static async createFullFrames(
    frames: UgoiraFrame[],
    width: number,
    height: number,
    options: { onProgress?: (progress: number) => void }
  ): Promise<Uint8Array[]> {
    console.log(`[AbsoluteFixEncoder] Creating ${frames.length} full frames`);
    
    const fullFrames: Uint8Array[] = [];
    
    for (let i = 0; i < frames.length; i++) {
      try {
        // 画像を読み込み
        const img = await this.loadImage(frames[i].blob);
        
        // 完全に新しいキャンバスを作成（前フレームの影響なし）
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: true
        });
        
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        
        // キャンバスを完全にリセット（白背景）
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, width, height);
        
        // 画像のサイズを確認
        let drawWidth = img.width;
        let drawHeight = img.height;
        let drawX = 0;
        let drawY = 0;
        
        // 画像がキャンバスより大きい場合はスケール
        if (img.width !== width || img.height !== height) {
          // アスペクト比を保持してスケール
          const scaleX = width / img.width;
          const scaleY = height / img.height;
          const scale = Math.min(scaleX, scaleY);
          
          drawWidth = Math.floor(img.width * scale);
          drawHeight = Math.floor(img.height * scale);
          
          // 中央配置（ただし整数座標）
          drawX = Math.floor((width - drawWidth) / 2);
          drawY = Math.floor((height - drawHeight) / 2);
        }
        
        // 画像を描画（source-overで完全上書き）
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        
        // RGBデータを取得
        const imageData = ctx.getImageData(0, 0, width, height);
        const rgb = new Uint8Array(width * height * 3);
        
        // RGBA -> RGB変換（アルファなし）
        for (let j = 0, k = 0; j < imageData.data.length; j += 4, k += 3) {
          rgb[k] = imageData.data[j];       // R
          rgb[k + 1] = imageData.data[j + 1]; // G
          rgb[k + 2] = imageData.data[j + 2]; // B
        }
        
        fullFrames.push(rgb);
        
        // クリーンアップ
        URL.revokeObjectURL(img.src);
        canvas.remove();
        
        // プログレス
        if (options.onProgress) {
          options.onProgress((i + 1) / frames.length * 0.7);
        }
        
        console.log(`[AbsoluteFixEncoder] Created full frame ${i + 1}/${frames.length}`);
        
      } catch (error) {
        console.error(`[AbsoluteFixEncoder] Failed to create frame ${i}:`, error);
        // エラーフレームは白フレーム
        const whiteFrame = new Uint8Array(width * height * 3);
        whiteFrame.fill(255);
        fullFrames.push(whiteFrame);
      }
    }
    
    return fullFrames;
  }
  
  /**
   * シンプルなGIF作成（最小限の設定）
   */
  private static async createSimpleGif(
    fullFrames: Uint8Array[],
    originalFrames: UgoiraFrame[],
    width: number,
    height: number,
    options: { onProgress?: (progress: number) => void }
  ): Promise<Blob> {
    console.log(`[AbsoluteFixEncoder] Creating simple GIF`);
    
    // エンコーダー作成
    const gif = GIFEncoder();
    
    // 単純なパレット生成（最初のフレームのみ使用）
    const palette = quantize(fullFrames[0], 256);
    console.log(`[AbsoluteFixEncoder] Created palette with ${palette.length} colors`);
    
    // 各フレームを追加（最小限の設定）
    for (let i = 0; i < fullFrames.length; i++) {
      const rgb = fullFrames[i];
      const indexedData = applyPalette(rgb, palette);
      
      // 最もシンプルな設定
      gif.writeFrame(indexedData, width, height, {
        palette: palette,
        delay: originalFrames[i].delay || 100,
        // disposeを指定しない（デフォルト値を使用）
      });
      
      // プログレス
      if (options.onProgress) {
        options.onProgress(0.7 + (i + 1) / fullFrames.length * 0.3);
      }
    }
    
    // 完了
    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
    
    console.log(`[AbsoluteFixEncoder] Created GIF, size: ${blob.size} bytes`);
    return blob;
  }
  
  /**
   * 画像読み込み
   */
  private static loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        img.src = url;
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }
}

export default AbsoluteFixEncoder;