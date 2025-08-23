// オリジナルサイズのCanvas要素を取得するクラス

import { UgoiraFrame } from '../types/ugoira';

class OriginalCanvasExtractor {
  /**
   * オリジナルサイズのCanvasを探す
   */
  public async findOriginalCanvas(): Promise<HTMLCanvasElement | null> {
    console.log('[OriginalCanvasExtractor] Searching for original canvas...');
    
    // 方法1: 既存のフルサイズCanvasを探す
    const allCanvas = document.querySelectorAll('canvas');
    for (const canvas of allCanvas) {
      const c = canvas as HTMLCanvasElement;
      console.log(`[OriginalCanvasExtractor] Found canvas: ${c.width}x${c.height}`);
      
      // 1920x1080などの高解像度Canvasを探す
      if (c.width > 1000 || c.height > 1000) {
        console.log(`[OriginalCanvasExtractor] Found high-res canvas: ${c.width}x${c.height}`);
        return c;
      }
    }
    
    // 方法2: プレゼンテーションCanvasの親要素をクリックして拡大版を開く
    const presentationCanvas = document.querySelector('canvas[role="presentation"]') as HTMLCanvasElement;
    if (presentationCanvas) {
      console.log('[OriginalCanvasExtractor] Attempting to open full size view...');
      
      // Canvasの親要素（通常はボタンかリンク）を探す
      let clickTarget: HTMLElement = presentationCanvas;
      let parent = presentationCanvas.parentElement;
      
      // クリック可能な親要素を探す
      while (parent && parent !== document.body) {
        if (parent.tagName === 'BUTTON' || parent.tagName === 'A' || 
            parent.style.cursor === 'pointer' || parent.onclick) {
          clickTarget = parent;
          console.log(`[OriginalCanvasExtractor] Found clickable parent: ${parent.tagName}`);
          break;
        }
        parent = parent.parentElement;
      }
      
      // クリックイベントを複数の方法で試す
      console.log('[OriginalCanvasExtractor] Clicking to open full size...');
      
      // 方法1: 通常のクリックイベント
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      clickTarget.dispatchEvent(clickEvent);
      
      // 方法2: ポインターイベント
      const pointerDown = new PointerEvent('pointerdown', { bubbles: true });
      const pointerUp = new PointerEvent('pointerup', { bubbles: true });
      clickTarget.dispatchEvent(pointerDown);
      clickTarget.dispatchEvent(pointerUp);
      
      // より長く待つ（モーダルの表示を待つ）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // モーダルやポップアップ内の新しいCanvasを探す
      const modalCanvas = await this.findModalCanvas();
      if (modalCanvas) {
        return modalCanvas;
      }
      
      // 再度すべてのCanvasをチェック（新しく作成されたものを含む）
      const allCanvasAfterClick = document.querySelectorAll('canvas');
      console.log(`[OriginalCanvasExtractor] Found ${allCanvasAfterClick.length} canvas elements after click`);
      
      for (const canvas of allCanvasAfterClick) {
        const c = canvas as HTMLCanvasElement;
        console.log(`[OriginalCanvasExtractor] Canvas after click: ${c.width}x${c.height}`);
        if (c.width > 1000 || c.height > 1000) {
          console.log(`[OriginalCanvasExtractor] Found high-res canvas after click: ${c.width}x${c.height}`);
          return c;
        }
      }
      
      // 表示されているが異なるサイズのCanvasを探す
      for (const canvas of allCanvasAfterClick) {
        const c = canvas as HTMLCanvasElement;
        // 元のCanvasと異なり、かつより大きいサイズ
        if (c !== presentationCanvas && 
            (c.width > presentationCanvas.width || c.height > presentationCanvas.height)) {
          console.log(`[OriginalCanvasExtractor] Found larger canvas: ${c.width}x${c.height}`);
          return c;
        }
      }
    }
    
    // 方法3: video要素を探す（Pixivはvideoを使用している可能性）
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      console.log(`[OriginalCanvasExtractor] Found video: ${video.videoWidth}x${video.videoHeight}`);
      if (video.videoWidth > 1000 || video.videoHeight > 1000) {
        // videoからCanvasを作成
        return this.createCanvasFromVideo(video);
      }
    }
    
