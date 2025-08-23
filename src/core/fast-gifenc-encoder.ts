// Fast Gifenc Encoder - gifencを使用した高速でタイムアウトを回避する実装
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { UgoiraFrame } from '../types/ugoira';

export class FastGifencEncoder {
  /**
   * gifencを使用して高速にGIFをエンコード（タイムアウト対策済み）
   */
  public static async encode(
    frames: UgoiraFrame[],
    options: {
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<Blob> {
    console.log(`[FastGifencEncoder] Starting fast GIF encoding with ${frames.length} frames`);
    
    if (frames.length === 0) {
      throw new Error('No frames to encode');
    }
    
    try {
      // 1. 最初のフレームからサイズを取得
      const firstImage = await this.loadImage(frames[0].blob);
      const width = firstImage.width;
      const height = firstImage.height;
      URL.revokeObjectURL(firstImage.src);
      
      console.log(`[FastGifencEncoder] GIF size: ${width}x${height}`);
      
      // 2. GIFエンコーダーを初期化
      const gif = GIFEncoder();
      
      // 3. 各フレームを処理（バッチ処理でタイムアウト回避）
      const batchSize = 5; // 一度に処理するフレーム数
      const processedFrames: { data: Uint8Array, delay: number }[] = [];
      
      for (let i = 0; i < frames.length; i += batchSize) {
        const batch = frames.slice(i, Math.min(i + batchSize, frames.length));
        
        // バッチ内のフレームを並列処理
        const batchPromises = batch.map(async (frame, index) => {
          const img = await this.loadImage(frame.blob);
          
          // Canvasで画像を処理
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d', {
            alpha: false,
            willReadFrequently: true
          });
          
          if (!ctx) {
            URL.revokeObjectURL(img.src);
            throw new Error('Failed to get canvas context');
          }
          
          // 白背景でクリア
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          
          // 画像を描画（左上固定）
          if (img.width === width && img.height === height) {
            ctx.drawImage(img, 0, 0);
          } else {
            const scale = Math.min(width / img.width, height / img.height);
            const w = Math.floor(img.width * scale);
            const h = Math.floor(img.height * scale);
            ctx.drawImage(img, 0, 0, w, h);
          }
          
          // ImageDataを取得
          const imageData = ctx.getImageData(0, 0, width, height);
          
          // クリーンアップ
          URL.revokeObjectURL(img.src);
          canvas.remove();
          
          return {
            data: new Uint8Array(imageData.data.buffer),
            delay: frame.delay || 100,
            index: i + index
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          processedFrames[result.index] = {
            data: result.data,
            delay: result.delay
          };
        });
        
        // プログレス更新
        if (options.onProgress) {
          options.onProgress(Math.min(i + batchSize, frames.length) / frames.length * 0.7);
        }
        
        // CPUに休憩を与える（タイムアウト回避）
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      console.log('[FastGifencEncoder] All frames processed, starting encoding...');
      
      // 4. グローバルパレットを作成（最初のフレームから）
      const globalPalette = quantize(processedFrames[0].data, 256);
      
      // 5. 各フレームをGIFに追加
      for (let i = 0; i < processedFrames.length; i++) {
        const frame = processedFrames[i];
        
        // パレットを適用
        const indexedData = applyPalette(frame.data, globalPalette);
        
        // フレームを書き込み
        gif.writeFrame(indexedData, width, height, {
          palette: globalPalette,
          delay: frame.delay,
          dispose: 2 // 背景でクリア
        });
        
        // プログレス更新
        if (options.onProgress) {
          options.onProgress(0.7 + (i + 1) / processedFrames.length * 0.3);
        }
        
        // 定期的にCPUに休憩を与える
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // 6. GIFを完成させる
      gif.finish();
      
      // 7. Blobを作成
      const buffer = gif.bytes();
      const blob = new Blob([new Uint8Array(buffer)], { type: 'image/gif' });
      
      console.log(`[FastGifencEncoder] Created GIF, size: ${blob.size} bytes`);
      
      return blob;
      
    } catch (error) {
      console.error('[FastGifencEncoder] Encoding failed:', error);
      throw error;
    }
  }
  
  /**
   * 画像を読み込み
   */
  private static loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
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

export default FastGifencEncoder;