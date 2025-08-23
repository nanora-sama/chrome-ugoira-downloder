import detector from './detector';
import { UgoiraInfo } from '../types/ugoira';
import GifConverter from '../core/converter';
import CanvasExtractor from './canvas-extractor';
import OriginalCanvasExtractor from './original-canvas-extractor';
import ZipProcessor from './zip-processor';
import AuthorExtractor from './author-extractor';
import DirectDownloader from './direct-downloader';

class UIInjector {
  private downloadButton: HTMLElement | null = null;
  private progressIndicator: HTMLElement | null = null;
  private currentUgoiraInfo: UgoiraInfo | null = null;
  private converter: GifConverter;
  private extractor: CanvasExtractor;
  private isDownloading = false;

  constructor() {
    this.converter = new GifConverter();
    this.extractor = new CanvasExtractor();
    this.init();
  }

  private init() {
    // うごイラ検出時にUIを注入
    detector.onDetection((info) => {
      this.currentUgoiraInfo = info;
      if (info) {
        console.log('[Injector] Ugoira detected, injecting download button');
        this.injectDownloadButton();
      } else {
        this.removeDownloadButton();
      }
    });

    // 初期化時の検出を強化
    this.setupInitialDetection();
    
    // SPAのナビゲーション対応
    this.observePageChanges();
  }

