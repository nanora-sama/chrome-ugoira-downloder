# Pixiv Ugoira GIF Downloader - Architecture Documentation

## 🎯 Project Overview

TypeScriptで開発されたChrome拡張機能で、PixivのうごイラをワンクリックでGIF形式でダウンロードできます。

**主要な特徴:**
- オリジナル解像度での高品質GIF生成
- curl風サイレントダウンロード（モーダルなし）
- 複数のフォールバック機能による高い成功率
- 全フレーム処理（間引きなし）

## 🏗️ System Architecture

### Component Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pixiv Page    │    │ Content Scripts │    │ Service Worker  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Ugoira Art  │ │───▶│ │  Detector   │ │    │ │  Download   │ │
│ │   Canvas    │ │    │ │             │ │    │ │   Handler   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        │        │    │        ▲        │
└─────────────────┘    │        ▼        │    │        │        │
                       │ ┌─────────────┐ │    │ ┌─────────────┐ │
                       │ │  Injector   │ │────┼▶│     Curl    │ │
                       │ │             │ │    │ │  Downloader │ │
                       │ └─────────────┘ │    │ └─────────────┘ │
                       │        │        │    └─────────────────┘
                       │        ▼        │              
                       │ ┌─────────────┐ │    ┌─────────────────┐
                       │ │ZipProcessor │ │    │  GIF Converters │
                       │ │             │ │    │                 │
                       │ └─────────────┘ │    │ ┌─────────────┐ │
                       └─────────────────┘    │ │HighQuality  │ │
                                              │ │  Encoder    │ │
                                              │ └─────────────┘ │
                                              │ ┌─────────────┐ │
                                              │ │   Gifenc    │ │
                                              │ │  Encoder    │ │
                                              │ └─────────────┘ │
                                              └─────────────────┘
```

### Data Flow Architecture
```
Pixiv Ugoira Page
    │
    ▼
┌─────────────────┐
│    Detector     │ ◄─── URL変更監視
│   (detector.ts) │      メタデータAPI取得
└─────────────────┘
    │
    ▼ うごイラ検出通知
┌─────────────────┐
│    Injector     │ ◄─── ダウンロードボタン注入
│   (injector.ts) │      ユーザー操作制御
└─────────────────┘
    │
    ▼ ダウンロード開始
┌─────────────────┐      ┌─────────────────┐
│  ZipProcessor   │ ────▶│ Service Worker  │
│(zip-processor.ts)│      │(service-worker.ts)│
└─────────────────┘      └─────────────────┘
    │                           │
    ▼ ZIP失敗時                  ▼ curl風ダウンロード
┌─────────────────┐      
│CanvasExtractor  │      
│                 │      
└─────────────────┘      
    │                    
    ▼ フレーム取得完了     
┌─────────────────┐      
│   Converter     │ ◄─── 複数エンコーダー選択
│  (converter.ts) │      品質・速度バランス
└─────────────────┘      
    │
    ▼ GIF生成完了
