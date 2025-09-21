# Pixiv Ugoira GIF Downloader

PixivのうごイラをワンクリックでGIF形式でダウンロードできるChrome拡張機能

## 機能

- 🎬 うごイラを自動検出
- 💾 ワンクリックでGIF形式に変換してダウンロード
- 📝 投稿者名を含むファイル名で保存
- ⚡ タイムアウト対策済みの高速変換
- 🎨 Pixivのデザインに合わせたUI
- 📊 ダウンロード統計の表示

## インストール方法

### 開発版のインストール

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/chrome-ugoira-downloader.git
cd chrome-ugoira-downloader
```

2. 依存関係をインストール
```bash
npm install
```

3. ビルド
```bash
npm run build
```

4. Chromeで拡張機能を読み込み
   - Chrome で `chrome://extensions/` を開く
   - 「デベロッパーモード」を有効にする
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist` フォルダを選択

## 使い方

1. Pixivでうごイラ作品ページを開く
2. 「GIF」ダウンロードボタンが自動的に表示される
3. ボタンをクリックするとGIF形式でダウンロードが開始
4. ファイル名は「投稿者名_作品タイトル(作品ID).gif」形式で保存

## 開発

### 開発モードで実行
```bash
npm run watch
```

### ビルド
```bash
# 開発ビルド
npm run build:dev

# 本番ビルド
npm run build
```

### プロジェクト構造
```
chrome-ugoira-downloader/
├── src/
│   ├── background/       # Service Worker
│   ├── content/         # Content Scripts
│   │   ├── injector.ts      # UIボタン注入
│   │   ├── author-extractor.ts  # 投稿者名取得
│   │   └── direct-downloader.ts # ダウンロード処理
│   ├── core/           # コアロジック
│   │   ├── converter.ts     # GIF変換メイン
│   │   ├── fast-gifenc-encoder.ts  # 高速エンコーダー
│   │   └── stable-gif-encoder.ts   # 安定版エンコーダー
│   ├── popup/          # ポップアップUI
│   └── types/          # TypeScript型定義
├── public/             # 静的ファイル
└── dist/              # ビルド出力
```

## 設定オプション

### GIF品質
- 最高品質 (1)
- 高品質 (5)
- 標準 (10)
- 低品質 (15)
- 最低品質 (20)

### 解像度
- オリジナル (1920x1080)
- 標準 (600x600)

## 技術スタック

- TypeScript
- Chrome Extension Manifest V3
- Webpack
- gifenc (高速GIF生成)
- gif.js (安定版フォールバック)
- JSZip (ZIP解凍)

## ライセンス

MIT License

## 重要な注意事項

### 個人利用について
- **この拡張機能は個人利用のみを目的としています**
- ダウンロードした画像の著作権は元の作者に帰属します
- 商用利用や再配布は禁止されています
- Pixivの利用規約を必ず遵守してください
- 作者の権利を尊重し、責任を持って利用してください

### 一時ファイルのダウンロードについて
- **ZIP形式の一時ファイルがダウンロードフォルダに保存される場合があります**
- これらのファイル（例：`download.zip`、`ugoira_XXXXXX.zip`）は**正常な動作に必要なファイル**です
- 拡張機能がうごイラデータを取得・処理するために一時的に使用されます
- GIF変換完了後、これらのZIPファイルは手動で削除して構いません
- これは技術的な制約によるもので、エラーではありません

## トラブルシューティング

### ダウンロードボタンが表示されない
- ページをリロードしてみてください
- うごイラ作品であることを確認してください

### ダウンロードが失敗する
- ネットワーク接続を確認してください
- Pixivにログインしているか確認してください
- 一時的なZIPファイルがダウンロードされても、これは正常な動作です（上記の「一時ファイルのダウンロードについて」を参照）

### 自動ダウンロードが動作しない
- Chromeの設定で「ダウンロード前に各ファイルの保存場所を確認する」をオフにしてください
- 設定方法: Chrome設定 → ダウンロード → 「ダウンロード前に各ファイルの保存場所を確認する」のチェックを外す

## 貢献

プルリクエストを歓迎します！

## サポート

問題が発生した場合は、[Issues](https://github.com/yourusername/chrome-ugoira-downloader/issues) で報告してください。