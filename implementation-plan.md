# Pixiv うごイラ GIFダウンローダー Chrome拡張機能 実装計画書

## 1. 技術スタック

### 1.1 開発言語・フレームワーク
- **TypeScript 5.3+**: 型安全性の確保
- **Webpack 5**: バンドルツール
- **Chrome Extension Manifest V3**: 拡張機能フレームワーク

### 1.2 ライブラリ
- **gif.js**: GIF生成ライブラリ
- **JSZip**: ZIPファイル解凍
- **axios**: HTTP通信（Manifest V3対応）

### 1.3 開発ツール
- **ESLint**: コード品質管理
- **Prettier**: コードフォーマット
- **Jest**: ユニットテスト

## 2. プロジェクト構造

```
chrome-ugoira-downloader/
├── src/
│   ├── manifest.json          # 拡張機能マニフェスト
│   ├── background/            # Service Worker
│   │   └── service-worker.ts
│   ├── content/              # Content Scripts
│   │   ├── detector.ts      # うごイラ検出
│   │   ├── injector.ts      # UIインジェクション
│   │   └── styles.css       # カスタムスタイル
│   ├── core/                # コアロジック
│   │   ├── downloader.ts    # ダウンロード処理
│   │   ├── converter.ts     # GIF変換処理
│   │   └── parser.ts        # データパース
│   ├── popup/               # ポップアップUI
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── types/               # TypeScript型定義
│   │   ├── pixiv.d.ts
│   │   └── ugoira.d.ts
│   └── utils/               # ユーティリティ
│       ├── storage.ts       # ストレージ管理
│       └── logger.ts        # ロギング
├── public/                  # 静的ファイル
│   └── icons/
├── tests/                   # テストファイル
├── webpack.config.js        # Webpack設定
├── tsconfig.json           # TypeScript設定
├── package.json
└── README.md
```

## 3. 実装フェーズ

### Phase 1: 基盤構築（1週間）

#### 3.1.1 開発環境セットアップ
```typescript
// package.json の主要依存関係
{
  "devDependencies": {
    "@types/chrome": "^0.0.251",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.0"
  },
  "dependencies": {
    "gif.js": "^0.2.0",
    "jszip": "^3.10.1",
    "axios": "^1.6.0"
  }
}
```

#### 3.1.2 Manifest V3設定
```json
{
  "manifest_version": 3,
  "name": "Pixiv Ugoira GIF Downloader",
  "version": "1.0.0",
  "description": "Convert and download Pixiv Ugoira as GIF",
  "permissions": [
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "https://*.pixiv.net/*",
    "https://*.pximg.net/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [{
    "matches": ["https://www.pixiv.net/*"],
    "js": ["content/detector.js", "content/injector.js"],
    "css": ["content/styles.css"]
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### Phase 2: コア機能実装（2週間）

#### 3.2.1 うごイラ検出機能
```typescript
// src/content/detector.ts
interface UgoiraInfo {
  illustId: string;
  userId: string;
  frames: number;
  resolution: string;
}

class UgoiraDetector {
  private observer: MutationObserver;
  
  public detectUgoira(): UgoiraInfo | null {
    // URLパターンマッチング
    const match = window.location.href.match(/artworks\/(\d+)/);
    if (!match) return null;
    
    // DOM要素からうごイラ判定
    const canvas = document.querySelector('canvas[data-ugoira]');
    if (!canvas) return null;
    
    // メタデータ取得
    return this.extractMetadata(match[1]);
  }
  
  private extractMetadata(illustId: string): UgoiraInfo {
    // window.pixiv.context から情報取得
    // または DOM から取得
  }
}
```

#### 3.2.2 ダウンロード処理
```typescript
// src/core/downloader.ts
class UgoiraDownloader {
  private async fetchZipFile(url: string): Promise<ArrayBuffer> {
    // CORSを回避するためservice worker経由で取得
    return chrome.runtime.sendMessage({
      action: 'fetch',
      url: url
    });
  }
  
  private async extractFrames(zipData: ArrayBuffer): Promise<Frame[]> {
    const zip = await JSZip.loadAsync(zipData);
    const frames: Frame[] = [];
    
    // animation.json の取得
    const animationJson = await zip.file('animation.json')?.async('string');
    const animationData = JSON.parse(animationJson || '{}');
    
    // 各フレームの取得
    for (const frameInfo of animationData.frames) {
      const file = zip.file(frameInfo.file);
      if (file) {
        const blob = await file.async('blob');
        frames.push({
          blob: blob,
          delay: frameInfo.delay
        });
      }
    }
    
    return frames;
  }
}
```

#### 3.2.3 GIF変換処理
```typescript
// src/core/converter.ts
class GifConverter {
  private gif: any; // gif.js instance
  
