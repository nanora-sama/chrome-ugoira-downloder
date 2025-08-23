import { UgoiraInfo, PixivWindow, PixivUgoiraMetaData } from '../types';

class UgoiraDetector {
  private observer: MutationObserver | null = null;
  private detectionCallbacks: Array<(info: UgoiraInfo | null) => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    // URLの変更を監視
    this.observeUrlChanges();
    
    // 初回チェックのタイミングを改善
    this.setupInitialDetection();
  }

  private setupInitialDetection() {
    // 現在のURLがartworksページか確認
    if (!window.location.href.includes('/artworks/')) {
      return;
    }

    // 複数のタイミングでチェックを実行
    const checkStrategies = () => {
      // 即座にチェック
      this.checkCurrentPage();
      
      // 短い遅延後にチェック（React初期レンダリング待ち）
      setTimeout(() => this.checkCurrentPage(), 500);
      setTimeout(() => this.checkCurrentPage(), 1500);
      setTimeout(() => this.checkCurrentPage(), 3000);
      
      // より長い遅延後にもチェック（遅延読み込み対応）
      setTimeout(() => this.checkCurrentPage(), 5000);
    };

    // DOMContentLoadedイベント
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkStrategies);
    } 
    
    // windowのloadイベント（画像等も含めた完全読み込み）
    if (document.readyState !== 'complete') {
      window.addEventListener('load', checkStrategies);
    }
    
    // 既に読み込み済みの場合も実行
    checkStrategies();
    
    // Pixiv特有の読み込み完了を検知
    this.waitForPixivReady();
  }

  private waitForPixivReady() {
    let attempts = 0;
    const maxAttempts = 20;
    const checkInterval = 500;
    
    const checkPixivReady = () => {
      attempts++;
      
      // Pixiv固有のオブジェクトやDOM要素の存在確認
      const isReady = 
        // window.pixivオブジェクトの確認
        (window as any).pixiv?.context ||
        // 作品タイトルの存在確認
        document.querySelector('h1') ||
        // いいねボタンの存在確認
        document.querySelector('button[aria-label*="いいね"], button[aria-label*="Like"]');
      
      if (isReady) {
        console.log('[Detector] Pixiv app seems ready, checking for ugoira');
        this.checkCurrentPage();
        // 念のため少し遅延してもう一度チェック
        setTimeout(() => this.checkCurrentPage(), 1000);
      } else if (attempts < maxAttempts) {
        setTimeout(checkPixivReady, checkInterval);
      }
    };
    
    setTimeout(checkPixivReady, checkInterval);
  }


  private observeUrlChanges() {
    let lastUrl = location.href;
    
    // ブラウザのナビゲーションイベントも監視
    const handleUrlChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (currentUrl.includes('/artworks/')) {
          // URL変更を検知したら複数回チェック
          this.checkCurrentPage();
          setTimeout(() => this.checkCurrentPage(), 500);
          setTimeout(() => this.checkCurrentPage(), 1500);
        }
      }
    };
    
    // popstateイベント（ブラウザの戻る/進む）
    window.addEventListener('popstate', handleUrlChange);
    
    // pushState/replaceStateのオーバーライド（SPA対応）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleUrlChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleUrlChange();
    };
    
    // MutationObserverも併用（フォールバック）
    this.observer = new MutationObserver(() => {
      handleUrlChange();
    });

    // body要素が存在するまで待つ
    const startObserving = () => {
      if (document.body) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        setTimeout(startObserving, 100);
      }
    };
    
    startObserving();
  }

  private lastDetectedInfo: UgoiraInfo | null = null;
  
  private async checkCurrentPage() {
    const info = await this.detectUgoira();
    
    // 前回と同じ情報の場合は通知しない（重複防止）
    if (JSON.stringify(info) === JSON.stringify(this.lastDetectedInfo)) {
      return;
    }
    
    this.lastDetectedInfo = info;
    
    if (info) {
      console.log('[Detector] Ugoira detected:', info);
      this.notifyCallbacks(info);
    } else {
      this.notifyCallbacks(null);
    }
  }

  public async detectUgoira(): Promise<UgoiraInfo | null> {
    // URLからillustIdを取得
    const match = window.location.href.match(/artworks\/(\d+)/);
    if (!match) return null;

    const illustId = match[1];
    
    // うごイラかどうかを判定
    const isUgoira = await this.isUgoiraArtwork(illustId);
    if (!isUgoira) return null;

    // メタデータを取得
    const metadata = await this.getUgoiraMetadata(illustId);
    if (!metadata) return null;

    return {
      illustId: illustId,
      userId: this.getUserId(),
      title: this.getArtworkTitle(),
      frames: metadata.frames.length,
      resolution: '1920x1080',
      zipUrl: metadata.originalSrc || metadata.src
    };
  }

  private async isUgoiraArtwork(illustId: string): Promise<boolean> {
    // 方法1: APIを最初に確認（最も確実）
    try {
      const response = await fetch(`/ajax/illust/${illustId}/ugoira_meta`, {
        credentials: 'include',
        headers: {
          'x-user-id': this.getUserId(),
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          console.log('[Detector] Ugoira confirmed via API');
          return true;
        }
      }
    } catch (e) {
      console.error('[Detector] Error fetching ugoira meta:', e);
    }

    // 方法2: canvas要素の存在確認（DOM要素による確認）
    const canvas = document.querySelector('canvas[role="presentation"]');
    if (canvas) {
      console.log('[Detector] Ugoira confirmed via canvas element');
      return true;
    }

    // 方法3: 再生ボタンの存在確認
    const playButton = document.querySelector('[aria-label*="うごイラ"], button[aria-label*="Play"], button[aria-label*="再生"]');
    if (playButton) {
      console.log('[Detector] Ugoira confirmed via play button');
      return true;
    }

    // 方法4: window.pixivオブジェクトから確認
    try {
      const pixivWindow = window as PixivWindow;
      if (pixivWindow.pixiv?.context?.ugokuIllustData) {
        console.log('[Detector] Ugoira confirmed via window.pixiv');
        return true;
      }
    } catch (e) {
      console.error('[Detector] Error accessing window.pixiv:', e);
    }

    // 方法5: illustTypeをチェック
    try {
      const illustResponse = await fetch(`/ajax/illust/${illustId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (illustResponse.ok) {
        const illustData = await illustResponse.json();
        if (illustData?.body?.illustType === 2) {
          console.log('[Detector] Ugoira confirmed via illustType');
          return true;
        }
      }
    } catch (e) {
      console.error('[Detector] Error fetching illust data:', e);
    }

    return false;
  }

  private async getUgoiraMetadata(illustId: string): Promise<PixivUgoiraMetaData | null> {
    // APIから直接取得（フルURLではなく相対パスを使用）
    try {
      console.log('[Detector] Fetching ugoira metadata for:', illustId);
      const response = await fetch(`/ajax/illust/${illustId}/ugoira_meta`, {
        credentials: 'include',
        headers: {
          'x-user-id': this.getUserId(),
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Detector] Ugoira metadata received:', data);
        if (!data.error && data.body) {
          return {
            illustId: illustId,
            src: data.body.src,
            originalSrc: data.body.originalSrc,
            mime_type: data.body.mime_type,
            frames: data.body.frames
          };
        }
      } else {
        console.error('[Detector] Failed to fetch metadata, status:', response.status);
      }
    } catch (e) {
      console.error('[Detector] Error fetching ugoira meta:', e);
    }

    // フォールバック: window.pixivオブジェクトから取得
    try {
      const pixivWindow = window as PixivWindow;
      if (pixivWindow.pixiv?.context?.ugokuIllustData) {
        console.log('[Detector] Using window.pixiv data');
        return pixivWindow.pixiv.context.ugokuIllustData as PixivUgoiraMetaData;
      }
    } catch (e) {
      console.error('[Detector] Error accessing window.pixiv:', e);
    }

    return null;
  }

  private getUserId(): string {
    // 方法1: window.pixivオブジェクトから取得
    try {
      const pixivWindow = window as PixivWindow;
      if (pixivWindow.pixiv?.user?.id) {
        return pixivWindow.pixiv.user.id;
      }
    } catch (e) {
      console.error('[Detector] Error accessing user ID:', e);
    }

    // 方法2: metaタグから取得
    const metaUserId = document.querySelector('meta[name="global-data"]');
    if (metaUserId) {
      try {
        const content = metaUserId.getAttribute('content');
        if (content) {
          const data = JSON.parse(content);
          if (data.userData?.id) {
            return data.userData.id;
          }
        }
      } catch (e) {
        console.error('[Detector] Error parsing meta data:', e);
      }
    }

    // 方法3: localStorageから取得
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const data = JSON.parse(userData);
        if (data.id) return data.id;
      }
    } catch (e) {
      console.error('[Detector] Error accessing localStorage:', e);
    }

    return '0'; // デフォルト値
  }

  private getArtworkTitle(): string {
    // 方法1: h1タグから取得
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent || '';

    // 方法2: figcaptionから取得
    const figcaption = document.querySelector('figcaption');
    if (figcaption) {
      const titleElement = figcaption.querySelector('div');
      if (titleElement) return titleElement.textContent || '';
    }

    // 方法3: titleタグから取得
    const title = document.title;
    if (title) {
      const match = title.match(/^(.+?)\s*[\-\|]/);
      if (match) return match[1];
    }

    return 'ugoira';
  }

  public onDetection(callback: (info: UgoiraInfo | null) => void) {
    this.detectionCallbacks.push(callback);
  }

  private notifyCallbacks(info: UgoiraInfo | null) {
    this.detectionCallbacks.forEach(callback => callback(info));
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.detectionCallbacks = [];
  }
}

// インスタンスを作成してエクスポート
const detector = new UgoiraDetector();

// グローバルに公開（デバッグ用）
(window as any).ugoiraDetector = detector;

export default detector;