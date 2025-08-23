import { MessageRequest, MessageResponse } from '../types/ugoira';

// プログレス管理
const progressMap = new Map<string, any>();

// メッセージリスナー
chrome.runtime.onMessage.addListener(
  (request: MessageRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[Service Worker] Received message:', request.action);
    
    switch (request.action) {
      case 'fetch':
        handleFetch(request.url!, sendResponse);
        return true; // 非同期レスポンスを示す
        
      case 'download':
        handleDownload(request.data, sendResponse);
        return true;
        
      case 'forceDownload':
        handleForceDownload(request.data, sendResponse);
        return true;
        
      case 'download-and-read':
        handleDownloadAndRead(request.url!, sendResponse);
        return true;
        
      case 'getProgress':
        sendResponse({
          success: true,
          data: progressMap.get(request.data.illustId)
        });
        break;
        
      case 'downloadZip':
        handleDownloadZip(request.url!, request.referer || '', sendResponse);
        return true; // 非同期レスポンス
        
      case 'downloadZipViaDownloadsAPI':
        handleDownloadZipViaDownloadsAPI(request.url!, sendResponse);
        return true; // 非同期レスポンス
        
      case 'curlLikeDownload':
        handleCurlLikeDownload(request.url!, request.options, sendResponse);
        return true; // 非同期レスポンス
        
      case 'downloadZipNoCredentials':
        handleDownloadZipNoCredentials(request.url!, sendResponse);
        return true; // 非同期レスポンス
        
      case 'silentDownload':
        handleSilentDownload(request.data, sendResponse);
        return true; // 非同期レスポンス
        
      default:
        sendResponse({
          success: false,
          error: `Unknown action: ${request.action}`
        });
    }
    return false;
  }
);