  private setupInitialDetection() {
    // 現在のURLがartworksページか確認
    if (!window.location.href.includes('/artworks/')) {
      return;
    }

    console.log('[Injector] Setting up initial detection for ugoira page');
    
    // 複数のタイミングで検出を試みる
    const runDetection = async () => {
      const info = await detector.detectUgoira();
      if (info && !this.downloadButton) {
        console.log('[Injector] Initial detection found ugoira');
        this.currentUgoiraInfo = info;
        this.injectDownloadButton();
        return true;
      }
      return false;
    };

    // 即座に実行
    runDetection();
    
    // 段階的な遅延チェック
    const delays = [500, 1000, 2000, 3000, 5000];
    delays.forEach(delay => {
      setTimeout(runDetection, delay);
    });

    // DOMContentLoaded後に実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runDetection, 100);
      });
    }

    // 完全読み込み後に実行
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        setTimeout(runDetection, 100);
      });
    }

    // Pixivアプリケーションの準備完了を待つ
    this.waitForPixivApp(runDetection);
  }

  private waitForPixivApp(callback: () => Promise<boolean>) {
    let attempts = 0;
    const maxAttempts = 30; // 15秒まで待つ
    const checkInterval = 500;
    
    const checkReady = async () => {
      attempts++;
      
      // Pixivアプリの準備状態を確認
      const hasPixivContext = (window as any).pixiv?.context;
      const hasArtworkTitle = document.querySelector('h1');
      const hasActionButtons = document.querySelector('button[aria-label*="いいね"], button[aria-label*="Like"]');
      
      if (hasPixivContext || (hasArtworkTitle && hasActionButtons)) {
        console.log('[Injector] Pixiv app ready, running detection');
        const success = await callback();
        if (!success && attempts < maxAttempts) {
          setTimeout(checkReady, checkInterval);
        }
      } else if (attempts < maxAttempts) {
        setTimeout(checkReady, checkInterval);
      } else {
        console.log('[Injector] Timeout waiting for Pixiv app');
      }
    };
    
    setTimeout(checkReady, checkInterval);
  }


  private observePageChanges() {
    let lastUrl = location.href;
    
    // ページ変更をチェックする関数
    const checkForChanges = async () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        
        if (currentUrl.includes('/artworks/')) {
          console.log('[Injector] URL changed to artwork page, checking for ugoira');
          
          // 複数回チェックを実行
          const checkDelays = [100, 500, 1000, 2000];
          checkDelays.forEach(delay => {
            setTimeout(async () => {
              const info = await detector.detectUgoira();
              if (info && !this.downloadButton) {
                console.log('[Injector] Navigation detected ugoira');
                this.currentUgoiraInfo = info;
                this.injectDownloadButton();
              }
            }, delay);
          });
        }
      }
    };
    
    // ブラウザナビゲーションイベントを監視
    window.addEventListener('popstate', checkForChanges);
    
    // History APIのオーバーライド
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      checkForChanges();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      checkForChanges();
    };
    
    // MutationObserverも使用（フォールバック）
    const observer = new MutationObserver(() => {
      checkForChanges();
    });

    // body要素の存在を確認してから監視開始
    const startObserving = () => {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        setTimeout(startObserving, 100);
      }
    };
    
    startObserving();
  }

  private injectDownloadButton() {
    // 既存のボタンがあれば削除
    this.removeDownloadButton();

    // ボタンを作成
    this.downloadButton = this.createDownloadButton();

    // ボタンを挿入する場所を探す（リトライ機能付き）
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 500;

    const tryInject = () => {
      const targetContainer = this.findButtonContainer();
      if (targetContainer) {
        targetContainer.appendChild(this.downloadButton);
        console.log('[Injector] Download button successfully injected');
      } else if (retryCount < maxRetries) {
        retryCount++;
        console.log(`[Injector] Retrying button injection (${retryCount}/${maxRetries})...`);
        setTimeout(tryInject, retryDelay);
      } else {
        console.error('[Injector] Failed to inject download button after maximum retries');
      }
    };

    tryInject();
  }

  private findButtonContainer(): HTMLElement | null {
    console.log('[Injector] Finding button container...');
    
    // 方法1: いいねボタンを含むセクションを探す（最新のPixivレイアウト）
    const likeButton = document.querySelector('button[data-click-action="click_toggleLike"], button[aria-label*="いいね"], button[aria-label*="Like"]');
    if (likeButton) {
      const section = likeButton.closest('section');
      if (section) {
        console.log('[Injector] Found section via like button');
        // いいねボタンの親要素のフレックスコンテナを探す
        const flexContainer = likeButton.parentElement;
        if (flexContainer) {
          console.log('[Injector] Found flex container for buttons');
          return flexContainer as HTMLElement;
        }
        return section as HTMLElement;
      }
    }

    // 方法2: ブックマークボタンを探す
    const bookmarkButton = document.querySelector('button[data-click-action="click_toggleBookmark"], button[aria-label*="ブックマーク"], button[aria-label*="Bookmark"]');
    if (bookmarkButton) {
      const parent = bookmarkButton.parentElement;
      if (parent) {
        console.log('[Injector] Found parent of bookmark button');
        return parent as HTMLElement;
      }
    }

    // 方法3: アクションボタンエリアを探す（div要素も含める）
    const actionAreas = document.querySelectorAll('section, div[class*="sc-"], div[class*="gtm-"]');
    for (const area of actionAreas) {
      // いいねボタンまたはブックマークボタンを含むエリアを探す
      if (area.querySelector('button[aria-label*="いいね"], button[aria-label*="Like"], button[aria-label*="ブックマーク"], button[aria-label*="Bookmark"]')) {
        console.log('[Injector] Found action area containing buttons');
        // ボタンの直接の親要素を探す
        const buttonParent = area.querySelector('button')?.parentElement;
        if (buttonParent && buttonParent.children.length > 0) {
          console.log('[Injector] Found button parent container');
          return buttonParent as HTMLElement;
        }
        return area as HTMLElement;
      }
    }

    // 方法4: レガシーセレクタ（後方互換性）
    const actionSection = document.querySelector('section.sc-d1c020eb-0');
    if (actionSection) {
      console.log('[Injector] Found action section (legacy)');
      return actionSection as HTMLElement;
    }

    // 方法5: シェアボタンの隣
    const shareButton = document.querySelector('button[aria-label*="シェア"], button[aria-label*="Share"]');
    if (shareButton) {
      const parent = shareButton.parentElement;
      if (parent) {
        console.log('[Injector] Found parent of share button');
        return parent as HTMLElement;
      }
    }

    // 方法6: その他のボタンを探す
    const otherButton = document.querySelector('button[aria-label*="その他"], button[aria-label*="More"], button[aria-label*="Menu"]');
    if (otherButton) {
      const parent = otherButton.parentElement;
      if (parent) {
        console.log('[Injector] Found parent of other button');
        return parent as HTMLElement;
      }
    }

    console.warn('[Injector] Could not find button container - will retry');
    return null;
  }

  private createDownloadButton(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'ugoira-download-wrapper';
    wrapper.style.cssText = `
      margin: 0 8px !important;
      display: inline-block !important;
      position: relative !important;
      width: 48px !important;
      height: 48px !important;
      min-width: 48px !important;
      max-width: 48px !important;
      flex-shrink: 0 !important;
    `;

    // プログレスインジケーター（ボタンの外側に配置）
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'ugoira-progress-indicator';
    progressIndicator.style.cssText = `
      display: none;
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      color: #0096FA;
      font-weight: bold;
      text-align: center;
      line-height: 1.3;
      white-space: nowrap;
      background: rgba(255, 255, 255, 0.95);
      padding: 2px 6px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    `;
    this.progressIndicator = progressIndicator;

    const button = document.createElement('button');
    button.className = 'ugoira-download-btn';
    button.setAttribute('aria-label', 'うごイラをGIFでダウンロード');
    button.setAttribute('type', 'button');
    
    // Pixivのボタンスタイルに合わせる（固定サイズ）
    button.style.cssText = `
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 48px !important;
      height: 48px !important;
      min-width: 48px !important;
      min-height: 48px !important;
      max-width: 48px !important;
      max-height: 48px !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 50% !important;
      background: linear-gradient(135deg, #0096FA 0%, #0073E6 100%) !important;
      color: white !important;
      font-size: 14px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 2px 4px rgba(0, 115, 230, 0.2) !important;
      flex-shrink: 0 !important;
      position: relative !important;
      overflow: visible !important;
    `;

    // ホバーエフェクト
    button.onmouseenter = () => {
      if (!this.isDownloading) {
        button.style.background = 'linear-gradient(135deg, #00A8FF 0%, #0080FF 100%) !important';
        button.style.boxShadow = '0 4px 8px rgba(0, 115, 230, 0.3) !important';
        button.style.transform = 'translateY(-1px) !important';
      }
    };

    button.onmouseleave = () => {
      if (!this.isDownloading) {
        button.style.background = 'linear-gradient(135deg, #0096FA 0%, #0073E6 100%) !important';
        button.style.boxShadow = '0 2px 4px rgba(0, 115, 230, 0.2) !important';
        button.style.transform = 'translateY(0) !important';
      }
    };

    // Material Icon風のダウンロードアイコン（固定サイズ、強制適用）
    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = `
      width: 48px !important;
      height: 48px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: none !important;
    `;
    
    svgContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" 
           viewBox="0 0 24 24" 
           fill="white"
           style="
             width: 36px !important;
             height: 36px !important;
             display: block !important;
           ">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    `;
    
    button.appendChild(svgContainer);

    button.addEventListener('click', () => this.handleDownload());

    wrapper.appendChild(button);
    wrapper.appendChild(progressIndicator);
    return wrapper;
  }

  private async handleDownload() {
    if (this.isDownloading || !this.currentUgoiraInfo) return;

    this.isDownloading = true;
    this.updateButtonState(true);
    this.updateProgressStatus('準備中...', '');

    try {
      // メタデータを取得
      this.updateProgressStatus('メタデータ取得中...', '');
      const metadata = await this.getUgoiraMetadata();
      
      // まずZIPファイルからオリジナルサイズの画像を取得
      let frames;
      try {
        console.log('[Injector] Attempting to download original ZIP file...');
        const zipProcessor = new ZipProcessor();
        frames = await zipProcessor.getOriginalFrames(
          this.currentUgoiraInfo.illustId,
          metadata,
          (status, detail) => this.updateProgressStatus(status, detail)
        );
        console.log('[Injector] Successfully extracted original size frames from ZIP');
        
        // メモリクリーンアップ
        zipProcessor.cleanup();
        
      } catch (error) {
        console.log('[Injector] Failed to process ZIP, trying Canvas extraction...', error);
        
        // フォールバック1: オリジナルサイズのCanvasを試す
        try {
          this.updateProgressStatus('高解像度Canvas検索中...', '');
          const originalExtractor = new OriginalCanvasExtractor();
          frames = await originalExtractor.captureOriginalFrames(metadata);
          console.log('[Injector] Successfully captured original size frames');
        } catch (error2) {
          console.log('[Injector] Failed to get original canvas, falling back to standard canvas');
          // フォールバック2: 通常のCanvasからフレームをキャプチャ
          const extractor = new CanvasExtractor();
          frames = await this.captureFramesWithProgress(extractor, metadata);
        }
      }
      
      if (frames.length === 0) {
        throw new Error('フレームのキャプチャに失敗しました');
      }

      // GIFに変換（プログレス付き）
      let processedFrames = 0;
      const totalFrames = frames.length;
      
      // フレーム数が多い場合の処理メッセージ
      if (totalFrames > 100) {
        this.updateProgressStatus('処理中...', `${totalFrames}フレーム分割処理`);
      } else {
        this.updateProgressStatus('GIF変換中...', `0/${totalFrames}`);
      }
      
      const gifBlob = await this.converter.convertToGif(frames, {
        onProgress: (progress: number) => {
          if (totalFrames > 100) {
            // 分割処理の場合
            if (progress < 0.5) {
              // 前半: フレーム処理
              const processPercent = Math.floor(progress * 200);
              this.updateProgressStatus('フレーム処理中...', `${processPercent}%`);
            } else {
              // 後半: GIF結合
              const mergePercent = Math.floor((progress - 0.5) * 200);
              this.updateProgressStatus('GIF結合中...', `${mergePercent}%`);
            }
          } else {
            // 通常処理
            processedFrames = Math.floor(totalFrames * progress);
            this.updateProgressStatus('GIF変換中...', `${processedFrames}/${totalFrames}`);
          }
        }
      });

      // ダウンロード
      this.updateProgressStatus('保存中...', '');
      
      // ファイル名と拡張子を決定（ZIPの場合は.zip、そうでなければ.gif）
      const isZip = gifBlob.type === 'application/zip' || gifBlob.type === 'application/x-zip-compressed';
      const extension = isZip ? 'zip' : 'gif';
      
      // 投稿者名を取得（非同期で確実に取得）
      const authorName = await AuthorExtractor.getAuthorName(this.currentUgoiraInfo.illustId);
      const title = this.currentUgoiraInfo.title || 'ugoira';
      const filename = `${authorName}_${title}.${extension}`;
      
      await this.downloadFile(gifBlob, filename);

      this.updateProgressStatus('完了！', '✓');
      setTimeout(() => {
        this.hideProgress();
        this.isDownloading = false;
        this.updateButtonState(false);
      }, 1500);

    } catch (error) {
      console.error('[Injector] Download error:', error);
      this.showError(error instanceof Error ? error.message : '不明なエラーが発生しました');
      this.isDownloading = false;
      this.updateButtonState(false);
    }
  }
  
  private async getUgoiraMetadata(): Promise<any> {
    try {
      // APIからメタデータを取得
      const response = await fetch(`/ajax/illust/${this.currentUgoiraInfo?.illustId}/ugoira_meta`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!data.error && data.body) {
          return data.body;
        }
      }
    } catch (error) {
      console.error('[Injector] Failed to fetch metadata:', error);
    }
    
    return null;
  }
  

  private updateButtonState(downloading: boolean) {
    if (!this.downloadButton) return;
    
    const button = this.downloadButton.querySelector('button');
    if (!button) return;

    if (downloading) {
      button.style.background = 'linear-gradient(135deg, #666 0%, #444 100%)';
      button.style.cursor = 'not-allowed';
      button.disabled = true;
    } else {
      button.style.background = 'linear-gradient(135deg, #0096FA 0%, #0073E6 100%)';
      button.style.cursor = 'pointer';
      button.disabled = false;
    }
  }

  private updateProgressStatus(status: string, detail: string) {
    if (this.progressIndicator) {
      this.progressIndicator.style.display = 'block';
      
      // ステータスと詳細を2行で表示
      if (detail) {
        this.progressIndicator.innerHTML = `
          <div style="white-space: nowrap;">${status}</div>
          <div style="white-space: nowrap; font-size: 10px; opacity: 0.8;">${detail}</div>
        `;
      } else {
        this.progressIndicator.innerHTML = `<div style="white-space: nowrap;">${status}</div>`;
      }
      
      // 完了時の色変更
      if (status === '完了！') {
        this.progressIndicator.style.color = '#28a745';
      } else {
        this.progressIndicator.style.color = '#0096FA';
      }
    }
  }
  
  private async captureFramesWithProgress(extractor: CanvasExtractor, metadata: any) {
    // 全フレームをキャプチャ（間引きなし）
    const totalFrames = metadata?.frames?.length || 30;
    const frames = [];
    
    // Canvasを見つける
    const canvas = extractor.findUgoiraCanvas();
    if (!canvas) {
      throw new Error('うごイラのCanvasが見つかりません');
    }
    
    // Canvasサイズを取得
    const width = canvas.width;
    const height = canvas.height;
    console.log(`[Injector] Canvas size: ${width}x${height}`);
    
    // 再生を開始
    this.updateProgressStatus('再生開始中...', '');
    const playButton = document.querySelector('button[aria-label*="うごイラ"]') as HTMLButtonElement;
    if (playButton) {
      playButton.click();
    }
    
    // 少し待つ
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // バッチサイズ（一度に処理するフレーム数）
    const batchSize = 10;
    const totalBatches = Math.ceil(totalFrames / batchSize);
    
    // フレームをバッチでキャプチャ
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalFrames);
      
      for (let i = startIndex; i < endIndex; i++) {
        this.updateProgressStatus('キャプチャ中...', `${i + 1}/${totalFrames}`);
        
        try {
          // より高品質なキャプチャ方法：ImageDataを直接取得してからBlobに変換
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext('2d', {
            willReadFrequently: false,
            alpha: false
          });
          
          if (tempCtx) {
            // 現在のCanvasの内容をコピー
            tempCtx.drawImage(canvas, 0, 0, width, height);
            
            // 高品質でBlobに変換（JPEGで最高品質）
            const blob = await new Promise<Blob>((resolve, reject) => {
              tempCanvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Failed to capture frame'));
                }
              }, 'image/jpeg', 1.0); // JPEG形式で最高品質（1.0）
            });
            
            const delay = metadata?.frames?.[i]?.delay || 100;
            frames.push({
              blob: blob,
              delay: delay,
              filename: `frame_${i.toString().padStart(4, '0')}.jpg`
            });
            
            // 一時Canvasをクリーンアップ
            tempCanvas.remove();
          }
          
        } catch (error) {
          console.error(`[Injector] Failed to capture frame ${i}:`, error);
        }
        
        // 次のフレームまで待機
        const delay = metadata?.frames?.[i]?.delay || 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // バッチ間で少し待機（ブラウザに制御を返す）
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    console.log(`[Injector] Captured all ${frames.length} frames with size ${width}x${height}`);
    
    return frames;
  }

  private hideProgress() {
    if (this.progressIndicator) {
      this.progressIndicator.style.display = 'none';
    }
  }

  private showError(message: string) {
    if (this.progressIndicator) {
      this.progressIndicator.style.display = 'inline-block';
      this.progressIndicator.style.color = '#dc3545';
      this.progressIndicator.textContent = 'エラー';
      this.progressIndicator.title = message;
    }
    
    // エラーメッセージをアラートで表示（簡易的）
    console.error('[Injector] Error:', message);
    
    setTimeout(() => {
      this.hideProgress();
    }, 3000);
  }

  private async downloadFile(blob: Blob, filename: string) {
    // ZIPファイルの場合はログを出さない
    const isZip = blob.type === 'application/zip' || blob.type === 'application/x-zip-compressed';
    if (!isZip) {
      console.log(`[Injector] Starting download: ${filename} (${blob.size} bytes)`);
    }
    
    // 優先方法: 直接ダウンロード（最もシンプルで確実）
    try {
      DirectDownloader.download(blob, filename);
      return Promise.resolve();
    } catch (error) {
      if (!isZip) {
        console.log(`[Injector] Direct download failed: ${error}`);
      }
    }
    
    // フォールバック: Service Worker経由で自動ダウンロード
    try {
      return await this.autoDownloadViaServiceWorker(blob, filename);
    } catch (error) {
      if (!isZip) {
        console.log(`[Injector] Service Worker download failed: ${error}`);
      }
      // 最終的にエラーを投げる
      throw new Error('Download failed. Please check your browser settings.');
    }
  }
  
  private async autoDownloadViaServiceWorker(blob: Blob, filename: string): Promise<void> {
    const isZip = blob.type === 'application/zip' || blob.type === 'application/x-zip-compressed';
    if (!isZip) {
      console.log(`[Injector] Using Service Worker for automatic download: ${filename}`);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (!base64Data) {
          reject(new Error('Failed to convert blob to base64'));
          return;
        }
        
        chrome.runtime.sendMessage({
          action: 'silentDownload',
          data: {
            base64: base64Data,
            filename: filename,
            size: blob.size
          }
        }, (response) => {
          if (response?.success) {
            console.log(`[Injector] Auto-download completed: ${filename}`);
            resolve();
          } else {
            reject(new Error(response?.error || 'Auto-download failed'));
          }
        });
      };
      reader.onerror = () => {
        reject(new Error('Failed to read blob'));
      };
      reader.readAsDataURL(blob);
    });
  }
  

  private removeDownloadButton() {
    if (this.downloadButton) {
      this.downloadButton.remove();
      this.downloadButton = null;
    }
  }

  public destroy() {
    this.removeDownloadButton();
    this.extractor.clear();
  }
}

// スタイルを追加
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// インスタンスを作成
const injector = new UIInjector();

// グローバルに公開（デバッグ用）
(window as any).ugoiraInjector = injector;

export default injector;