  public async convertToGif(frames: Frame[]): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: 'gif.worker.js'
      });
      
      // フレーム追加
      for (const frame of frames) {
        const img = new Image();
        img.src = URL.createObjectURL(frame.blob);
        this.gif.addFrame(img, { delay: frame.delay });
      }
      
      // レンダリング
      this.gif.on('finished', (blob: Blob) => {
        resolve(blob);
      });
      
      this.gif.render();
    });
  }
}
```

### Phase 3: UI実装（1週間）

#### 3.3.1 ダウンロードボタンの注入
```typescript
// src/content/injector.ts
class UIInjector {
  private createDownloadButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'ugoira-download-btn';
    button.innerHTML = `
      <svg><!-- Download icon --></svg>
      <span>GIF Download</span>
    `;
    button.addEventListener('click', this.handleDownload);
    return button;
  }
  
  public injectButton(): void {
    // 適切な位置にボタンを挿入
    const targetElement = document.querySelector('.artwork-buttons');
    if (targetElement) {
      targetElement.appendChild(this.createDownloadButton());
    }
  }
  
  private async handleDownload(): Promise<void> {
    // プログレス表示
    this.showProgress();
    
    try {
      // ダウンロード処理実行
      const gifBlob = await this.downloadAndConvert();
      
      // ファイル保存
      chrome.downloads.download({
        url: URL.createObjectURL(gifBlob),
        filename: `ugoira_${illustId}.gif`
      });
    } catch (error) {
      this.showError(error.message);
    }
  }
}
```

#### 3.3.2 プログレス表示
```typescript
// src/content/progress.ts
class ProgressIndicator {
  private element: HTMLElement;
  
  public show(message: string, progress?: number): void {
    if (!this.element) {
      this.createElement();
    }
    
    this.element.innerHTML = `
      <div class="progress-message">${message}</div>
      ${progress !== undefined ? 
        `<div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>` : ''}
    `;
  }
  
  private createElement(): void {
    this.element = document.createElement('div');
    this.element.className = 'ugoira-progress-overlay';
    document.body.appendChild(this.element);
  }
}
```

### Phase 4: Service Worker実装（1週間）

#### 3.4.1 バックグラウンド処理
```typescript
// src/background/service-worker.ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetch') {
    // CORS回避のためのプロキシ処理
    fetch(request.url)
      .then(response => response.arrayBuffer())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンス
  }
  
  if (request.action === 'convert') {
    // ワーカーでの変換処理
    performConversion(request.data)
      .then(result => sendResponse(result));
    return true;
  }
});

// アラーム設定（定期的なクリーンアップなど）
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupTempFiles();
  }
});
```

### Phase 5: 最適化とテスト（1週間）

#### 3.5.1 パフォーマンス最適化
- メモリ使用量の最適化（ストリーミング処理）
- Web Worker活用による並列処理
- 画像の遅延読み込み

#### 3.5.2 エラーハンドリング
```typescript
// src/utils/error-handler.ts
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  CONVERSION_ERROR = 'CONVERSION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

class ErrorHandler {
  public handleError(error: Error, type: ErrorType): void {
    console.error(`[${type}]`, error);
    
    // ユーザーへの通知
    this.notifyUser(this.getErrorMessage(type));
    
    // エラーレポート（オプション）
    this.reportError(error, type);
  }
  
  private getErrorMessage(type: ErrorType): string {
    const messages = {
      [ErrorType.NETWORK_ERROR]: 'ネットワークエラーが発生しました',
      [ErrorType.PARSE_ERROR]: 'データの解析に失敗しました',
      [ErrorType.CONVERSION_ERROR]: 'GIF変換に失敗しました',
      [ErrorType.PERMISSION_ERROR]: '権限が不足しています'
    };
    return messages[type];
  }
}
```

#### 3.5.3 テスト実装
```typescript
// tests/converter.test.ts
describe('GifConverter', () => {
  it('should convert frames to GIF', async () => {
    const converter = new GifConverter();
    const frames = [
      { blob: new Blob(), delay: 100 },
      { blob: new Blob(), delay: 100 }
    ];
    
    const result = await converter.convertToGif(frames);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/gif');
  });
});
```

## 4. 実装上の課題と解決策

### 4.1 CORS問題
- **課題**: pximg.netからの直接フェッチがCORSで制限される
- **解決策**: Service Worker経由でのプロキシ処理

### 4.2 大容量ファイル処理
- **課題**: 大きなうごイラでメモリ不足の可能性
- **解決策**: ストリーミング処理、チャンク単位での変換

### 4.3 認証が必要なコンテンツ
- **課題**: R-18コンテンツなど認証が必要
- **解決策**: ユーザーのcookieを利用（content script経由）

## 5. デプロイとリリース

### 5.1 ビルドプロセス
```bash
# 開発ビルド
npm run build:dev

# 本番ビルド
npm run build:prod

# パッケージング
npm run package
```

### 5.2 Chrome Web Store申請準備
- プライバシーポリシーの作成
- スクリーンショットの準備（1280x800）
- 詳細な説明文の作成
- アイコンセット（16, 48, 128px）

### 5.3 バージョン管理
- セマンティックバージョニング採用
- 自動更新機能の実装
- チェンジログの管理

## 6. 保守・運用計画

### 6.1 監視項目
- Pixiv API変更の検知
- エラー率のモニタリング
- パフォーマンスメトリクス

### 6.2 更新サイクル
- バグ修正: 随時
- 機能追加: 月1回
- セキュリティ更新: 即座に対応

### 6.3 ユーザーサポート
- GitHubでのissue管理
- FAQドキュメントの整備
- フィードバック収集機能