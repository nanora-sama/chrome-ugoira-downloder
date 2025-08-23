// Stable GIF Encoder - gif.jsを使用して確実にフレームをクリアする実装
import { UgoiraFrame } from '../types/ugoira';

export class StableGifEncoder {
  /**
   * gif.jsを使用して完全にフレームをクリアしながらGIFをエンコード
   */
  public static async encode(
    frames: UgoiraFrame[],
    options: {
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<Blob> {
    console.log(`[StableGifEncoder] Starting stable GIF encoding with ${frames.length} frames`);
    
    if (frames.length === 0) {
      throw new Error('No frames to encode');
    }
    
    try {
      // 1. 最初のフレームからサイズを取得
      const firstImage = await this.loadImage(frames[0].blob);
      const width = firstImage.width;
      const height = firstImage.height;
      URL.revokeObjectURL(firstImage.src);
      
      console.log(`[StableGifEncoder] GIF size: ${width}x${height}`);
      
      // 2. gif.jsを動的インポート
      const GIF = (await import('gif.js')).default;
      
      // 3. GIFエンコーダーを初期化（Workerなし、完全同期処理）
      const gif = new GIF({
        workers: 0, // Workerを使わない
        quality: 10,
        width: width,
        height: height,
        repeat: 0, // 無限ループ
        transparent: undefined,
        background: '#ffffff', // 白背景
        workerScript: '' // Workerスクリプトなし
      });
      
      // 4. 各フレームを個別のCanvasで処理
      for (let i = 0; i < frames.length; i++) {
        const img = await this.loadImage(frames[i].blob);
        
        // 新しいCanvasを作成（重要：毎回新規作成）
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: false
        });
        
        if (!ctx) {
          URL.revokeObjectURL(img.src);
          throw new Error('Failed to get canvas context');
        }
        
        // 背景を完全に白でクリア
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 画像を0,0座標から描画（位置固定）
        if (img.width === width && img.height === height) {
          // 同じサイズならそのまま描画
          ctx.drawImage(img, 0, 0);
        } else {
          // サイズが異なる場合はスケール調整
          const scale = Math.min(width / img.width, height / img.height);
          const w = Math.floor(img.width * scale);
          const h = Math.floor(img.height * scale);
          // 左上詰めで配置（座標ズレ防止）
          ctx.drawImage(img, 0, 0, w, h);
        }
        
        // ImageDataをコピーして追加（元のcanvasへの参照を断つ）
        const imageData = ctx.getImageData(0, 0, width, height);
        const newCanvas = document.createElement('canvas');
        newCanvas.width = width;
        newCanvas.height = height;
        const newCtx = newCanvas.getContext('2d');
        if (newCtx) {
          newCtx.putImageData(imageData, 0, 0);
          
          // フレームを追加
          gif.addFrame(newCanvas, {
            delay: frames[i].delay || 100,
            copy: true, // フレームデータをコピー
            dispose: 2  // 背景色でクリア
          });
        }
        
        // クリーンアップ
        URL.revokeObjectURL(img.src);
        canvas.remove();
        newCanvas.remove();
        
        // プログレス報告
        if (options.onProgress) {
          options.onProgress((i + 1) / frames.length * 0.8);
        }
        
        console.log(`[StableGifEncoder] Processed frame ${i + 1}/${frames.length}`);
      }
      
      // 5. GIFを生成
      return new Promise((resolve, reject) => {
        gif.on('finished', (blob: Blob) => {
          console.log(`[StableGifEncoder] Created GIF, size: ${blob.size} bytes`);
          if (options.onProgress) {
            options.onProgress(1);
          }
          resolve(blob);
        });
        
        gif.on('error', (error: Error) => {
          console.error('[StableGifEncoder] GIF generation failed:', error);
          reject(error);
        });
        
        console.log('[StableGifEncoder] Starting GIF rendering...');
        gif.render();
      });
      
    } catch (error) {
      console.error('[StableGifEncoder] Encoding failed:', error);
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

export default StableGifEncoder;