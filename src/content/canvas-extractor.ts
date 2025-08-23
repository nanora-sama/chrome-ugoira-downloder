// Canvas要素から画像フレームを抽出するクラス

import { UgoiraFrame } from '../types/ugoira';

class CanvasExtractor {
  private canvas: HTMLCanvasElement | null = null;
  private frames: UgoiraFrame[] = [];
  private isCapturing = false;
  private captureInterval: number | null = null;
  
  /**
   * ページ内のうごイラCanvasを見つける
   */
  public findUgoiraCanvas(): HTMLCanvasElement | null {
    // Pixivのうごイラは通常、role="presentation"のcanvas要素
    const canvas = document.querySelector('canvas[role="presentation"]') as HTMLCanvasElement;
    if (canvas) {
      console.log('[CanvasExtractor] Found ugoira canvas');
      this.canvas = canvas;
      return canvas;
    }
    
    // 代替: 他のcanvas要素を探す
    const allCanvas = document.querySelectorAll('canvas');
    for (const c of allCanvas) {
      const canvas = c as HTMLCanvasElement;
      // サイズが大きいcanvasを探す（うごイラの可能性が高い）
      if (canvas.width > 100 && canvas.height > 100) {
        console.log('[CanvasExtractor] Found potential ugoira canvas');
        this.canvas = canvas;
        return canvas;
      }
    }
    
    console.warn('[CanvasExtractor] No ugoira canvas found');
    return null;
  }
  
  /**
   * Canvasから現在のフレームをキャプチャ
   */
  private captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas not found'));
        return;
      }
      
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture frame'));
        }
      }, 'image/png');
    });
  }
  
  /**
   * うごイラの全フレームをキャプチャ
   */
  public async captureAllFrames(frameCount: number = 30, delay: number = 100): Promise<UgoiraFrame[]> {
    if (!this.canvas) {
      this.findUgoiraCanvas();
    }
    
    if (!this.canvas) {
      throw new Error('Ugoira canvas not found');
    }
    
    console.log(`[CanvasExtractor] Starting capture of ${frameCount} frames`);
    this.frames = [];
    this.isCapturing = true;
    
    // 再生ボタンをクリックして再生開始
    this.startPlayback();
    
    // 最初のフレームを待つ
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 一定間隔でフレームをキャプチャ
    for (let i = 0; i < frameCount; i++) {
      if (!this.isCapturing) break;
      
      try {
        const blob = await this.captureFrame();
        this.frames.push({
          blob: blob,
          delay: delay,
          filename: `frame_${i.toString().padStart(4, '0')}.png`
        });
        console.log(`[CanvasExtractor] Captured frame ${i + 1}/${frameCount}`);
      } catch (error) {
        console.error(`[CanvasExtractor] Failed to capture frame ${i}:`, error);
      }
      
      // 次のフレームまで待機
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.isCapturing = false;
    console.log(`[CanvasExtractor] Capture complete, ${this.frames.length} frames captured`);
    
    return this.frames;
  }
  
  /**
   * うごイラの再生を開始
   */
  private startPlayback() {
    // 再生ボタンを探してクリック
    const playButton = document.querySelector('button[aria-label*="うごイラ"]') as HTMLButtonElement;
    if (playButton) {
      playButton.click();
      console.log('[CanvasExtractor] Started playback');
      return;
    }
    
    // Canvasをクリックして再生を開始
    if (this.canvas) {
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      this.canvas.dispatchEvent(event);
      console.log('[CanvasExtractor] Clicked canvas to start playback');
    }
  }
  
  /**
   * メタデータからフレーム情報を取得してキャプチャ
   */
  public async captureWithMetadata(metadata: any): Promise<UgoiraFrame[]> {
    if (!metadata || !metadata.frames) {
      return this.captureAllFrames();
    }
    
    const frameCount = metadata.frames.length;
    const avgDelay = metadata.frames.reduce((sum: number, f: any) => sum + f.delay, 0) / frameCount;
    
    console.log(`[CanvasExtractor] Using metadata: ${frameCount} frames, avg delay: ${avgDelay}ms`);
    
    if (!this.canvas) {
      this.findUgoiraCanvas();
    }
    
    if (!this.canvas) {
      throw new Error('Ugoira canvas not found');
    }
    
    this.frames = [];
    this.isCapturing = true;
    
    // 再生開始
    this.startPlayback();
    
    // メタデータに基づいてフレームをキャプチャ
    for (let i = 0; i < metadata.frames.length && this.isCapturing; i++) {
      const frameInfo = metadata.frames[i];
      
      try {
        const blob = await this.captureFrame();
        this.frames.push({
          blob: blob,
          delay: frameInfo.delay,
          filename: frameInfo.file || `frame_${i.toString().padStart(4, '0')}.png`
        });
        console.log(`[CanvasExtractor] Captured frame ${i + 1}/${frameCount}`);
      } catch (error) {
        console.error(`[CanvasExtractor] Failed to capture frame ${i}:`, error);
      }
      
      // 次のフレームまで待機
      await new Promise(resolve => setTimeout(resolve, frameInfo.delay));
    }
    
    this.isCapturing = false;
    console.log(`[CanvasExtractor] Capture complete with metadata`);
    
    return this.frames;
  }
  
  /**
   * キャプチャを停止
   */
  public stopCapture() {
    this.isCapturing = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }
  
  /**
   * キャプチャしたフレームを取得
   */
  public getFrames(): UgoiraFrame[] {
    return this.frames;
  }
  
  /**
   * リソースをクリア
   */
  public clear() {
    this.stopCapture();
    this.frames = [];
    this.canvas = null;
  }
}

export default CanvasExtractor;