// ZIPファイルをダウンロードして処理するクラス

import JSZip from 'jszip';
import { UgoiraFrame } from '../types/ugoira';

class ZipProcessor {
  /**
   * ZIPファイルをダウンロードして展開
   */
  public async downloadAndExtractZip(
    zipUrl: string, 
    metadata: any,
    onProgress?: (status: string, detail: string) => void
  ): Promise<UgoiraFrame[]> {
    const frames: UgoiraFrame[] = [];
    
    try {
      // プログレス通知
      if (onProgress) {
        onProgress('ZIPダウンロード中...', '');
      }
      
      // ZIPファイルをダウンロード
      console.log('[ZipProcessor] Downloading ZIP from:', zipUrl);
      const zipBlob = await this.downloadZipWithAuth(zipUrl);
      
      if (!zipBlob) {
        throw new Error('Failed to download ZIP file');
      }
      
      console.log(`[ZipProcessor] ZIP downloaded, size: ${zipBlob.size} bytes`);
      
      // プログレス通知
      if (onProgress) {
        onProgress('ZIP展開中...', `${Math.round(zipBlob.size / 1024 / 1024 * 10) / 10}MB`);
      }
      
      // ZIPを展開
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipBlob);
      
      // ファイル一覧を取得
      const fileNames = Object.keys(zipContent.files).filter(name => 
        name.endsWith('.jpg') || name.endsWith('.png')
      ).sort();
      
      console.log(`[ZipProcessor] Found ${fileNames.length} image files in ZIP`);
      
      // 各画像ファイルを処理
      for (let i = 0; i < fileNames.length; i++) {
        const fileName = fileNames[i];
        const file = zipContent.files[fileName];
        
        if (onProgress) {
          onProgress('画像処理中...', `${i + 1}/${fileNames.length}`);
        }
        
        // 画像データをBlobとして取得
        const blob = await file.async('blob');
        
        // メタデータから遅延時間を取得
        const delay = metadata?.frames?.[i]?.delay || 100;
        
        frames.push({
          blob: blob,
          delay: delay,
          filename: fileName
        });
        
        console.log(`[ZipProcessor] Processed frame ${i + 1}/${fileNames.length}`);
      }
      
      console.log(`[ZipProcessor] Successfully extracted ${frames.length} frames from ZIP`);
      
      // メモリクリーンアップ
      // ZIPファイルのBlobをリリース
      if (zipBlob instanceof Blob) {
        // Blobのメモリは自動的にガベージコレクションされる
      }
      
      return frames;
      
    } catch (error) {
      console.error('[ZipProcessor] Failed to process ZIP:', error);
      throw error;
    }
  }
  
  /**
   * curl風の認証付きZIPダウンロード
   */
  private async downloadZipWithAuth(zipUrl: string): Promise<Blob | null> {
    try {
      // 方法1: curl風のネイティブリクエスト（最も確実）
      console.log('[ZipProcessor] Attempting curl-like native download...');
      const curlBlob = await this.downloadViaCurlLike(zipUrl);
      if (curlBlob) {
        console.log('[ZipProcessor] Curl-like download successful');
        return curlBlob;
      }
      
      // 方法2: Chrome Downloads API経由でファイルシステムを使う
      console.log('[ZipProcessor] Attempting download via Chrome Downloads API...');
      const downloadBlob = await this.downloadViaDownloadsAPI(zipUrl);
      if (downloadBlob) {
        console.log('[ZipProcessor] Chrome Downloads API successful');
        return downloadBlob;
      }
      
      // 方法3: Service Worker経由でダウンロード（認証なし）
      console.log('[ZipProcessor] Attempting download via Service Worker (no credentials)...');
      const serviceWorkerBlob = await this.downloadViaServiceWorkerNoCredentials(zipUrl);
      if (serviceWorkerBlob) {
        console.log('[ZipProcessor] Service Worker download successful');
        return serviceWorkerBlob;
      }
      
      // 方法4: 直接fetch（認証なし）
      console.log('[ZipProcessor] Attempting direct fetch without credentials...');
      const response = await fetch(zipUrl, {
        method: 'GET',
        credentials: 'omit', // 認証情報を含めない
        headers: {
          'Accept': '*/*'
        }
      });
      
      if (response.ok) {
        console.log('[ZipProcessor] Direct fetch successful');
        return await response.blob();
      }
      
      console.warn(`[ZipProcessor] Direct fetch failed: ${response.status} ${response.statusText}`);
      
      // 方法5: Service Worker経由でダウンロード（認証あり）
      console.log('[ZipProcessor] Attempting download via Service Worker with credentials...');
      return await this.downloadViaServiceWorker(zipUrl);
      
    } catch (error) {
      console.error('[ZipProcessor] Download failed:', error);
      
      // 方法6: Background script経由
      console.log('[ZipProcessor] Attempting download via background script...');
      return await this.downloadViaBackground(zipUrl);
    }
  }
  
  /**
   * curl風のネイティブダウンロード
   */
  private async downloadViaCurlLike(zipUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'curlLikeDownload',
        url: zipUrl,
        options: {
          // curlのような詳細なヘッダー設定
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          referer: window.location.href,
          accept: '*/*',
          acceptEncoding: 'gzip, deflate, br',
          acceptLanguage: 'ja,en-US;q=0.9,en;q=0.8',
          connection: 'keep-alive',
          secFetchDest: 'empty',
          secFetchMode: 'cors',
          secFetchSite: 'cross-site'
        }
      }, async (response) => {
        if (response?.success && response?.data) {
          try {
            // Base64またはArrayBufferからBlobに変換
            if (typeof response.data === 'string') {
              const binaryString = atob(response.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              resolve(new Blob([bytes], { type: 'application/zip' }));
            } else if (response.data instanceof ArrayBuffer) {
              resolve(new Blob([response.data], { type: 'application/zip' }));
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('[ZipProcessor] Failed to convert curl response:', error);
            resolve(null);
          }
        } else {
          console.error('[ZipProcessor] Curl-like download failed:', response?.error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Chrome Downloads API経由でダウンロード
   */
  private async downloadViaDownloadsAPI(zipUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'download-and-read',
        url: zipUrl
      }, async (response) => {
        if (response?.success && response?.data) {
          try {
            // Base64からBlobに変換
            if (typeof response.data === 'string') {
              const binaryString = atob(response.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              resolve(new Blob([bytes], { type: 'application/zip' }));
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('[ZipProcessor] Failed to convert Base64 to Blob:', error);
            resolve(null);
          }
        } else {
          console.error('[ZipProcessor] Downloads API failed:', response?.error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Service Worker経由でダウンロード（認証なし）
   */
  private async downloadViaServiceWorkerNoCredentials(zipUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'downloadZipNoCredentials',
        url: zipUrl
      }, async (response) => {
        if (response?.success && response?.data) {
          try {
            // Base64からBlobに変換
            if (typeof response.data === 'string') {
              const binaryString = atob(response.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              resolve(new Blob([bytes], { type: 'application/zip' }));
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('[ZipProcessor] Failed to convert Base64 to Blob:', error);
            resolve(null);
          }
        } else {
          console.error('[ZipProcessor] Service Worker download failed:', response?.error);
          resolve(null);
        }
      });
    });
  }

  /**
   * Service Worker経由でダウンロード（認証あり）
   */
  private async downloadViaServiceWorker(zipUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'downloadZip',
        url: zipUrl,
        referer: window.location.href
      }, async (response) => {
        if (response?.success && response?.data) {
          // Base64またはArrayBufferからBlobに変換
          if (typeof response.data === 'string') {
            // Base64の場合
            const binaryString = atob(response.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            resolve(new Blob([bytes], { type: 'application/zip' }));
          } else if (response.data instanceof ArrayBuffer) {
            resolve(new Blob([response.data], { type: 'application/zip' }));
          } else {
            resolve(null);
          }
        } else {
          console.error('[ZipProcessor] Service Worker download failed:', response?.error);
          resolve(null);
        }
      });
    });
  }
  
  /**
   * Background script経由でダウンロード
   */
  private async downloadViaBackground(zipUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      // Chrome downloads APIを使用
      chrome.runtime.sendMessage({
        action: 'downloadFile',
        url: zipUrl,
        filename: 'temp_ugoira.zip'
      }, (response) => {
        if (response?.success && response?.blob) {
          // ダウンロードしたファイルを読み込む
          fetch(response.blob)
            .then(res => res.blob())
            .then(blob => resolve(blob))
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      });
    });
  }
  
  /**
   * オリジナルサイズのフレームを取得
   */
  public async getOriginalFrames(
    _illustId: string,
    metadata: any,
    onProgress?: (status: string, detail: string) => void
  ): Promise<UgoiraFrame[]> {
    // メタデータからZIP URLを取得
    const originalZipUrl = metadata?.originalSrc || metadata?.src;
    
    if (!originalZipUrl) {
      throw new Error('ZIP URL not found in metadata');
    }
    
    console.log('[ZipProcessor] Using ZIP URL:', originalZipUrl);
    
    // 高解像度版のURLを構築（1920x1080）
    let highResUrl = originalZipUrl;
    if (originalZipUrl.includes('600x600')) {
      highResUrl = originalZipUrl.replace('600x600', '1920x1080');
      console.log('[ZipProcessor] Upgraded to high-res URL (600x600 -> 1920x1080):', highResUrl);
    } else if (originalZipUrl.includes('1200x1200')) {
      highResUrl = originalZipUrl.replace('1200x1200', '1920x1080');
      console.log('[ZipProcessor] Upgraded to high-res URL (1200x1200 -> 1920x1080):', highResUrl);
    } else {
      // パターンを探して最大解像度に変更
      const resolutionMatch = originalZipUrl.match(/(\d+x\d+)/);
      if (resolutionMatch) {
        highResUrl = originalZipUrl.replace(resolutionMatch[1], '1920x1080');
        console.log(`[ZipProcessor] Upgraded to high-res URL (${resolutionMatch[1]} -> 1920x1080):`, highResUrl);
      }
    }
    
    // ZIPをダウンロードして展開
    return await this.downloadAndExtractZip(highResUrl, metadata, onProgress);
  }
  
  /**
   * メモリクリーンアップ
   */
  public cleanup() {
    // 必要に応じてメモリクリーンアップ処理を追加
    // JavaScriptのガベージコレクションが自動的に処理する
  }
}

export default ZipProcessor;