    return null;
  }
  
  /**
   * モーダル内のCanvasを探す
   */
  private async findModalCanvas(): Promise<HTMLCanvasElement | null> {
    // 一般的なモーダルセレクタ
    const modalSelectors = [
      '[role="dialog"] canvas',
      '[role="presentation"] canvas',
      '[aria-modal="true"] canvas',
      '.modal canvas',
      '[class*="modal"] canvas',
      '[class*="Modal"] canvas',
      '[class*="fullscreen"] canvas',
      '[class*="Fullscreen"] canvas',
      '[class*="viewer"] canvas',
      '[class*="Viewer"] canvas',
      '[class*="lightbox"] canvas',
      '[class*="overlay"] canvas',
      '[class*="popup"] canvas',
      'div[style*="fixed"] canvas',
      'div[style*="z-index"] canvas'
    ];
    
    console.log('[OriginalCanvasExtractor] Searching for modal canvas...');
    
    for (const selector of modalSelectors) {
      const canvases = document.querySelectorAll(selector);
      for (const canvas of canvases) {
        const c = canvas as HTMLCanvasElement;
        console.log(`[OriginalCanvasExtractor] Found modal canvas with selector "${selector}": ${c.width}x${c.height}`);
        
        // 高解像度のCanvasを優先
        if (c.width > 1000 || c.height > 1000) {
          console.log(`[OriginalCanvasExtractor] Using high-res modal canvas: ${c.width}x${c.height}`);
          return c;
        }
      }
    }
    
    // z-indexが高い要素内のCanvasを探す
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const style = window.getComputedStyle(element);
      const zIndex = parseInt(style.zIndex || '0', 10);
      
      if (zIndex > 1000) { // 高いz-indexを持つ要素
        const canvas = element.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          console.log(`[OriginalCanvasExtractor] Found canvas in high z-index element: ${canvas.width}x${canvas.height}`);
          return canvas;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Video要素からCanvasを作成
   */
  private createCanvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    
    console.log(`[OriginalCanvasExtractor] Created canvas from video: ${canvas.width}x${canvas.height}`);
    return canvas;
  }
  
  /**
   * 内部データからオリジナルサイズを取得
   */
  public async getOriginalFrames(_metadata?: any): Promise<UgoiraFrame[] | null> {
    console.log('[OriginalCanvasExtractor] Attempting to get original frames...');
    
    // Pixivの内部オブジェクトを探す
    const pixivUtil = (window as any).pixiv;
    if (pixivUtil) {
      console.log('[OriginalCanvasExtractor] Found pixiv object:', pixivUtil);
      
      // うごイラプレーヤーを探す
      if (pixivUtil.ugoiraPlayer) {
        console.log('[OriginalCanvasExtractor] Found ugoiraPlayer:', pixivUtil.ugoiraPlayer);
      }
      
      // コンテキストデータを探す
      if (pixivUtil.context) {
        console.log('[OriginalCanvasExtractor] Found context:', pixivUtil.context);
      }
    }
    
    // React Fiberノードから内部データを取得
    const reactRoot = document.querySelector('#root') || document.querySelector('[id*="react"]');
    if (reactRoot) {
      const reactInternalInstance = this.getReactInternalInstance(reactRoot);
      if (reactInternalInstance) {
        console.log('[OriginalCanvasExtractor] Found React internal instance:', reactInternalInstance);
      }
    }
    
    // グローバルスコープでうごイラ関連のオブジェクトを探す
    const globalKeys = Object.keys(window);
    const ugoiraRelatedKeys = globalKeys.filter(key => 
      key.toLowerCase().includes('ugoira') || 
      key.toLowerCase().includes('illust') ||
      key.toLowerCase().includes('canvas')
    );
    
    if (ugoiraRelatedKeys.length > 0) {
      console.log('[OriginalCanvasExtractor] Found ugoira-related global keys:', ugoiraRelatedKeys);
      ugoiraRelatedKeys.forEach(key => {
        console.log(`[OriginalCanvasExtractor] ${key}:`, (window as any)[key]);
      });
    }
    
    return null;
  }
  
  /**
   * React内部インスタンスを取得
   */
  private getReactInternalInstance(element: Element): any {
    const key = Object.keys(element).find(key => 
      key.startsWith('__reactInternalInstance') || 
      key.startsWith('__reactFiber')
    );
    
    if (key) {
      return (element as any)[key];
    }
    
    return null;
  }
  
  /**
   * オリジナルサイズのCanvasからフレームをキャプチャ
   */
  public async captureOriginalFrames(metadata: any): Promise<UgoiraFrame[]> {
    const frames: UgoiraFrame[] = [];
    
    // オリジナルCanvasを探す
    const originalCanvas = await this.findOriginalCanvas();
    
    if (!originalCanvas) {
      console.warn('[OriginalCanvasExtractor] Could not find original canvas');
      throw new Error('Original canvas not found');
    }
    
    console.log(`[OriginalCanvasExtractor] Using canvas: ${originalCanvas.width}x${originalCanvas.height}`);
    
    // フレーム数を取得
    const frameCount = metadata?.frames?.length || 30;
    
    // 再生ボタンをクリック
    const playButton = document.querySelector('button[aria-label*="うごイラ"]') as HTMLButtonElement;
    if (playButton) {
      playButton.click();
    }
    
    // 少し待つ
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 各フレームをキャプチャ
    for (let i = 0; i < frameCount; i++) {
      try {
        // 高品質でキャプチャ
        const blob = await new Promise<Blob>((resolve, reject) => {
          originalCanvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to capture frame'));
            }
          }, 'image/png'); // PNG形式で最高品質
        });
        
        const delay = metadata?.frames?.[i]?.delay || 100;
        frames.push({
          blob: blob,
          delay: delay,
          filename: `frame_${i.toString().padStart(4, '0')}.png`
        });
        
        console.log(`[OriginalCanvasExtractor] Captured frame ${i + 1}/${frameCount} (${originalCanvas.width}x${originalCanvas.height})`);
        
        // 次のフレームまで待機
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`[OriginalCanvasExtractor] Failed to capture frame ${i}:`, error);
      }
    }
    
    // モーダルを閉じる（開いていた場合）
    const closeButton = document.querySelector('[aria-label*="閉じる"]') as HTMLElement;
    if (closeButton) {
      closeButton.click();
    }
    
    return frames;
  }
}

export default OriginalCanvasExtractor;