┌─────────────────┐
│   Download      │ ◄─── iframe/直接/SW方式
│                 │      モーダル回避
└─────────────────┘
```

## 📁 Directory Structure

```
chrome-ugoira-downloder/
├── src/
│   ├── manifest.json                 # Chrome Extension Manifest V3
│   │
│   ├── content/                      # Content Scripts
│   │   ├── detector.ts              # うごイラ検出・メタデータ取得
│   │   ├── injector.ts              # UI注入・ダウンロード制御
│   │   ├── zip-processor.ts         # ZIPファイル処理
│   │   ├── canvas-extractor.ts      # Canvas抽出（フォールバック）
│   │   ├── original-canvas-extractor.ts # 高解像度Canvas抽出
│   │   └── styles.css               # UI スタイル
│   │
│   ├── background/                   # Service Worker
│   │   └── service-worker.ts        # バックグラウンド処理
│   │
│   ├── core/                        # GIF変換エンジン
│   │   ├── converter.ts             # メイン変換ロジック
│   │   ├── high-quality-gif.ts      # gif.js高品質エンコーダー
│   │   ├── gifenc-encoder.ts        # gifenc高速エンコーダー
│   │   ├── timeout-free-gif.ts      # タイムアウト回避エンコーダー
│   │   ├── safe-gif-processor.ts    # 安全な分割処理
│   │   ├── split-gif-encoder.ts     # 分割GIFエンコーダー
│   │   ├── reliable-gif-encoder.ts  # 信頼性重視エンコーダー
│   │   ├── chunked-gif-processor.ts # チャンク処理
│   │   └── no-timeout-gif.ts        # 非同期処理最適化
│   │
│   ├── popup/                       # Extension Popup
│   │   ├── popup.html
│   │   └── popup.ts
│   │
│   ├── offscreen/                   # Offscreen Document
│   │   ├── offscreen.html
│   │   └── offscreen.ts
│   │
│   └── types/                       # TypeScript Type Definitions
│       └── ugoira.d.ts
│
├── dist/                            # Built Extension
├── webpack.config.js                # Webpack Configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Core Components

### 1. Detector (content/detector.ts)
**責任**: うごイラの検出とメタデータ収集

```typescript
class UgoiraDetector {
  // URL変更を監視
  private observeUrlChange(): void
  
  // うごイラメタデータをAPIから取得
  private async fetchUgoiraMetadata(illustId: string): Promise<any>
  
  // 検出結果をinjectorに通知
  private notifyInjector(ugoiraInfo: UgoiraInfo): void
}
```

**主要機能:**
- ページURL監視（PopState/PushState）
- Pixiv API呼び出し（`/ajax/illust/{id}/ugoira_meta`）
- うごイラ情報の解析・抽出
- フレーム数・解像度・ZIP URL取得

### 2. Injector (content/injector.ts)
**責任**: UI制御とダウンロードオーケストレーション

```typescript
class UgoiraInjector {
  // ダウンロードボタンをPixivページに注入
  private injectDownloadButton(): void
  
  // メインダウンロード処理
  private async handleDownload(): Promise<void>
  
  // フレーム取得の複数戦略
  private async getFramesWithFallback(metadata: any): Promise<UgoiraFrame[]>
  
  // curl風ダウンロード
  private async downloadFile(blob: Blob, filename: string): Promise<void>
}
```

**処理フロー:**
1. うごイラ検出受信
2. ダウンロードボタン注入
3. ユーザーアクション待機
4. フレーム取得（ZIP → Canvas）
5. GIF変換
6. ファイルダウンロード

### 3. ZipProcessor (content/zip-processor.ts)
**責任**: オリジナル解像度ZIP処理（優先方式）

```typescript
class ZipProcessor {
  // curl風のマルチ戦略ダウンロード
  private async downloadZipWithAuth(zipUrl: string): Promise<Blob | null>
  
  // ZIPファイル展開と全フレーム抽出
  public async downloadAndExtractZip(
    zipUrl: string, 
    metadata: any,
    onProgress?: (status: string, detail: string) => void
  ): Promise<UgoiraFrame[]>
}
```

**ダウンロード戦略:**
1. curl風ネイティブダウンロード
2. Chrome Downloads API経由
3. Service Worker（認証なし）
4. 直接fetch（認証なし）
5. Service Worker（認証あり）

### 4. Service Worker (background/service-worker.ts)
**責任**: バックグラウンド処理とCORS回避

```typescript
// メッセージハンドラー
chrome.runtime.onMessage.addListener(
  (request: MessageRequest, sender, sendResponse) => {
    switch (request.action) {
      case 'curlLikeDownload':
        handleCurlLikeDownload(request.url, request.options, sendResponse);
        break;
      case 'silentDownload':
        handleSilentDownload(request.data, sendResponse);
        break;
      // その他のハンドラー
    }
  }
);
```

