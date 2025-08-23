// 直接ダウンロード - ブラウザの標準ダウンロード機能を使用
export class DirectDownloader {
  
  /**
   * 直接ダウンロード（最もシンプルな方法）
   */
  public static download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    
    // aタグを動的に作成
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // body に追加
    document.body.appendChild(link);
    
    // プログラム的にクリック
    link.click();
    
    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`[DirectDownloader] Download triggered: ${filename}`);
  }
  
  /**
   * 複数のダウンロード方法を試す
   */
  public static async tryMultipleDownloadMethods(blob: Blob, filename: string): Promise<void> {
    // 方法1: 通常のダウンロード
    this.download(blob, filename);
    
    // 方法2: Chrome拡張機能APIが使える場合
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // Service Workerにダウンロードを依頼
        await this.downloadViaExtension(blob, filename);
      } catch (error) {
        console.warn('[DirectDownloader] Extension download failed:', error);
      }
    }
  }
  
  /**
   * Chrome拡張機能経由でダウンロード
   */
  private static async downloadViaExtension(blob: Blob, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (!base64) {
          reject(new Error('Failed to convert blob to base64'));
          return;
        }
        
        // Service Workerに送信
        chrome.runtime.sendMessage({
          action: 'forceDownload',
          data: {
            base64: base64,
            filename: filename,
            mimeType: blob.type || 'image/gif'
          }
        }, (response) => {
          if (response?.success) {
            console.log('[DirectDownloader] Extension download completed');
            resolve();
          } else {
            reject(new Error(response?.error || 'Extension download failed'));
          }
        });
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read blob'));
      };
      
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * ダウンロードリンクを作成して自動クリック
   */
  public static createAutoDownloadLink(blob: Blob, filename: string): HTMLAnchorElement {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.cssText = `
      position: fixed;
      top: -100px;
      left: -100px;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    `;
    
    // DOMに追加して即座にクリック
    document.body.appendChild(link);
    
    // 複数回クリックを試みる（ブラウザによって挙動が異なるため）
    setTimeout(() => link.click(), 0);
    setTimeout(() => link.click(), 50);
    setTimeout(() => link.click(), 100);
    
    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
    
    return link;
  }
}

export default DirectDownloader;