// CORSを回避してファイルをフェッチ
async function handleFetch(url: string, sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    console.log('[Service Worker] Fetching:', url);
    
    // Chrome拡張機能の権限でfetch
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit', // 認証情報を含めない
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.pixiv.net/',
        'Origin': 'https://www.pixiv.net'
      }
    });
    
    if (!response.ok) {
      console.error('[Service Worker] Fetch failed with status:', response.status);
      
      if (response.status === 403 || response.status === 401) {
        // 認証エラーの場合、Chrome Download APIを使用
        console.log('[Service Worker] Auth error, using download API fallback...');
        
        // ダウンロードAPIを使用してファイルを取得
        const downloadId = await chrome.downloads.download({
          url: url,
          filename: 'temp_ugoira.zip',
          saveAs: false,
          conflictAction: 'overwrite'
        });
        
        // ダウンロード完了を待つ
        return new Promise(() => {
          chrome.downloads.onChanged.addListener(function listener(delta) {
            if (delta.id === downloadId && delta.state) {
              if (delta.state.current === 'complete') {
                chrome.downloads.onChanged.removeListener(listener);
                // ダウンロードしたファイルの内容を取得
                chrome.downloads.search({ id: downloadId }, async (items) => {
                  if (items && items.length > 0) {
                    const filePath = items[0].filename;
                    sendResponse({
                      success: false,
                      error: 'DOWNLOAD_COMPLETED',
                      fallbackUrl: filePath
                    });
                  }
                });
              } else if (delta.state.current === 'interrupted') {
                chrome.downloads.onChanged.removeListener(listener);
                sendResponse({
                  success: false,
                  error: 'DELEGATE_TO_CONTENT',
                  fallbackUrl: url
                });
              }
            }
          });
        });
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('[Service Worker] Fetched successfully, size:', arrayBuffer.byteLength);
    
    // ArrayBufferを転送可能な形式に変換
    const bytes = new Uint8Array(arrayBuffer);
    const data = Array.from(bytes);
    
    sendResponse({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('[Service Worker] Fetch error:', error);
    
    // 最後の手段としてContent Scriptに委譲
    sendResponse({
      success: false,
      error: 'DELEGATE_TO_CONTENT',
      fallbackUrl: url
    });
  }
}

// ファイルをダウンロードして読み込む
async function handleDownloadAndRead(url: string, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Download and read:', url);
    
    // Chrome Downloads APIでダウンロード
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: `temp_ugoira_${Date.now()}.zip`,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    
    // ダウンロード完了を待つ
    chrome.downloads.onChanged.addListener(async function listener(delta) {
      if (delta.id === downloadId) {
        if (delta.state && delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          
          // ダウンロードしたファイルの情報を取得
          const [downloadItem] = await chrome.downloads.search({ id: downloadId });
          if (downloadItem && downloadItem.filename) {
            // ファイルを読み込む（File APIを使用）
            try {
              // ファイルURLを作成
              const fileUrl = `file:///${downloadItem.filename.replace(/\\/g, '/')}`;
              const response = await fetch(fileUrl);
              const arrayBuffer = await response.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              
              // Base64エンコード
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);
              
              // ダウンロードしたファイルを削除
              await chrome.downloads.removeFile(downloadId);
              
              sendResponse({
                success: true,
                data: base64
              });
            } catch (error) {
              console.error('[Service Worker] Failed to read file:', error);
              // File APIが使えない場合は、ダウンロードしたパスを返す
              sendResponse({
                success: false,
                error: 'FILE_DOWNLOADED',
                fallbackUrl: downloadItem.filename
              });
            }
          }
        } else if (delta.error) {
          chrome.downloads.onChanged.removeListener(listener);
          sendResponse({
            success: false,
            error: delta.error.current
          });
        }
      }
    });
  } catch (error) {
    console.error('[Service Worker] Download and read error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ダウンロード処理
async function handleDownload(data: { blob: string; filename: string }, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Starting download:', data.filename);
    
    // Base64からBlobを作成
    const response = await fetch(data.blob);
    const blob = await response.blob();
    
    // Blob URLを作成
    const url = URL.createObjectURL(blob);
    
    // ダウンロード
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: data.filename,
      saveAs: true
    });
    
    // ダウンロード完了を待つ
    chrome.downloads.onChanged.addListener(function listener(delta) {
      if (delta.id === downloadId) {
        if (delta.state && delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url); // メモリ解放
          sendResponse({
            success: true,
            data: { downloadId }
          });
        } else if (delta.error) {
          chrome.downloads.onChanged.removeListener(listener);
          URL.revokeObjectURL(url);
          sendResponse({
            success: false,
            error: delta.error.current
          });
        }
      }
    });
    
  } catch (error) {
    console.error('[Service Worker] Download error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ZIPファイルのダウンロード処理
async function handleDownloadZip(url: string, referer: string, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Downloading ZIP:', url);
    
    // 認証付きでfetch
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Cookieを含める
      headers: {
        'Referer': referer,
        'Accept': '*/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('[Service Worker] ZIP downloaded, size:', blob.size);
    
    // BlobをBase64に変換
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1];
      sendResponse({
        success: true,
        data: base64
      });
    };
    reader.readAsDataURL(blob);
    
  } catch (error) {
    console.error('[Service Worker] ZIP download failed:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Chrome Downloads APIを使用してZIPファイルをダウンロード（CORS回避）
async function handleDownloadZipViaDownloadsAPI(url: string, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Downloading ZIP via Downloads API:', url);
    
    // 一時的なファイル名を生成
    const tempFileName = `temp_ugoira_${Date.now()}.zip`;
    
    // Chrome Downloads APIでファイルをダウンロード
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: tempFileName,
      saveAs: false,
      conflictAction: 'overwrite'
    });
    
    // ダウンロード完了を監視
    chrome.downloads.onChanged.addListener(async function listener(delta) {
      if (delta.id === downloadId) {
        if (delta.state && delta.state.current === 'complete') {
          chrome.downloads.onChanged.removeListener(listener);
          
          try {
            // ダウンロードしたファイルの情報を取得
            const [downloadItem] = await chrome.downloads.search({ id: downloadId });
            
            if (downloadItem && downloadItem.filename) {
              console.log('[Service Worker] File downloaded to:', downloadItem.filename);
              
              // File System Access APIを使用してファイルを読み込む
              try {
                // ファイルパスをfile:// URLに変換
                const fileUrl = `file:///${downloadItem.filename.replace(/\\/g, '/')}`;
                const response = await fetch(fileUrl);
                
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  
                  // Base64エンコード
                  let binary = '';
                  for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                  const base64 = btoa(binary);
                  
                  console.log('[Service Worker] File read successfully, size:', arrayBuffer.byteLength);
                  
                  // ダウンロードしたファイルを削除
                  await chrome.downloads.removeFile(downloadId);
                  
                  sendResponse({
                    success: true,
                    data: base64
                  });
                } else {
                  throw new Error(`Failed to read file: ${response.status}`);
                }
              } catch (fileError) {
                console.error('[Service Worker] Failed to read downloaded file:', fileError);
                
                // file:// アクセスが失敗した場合、FileReader APIを試す
                // ただし、これはセキュリティ制限により通常失敗する
                sendResponse({
                  success: false,
                  error: 'Failed to read downloaded file due to security restrictions'
                });
              }
            } else {
              sendResponse({
                success: false,
                error: 'Download completed but file info not found'
              });
            }
          } catch (searchError) {
            console.error('[Service Worker] Failed to search download:', searchError);
            sendResponse({
              success: false,
              error: 'Failed to access downloaded file'
            });
          }
        } else if (delta.error) {
          chrome.downloads.onChanged.removeListener(listener);
          console.error('[Service Worker] Download failed:', delta.error.current);
          sendResponse({
            success: false,
            error: delta.error.current
          });
        }
      }
    });
    
  } catch (error) {
    console.error('[Service Worker] Downloads API error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// curl風のダウンロード（ブラウザロックを回避）
async function handleCurlLikeDownload(url: string, options: any, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Starting curl-like download:', url);
    
    // curlのように詳細なヘッダーを設定
    const headers: Record<string, string> = {
      'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': options.accept || '*/*',
      'Accept-Encoding': options.acceptEncoding || 'gzip, deflate, br',
      'Accept-Language': options.acceptLanguage || 'ja,en-US;q=0.9,en;q=0.8',
      'Connection': options.connection || 'keep-alive',
      'Sec-Fetch-Dest': options.secFetchDest || 'empty',
      'Sec-Fetch-Mode': options.secFetchMode || 'cors',
      'Sec-Fetch-Site': options.secFetchSite || 'cross-site'
    };
    
    // Refererがある場合は追加
    if (options.referer) {
      headers['Referer'] = options.referer;
    }
    
    // Cache-Controlでキャッシュを回避
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    
    console.log('[Service Worker] Using headers:', headers);
    
    // まず認証情報なしで試行（curlのデフォルト動作）
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        credentials: 'omit', // curlのようにデフォルトでは認証情報なし
        headers: headers,
        mode: 'cors',
        cache: 'no-store' // キャッシュを使用しない
      });
    } catch (error) {
      console.log('[Service Worker] First attempt failed, trying with credentials...');
      
      // 認証情報ありで再試行
      response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // 認証情報を含める
        headers: headers,
        mode: 'cors',
        cache: 'no-store'
      });
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('[Service Worker] Curl-like download successful, status:', response.status);
    console.log('[Service Worker] Response headers:', [...response.headers.entries()]);
    
    // レスポンスをArrayBufferとして取得
    const arrayBuffer = await response.arrayBuffer();
    console.log('[Service Worker] Downloaded size:', arrayBuffer.byteLength, 'bytes');
    
    // ArrayBufferをBase64に変換
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    sendResponse({
      success: true,
      data: base64
    });
    
  } catch (error) {
    console.error('[Service Worker] Curl-like download failed:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 認証情報なしでZIPダウンロード
async function handleDownloadZipNoCredentials(url: string, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log('[Service Worker] Downloading ZIP without credentials:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit', // 認証情報を含めない
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('[Service Worker] ZIP downloaded without credentials, size:', arrayBuffer.byteLength);
    
    // ArrayBufferをBase64に変換
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    sendResponse({
      success: true,
      data: base64
    });
    
  } catch (error) {
    console.error('[Service Worker] ZIP download without credentials failed:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 強制ダウンロード（最もシンプルな方法）
async function handleForceDownload(data: { base64: string; filename: string; mimeType?: string }, sendResponse: (response: MessageResponse) => void) {
  try {
    // Base64からBlobを作成
    const binaryString = atob(data.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: data.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    // シンプルにダウンロード（saveAs: falseで自動保存を試みる）
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: data.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    
    // クリーンアップ（3秒後）
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 3000);
    
    sendResponse({
      success: true,
      data: { downloadId }
    });
    
  } catch (error) {
    console.error('[Service Worker] Force download error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// curl風のサイレントダウンロード（モーダルなし）
async function handleSilentDownload(data: { base64: string; filename: string; size: number }, sendResponse: (response: MessageResponse) => void) {
  try {
    console.log(`[Service Worker] Starting silent download: ${data.filename} (${data.size} bytes)`);
    
    // Base64からBlobを作成
    const binaryString = atob(data.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/gif' });
    
    // Blob URLを作成
    const url = URL.createObjectURL(blob);
    
    console.log(`[Service Worker] Processing file for auto-download: ${data.filename}`);
    
    // Chrome Downloads APIでダウンロード
    // 注意: saveAs: falseはChrome設定に依存する
    try {
      // ファイル名をサニタイズ（Windowsで使用できない文字を除去）
      const sanitizedFilename = data.filename.replace(/[<>:"/\\|?*]/g, '_');
      
      // ダウンロードフォルダのサブフォルダを指定することで、より自動的に
      const downloadPath = `pixiv/${sanitizedFilename}`;
      
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: downloadPath,
        saveAs: false, // 自動保存を試みる
        conflictAction: 'uniquify' // 重複時は番号を付ける
      });
      
      console.log(`[Service Worker] Download initiated with ID: ${downloadId}`);
      
      // ダウンロード状態を監視
      return new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const [item] = await chrome.downloads.search({ id: downloadId });
          if (item) {
            if (item.state === 'complete') {
              clearInterval(checkInterval);
              URL.revokeObjectURL(url);
              console.log(`[Service Worker] Download completed: ${downloadPath}`);
              sendResponse({
                success: true,
                data: { 
                  downloadId: downloadId, 
                  filename: downloadPath,
                  method: 'auto'
                }
              });
              resolve();
            } else if (item.state === 'interrupted') {
              clearInterval(checkInterval);
              URL.revokeObjectURL(url);
              console.error(`[Service Worker] Download failed: ${item.error}`);
              throw new Error(item.error || 'Download interrupted');
            }
          }
        }, 500);
        
        // タイムアウト設定（30秒）
        setTimeout(() => {
          clearInterval(checkInterval);
          URL.revokeObjectURL(url);
          sendResponse({
            success: false,
            error: 'Download timeout'
          });
          resolve();
        }, 30000);
      });
      
    } catch (error) {
      console.log('[Service Worker] Primary download failed, trying fallback...');
      
      // フォールバック: 通常のファイル名でダウンロード
      const fallbackDownloadId = await chrome.downloads.download({
        url: url,
        filename: data.filename,
        saveAs: false,
        conflictAction: 'uniquify'
      });
      
      console.log(`[Service Worker] Fallback download initiated with ID: ${fallbackDownloadId}`);
      
      // ダウンロード完了を監視
      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id === fallbackDownloadId) {
          if (delta.state && delta.state.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            URL.revokeObjectURL(url); // メモリ解放
            console.log(`[Service Worker] Fallback download completed: ${data.filename}`);
            sendResponse({
              success: true,
              data: { downloadId: fallbackDownloadId, filename: data.filename }
            });
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            URL.revokeObjectURL(url);
            console.error(`[Service Worker] Fallback download failed: ${delta.error.current}`);
            sendResponse({
              success: false,
              error: delta.error.current
            });
          }
        }
      });
    }
    
  } catch (error) {
    console.error('[Service Worker] Silent download error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 定期的なクリーンアップ（alarms APIが利用可能な場合のみ）
if (chrome.alarms) {
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
      // 古いプログレス情報をクリア
      const now = Date.now();
      for (const [key, value] of progressMap.entries()) {
        if (now - value.timestamp > 3600000) { // 1時間以上古い
          progressMap.delete(key);
        }
      }
      console.log('[Service Worker] Cleanup completed');
    }
  });
}

// 拡張機能のインストール/更新時
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Service Worker] Extension installed');
    // 初回インストール時の処理
    await chrome.storage.local.set({
      settings: {
        quality: 10,
        resolution: '1920x1080',
        autoDownload: true, // 自動ダウンロードをデフォルトでON
        autoSave: true // 自動保存をON
      }
    });
    
    // Chromeのダウンロード設定を確認
    try {
      // ダウンロードフォルダの自動設定
      const downloads = await chrome.downloads.search({ limit: 1 });
      if (downloads.length > 0) {
        console.log('[Service Worker] Downloads folder:', downloads[0].filename);
      }
    } catch (error) {
      console.warn('[Service Worker] Could not check download settings:', error);
    }
    
  } else if (details.reason === 'update') {
    console.log('[Service Worker] Extension updated');
    // 既存の設定に自動保存オプションを追加
    const storage = await chrome.storage.local.get('settings');
    if (storage.settings && storage.settings.autoSave === undefined) {
      storage.settings.autoSave = true;
      await chrome.storage.local.set({ settings: storage.settings });
    }
  }
});

console.log('[Service Worker] Initialized');