**機能:**
- CORS制限回避のHTTPリクエスト
- ファイルの一時保存・読み込み
- curl風サイレントダウンロード
- プログレス管理

### 5. GIF Converter System (core/)

#### Main Converter (core/converter.ts)
```typescript
class GifConverter {
  public async convertToGif(
    frames: UgoiraFrame[], 
    options?: { onProgress?: (progress: number) => void }
  ): Promise<Blob>
}
```

**エンコーダー選択ロジック:**
1. **HighQualityGifEncoder**: gif.js使用、最高品質
2. **GifencEncoder**: gifenc使用、高速・安定
3. **その他**: タイムアウト回避・分割処理対応

#### High Quality Encoder (core/high-quality-gif.ts)
```typescript
class HighQualityGifEncoder {
  // 最高品質設定でGIF生成
  public static async encode(
    frames: Array<{ blob: Blob; delay: number }>,
    options: { onProgress?: (progress: number) => void }
  ): Promise<Blob>
}
```

**品質設定:**
- quality: 1（最高品質）
- dither: false（シャープ重視）
- imageSmoothingQuality: 'high'
- Canvas alpha: false

## 🔄 Processing Pipeline

### 1. Frame Acquisition Pipeline
```
ZIP Processing (Priority)
├── Resolution Upgrade: 600x600 → 1920x1080
├── Multi-strategy Download
├── JSZip Extraction: All 150 frames
└── Metadata Integration: Frame delays

Fallback: Canvas Extraction
├── Original Canvas Detection
├── High-resolution Canvas Capture
└── Frame-by-frame Processing
```

### 2. GIF Conversion Pipeline
```
Frame Preprocessing
├── Image Loading & Validation
├── Canvas Rendering (willReadFrequently: true)
└── Color Space Optimization

Encoding Strategy
├── Large Animation (>30 frames)
│   ├── Chunked Processing
│   ├── Timeout Handling
│   └── Memory Management
└── Small Animation (≤30 frames)
    └── Direct Encoding

Quality Control
├── No Dithering (Sharp Images)
├── High Smoothing Quality
└── Consistent Background (#ffffff)
```

### 3. Download Pipeline
```
Silent Download Strategy
├── 1st: iframe Method (Most Silent)
│   ├── Hidden iframe Creation
│   ├── Independent Document Context
│   └── Programmatic Click
├── 2nd: Direct Download
│   ├── Blob URL Creation
│   ├── DOM Link Element
│   └── Auto Click
└── 3rd: Service Worker
    ├── Base64 Conversion
    ├── Chrome Downloads API
    └── saveAs: false
```

## 🎛️ Configuration & Options

### Conversion Options
```typescript
interface ConversionOptions {
  quality: number;        // 1-10 (1 = best quality)
  workers: number;        // Web workers count
  width?: number;         // Output width
  height?: number;        // Output height  
  transparent?: boolean;  // Preserve transparency
  dither?: boolean;       // Enable dithering
  debug?: boolean;        // Debug logging
}
```

### Default Configuration
```typescript
defaultOptions: ConversionOptions = {
  quality: 10,           // gif.js compatibility
  workers: 0,            // Web Workers disabled for stability
  width: undefined,      // Keep original
  height: undefined,     // Keep original
  transparent: false,
  dither: false,         // Sharp images
  debug: false
}
```

### Runtime Settings
```typescript
// Stored in chrome.storage.local
interface ExtensionSettings {
  quality: number;
  resolution: '600x600' | '1920x1080';
  autoDownload: boolean;
}
```

## 🚀 Performance Characteristics

### Processing Performance
| Component | 150 Frames (1020x720) | Memory Usage | Time |
|-----------|----------------------|--------------|------|
| ZIP Download | 25MB ZIP file | ~50MB | 5-10s |
| Frame Extraction | 150 Blob objects | ~500MB | 3-5s |
| GIF Encoding (gif.js) | High quality | ~800MB | 60-90s |
| GIF Encoding (gifenc) | Fast mode | ~400MB | 30-45s |
| Final GIF | Output file | 10-20MB | - |

