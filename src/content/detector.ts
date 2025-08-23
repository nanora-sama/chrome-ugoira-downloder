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
    
    // 初回チェック
    this.checkCurrentPage();
  }

  private observeUrlChanges() {
    let lastUrl = location.href;
    
    this.observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.checkCurrentPage();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private async checkCurrentPage() {
    const info = await this.detectUgoira();
    
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
    // 方法1: canvas要素の存在確認
    const canvas = document.querySelector('canvas[role="presentation"]');
    if (canvas) return true;

    // 方法2: 再生ボタンの存在確認
    const playButton = document.querySelector('[aria-label*="うごイラ"]');
    if (playButton) return true;

    // 方法3: window.pixivオブジェクトから確認
    try {
      const pixivWindow = window as PixivWindow;
      if (pixivWindow.pixiv?.context?.ugokuIllustData) {
        return true;
      }
    } catch (e) {
      console.error('[Detector] Error accessing window.pixiv:', e);
    }

    // 方法4: APIを直接呼び出して確認
    try {
      const response = await fetch(`/ajax/illust/${illustId}/ugoira_meta`, {
        credentials: 'include',
        headers: {
          'x-user-id': this.getUserId()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return !data.error;
      }
    } catch (e) {
      console.error('[Detector] Error fetching ugoira meta:', e);
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