### Memory Management
```typescript
// Automatic cleanup patterns
- Blob URL revocation: URL.revokeObjectURL()
- Canvas cleanup: canvas.remove()
- Image cleanup: img.src = '', img.remove()
- Timeout management: clearTimeout()
- Event listener cleanup: removeEventListener()
```

## 🔒 Security & Privacy

### Permissions Model
```json
{
  "permissions": [
    "activeTab",      // Current tab access only
    "storage",        // Settings persistence  
    "downloads",      // File download capability
    "alarms",         // Cleanup scheduling
    "cookies",        // Pixiv session access
    "offscreen"       // Background processing
  ],
  "host_permissions": [
    "https://*.pixiv.net/*",   // Pixiv main domain
    "https://*.pximg.net/*"    // Pixiv CDN
  ]
}
```

### Security Measures
- **Minimal permissions**: activeTab instead of tabs
- **Host restrictions**: Pixiv domains only
- **No external APIs**: All processing local
- **Automatic cleanup**: Temporary files removed
- **CORS compliance**: Service Worker proxy pattern

### Privacy Protection
- **No data collection**: User data stays local
- **No external transmission**: Processing entirely local
- **Session isolation**: No cross-site data access
- **Temporary processing**: Files cleaned up automatically

## 🔧 Build & Development

### Build Configuration
```javascript
// webpack.config.js
module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/detector': './src/content/detector.ts',
    'content/injector': './src/content/injector.ts',
    'popup/popup': './src/popup/popup.ts',
    'offscreen/offscreen': './src/offscreen/offscreen.ts'
  },
  // TypeScript + Webpack optimization
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Development Commands
```bash
# Install dependencies
npm install

# Build for development
npm run build

# Type checking
npm run type-check

# Build for production
npm run build:prod
```

## 🐛 Error Handling Strategy

### Layered Error Recovery
```typescript
try {
  // Primary: ZIP processing
  const frames = await zipProcessor.getOriginalFrames(illustId, metadata);
} catch (zipError) {
  try {
    // Secondary: Original canvas extraction  
    const frames = await originalExtractor.captureOriginalFrames(metadata);
  } catch (canvasError) {
    // Tertiary: Standard canvas extraction
    const frames = await extractor.captureFrames(metadata);
  }
}
```

### Error Types & Handling
```typescript
// Network errors
catch (error) {
  if (error.message.includes('CORS')) {
    // Switch to Service Worker proxy
  } else if (error.message.includes('403')) {
    // Try alternative authentication
  }
}

// Timeout errors  
catch (error) {
  if (error.message.includes('Timeout')) {
    // Switch to faster encoder (gifenc)
  }
}

// Memory errors
catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Trigger cleanup, reduce quality
  }
}
```

## 📊 Monitoring & Logging

### Logging Strategy
```typescript
// Structured logging with component prefixes
console.log('[ZipProcessor] Starting download...', url);
console.log('[Converter] Using HighQualityGifEncoder for', frames.length, 'frames');  
console.log('[Injector] Silent download completed:', filename);
```

### Progress Tracking
```typescript
interface DownloadProgress {
  phase: 'fetching' | 'extracting' | 'converting' | 'complete' | 'error';
  progress: number;     // 0-100
  message: string;      // User-friendly status
  error?: string;       // Error details
}
```

### Performance Metrics
```typescript
// Internal performance tracking
const startTime = performance.now();
// ... processing ...
const duration = performance.now() - startTime;
console.log(`[Metrics] Processing completed in ${duration.toFixed(2)}ms`);
```

This architecture provides a robust, high-performance solution for downloading Pixiv ugoira as high-quality GIF files with multiple fallback mechanisms and curl-like silent operation.