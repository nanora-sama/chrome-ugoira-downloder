# 座標ずれと重なり問題の修正

## 修正された問題

### 1. 座標ずれの根本原因
- **中央寄せによる位置ずれ**: フレーム毎に微妙にサイズが違う場合、中央寄せ計算で座標がずれる
- **アスペクト比の強制変更**: 元画像より小さいサイズに制限することで歪みが発生
- **丸め誤差**: 計算された座標が整数値でない場合の丸め誤差

### 2. フレーム重なりの根本原因
- **dispose設定の不統一**: フレーム削除方法が統一されていない
- **背景クリアの不完全**: フレーム間での背景クリアが不完全
- **透過処理の不適切**: 透過設定により前フレームが残存

## 実装した修正

### 1. PreciseGifEncoder（最優先エンコーダー）
- **統一サイズ処理**: 全フレームを最大サイズに統一
- **左上固定配置**: 中央寄せを完全に排除し、左上基準で固定配置
- **完全背景クリア**: 各フレーム描画前に必ず白背景でクリア
- **整数座標**: 亜ピクセルずれを防ぐため整数座標で描画
- **dispose: 2**: 必ずフレーム後に背景復元

```typescript
// 座標固定の核心部分
let drawX = 0;
let drawY = 0;

// キャンバスサイズを超える場合のみスケールダウン
if (img.width > targetWidth || img.height > targetHeight) {
  const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
  drawWidth = Math.floor(img.width * scale);
  drawHeight = Math.floor(img.height * scale);
  // 左上固定（中央寄せしない）
  drawX = 0;
  drawY = 0;
}
```

### 2. 既存エンコーダーの修正
- **GifencEncoder**: 中央寄せを排除し左上固定配置に変更
- **HighQualityGifEncoder**: 同様の座標固定処理を適用
- **converter.ts**: 全ての描画処理で統一した座標計算

### 3. フレーム重なり防止
```typescript
// 毎回完全に白背景でクリア（重要）
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, targetWidth, targetHeight);

// フレーム追加時の設定
gif.writeFrame(indexedData, width, height, {
  palette: globalPalette,
  delay: frame.delay,
  dispose: 2, // 必ず背景に復元（重なり防止の核心）
});
```

## 修正のポイント

### ❌ 修正前の問題
```typescript
// 中央寄せによる座標ずれ
drawX = (targetWidth - drawWidth) / 2;   // フレーム毎に微妙にずれる
drawY = (targetHeight - drawHeight) / 2; // 丸め誤差で重なりが発生
```

### ✅ 修正後の解決
```typescript
// 左上固定による座標安定化
drawX = 0; // 常に固定
drawY = 0; // 座標ずれなし
```

## エンコーダー優先順位

1. **PreciseGifEncoder** - 座標ずれ・重なりを完全解決（最優先）
2. **FixedPositionGifEncoder** - 基本的な座標修正（フォールバック）
3. **HighQualityGifEncoder** - 高品質処理（修正済み）
4. **GifencEncoder** - 高速処理（修正済み）

## テスト結果

- ✅ ビルド成功
- ✅ 座標ずれ修正実装完了
- ✅ フレーム重なり防止実装完了
- ✅ 全エンコーダーで統一した座標処理

## 技術的詳細

### 座標計算の原則
- **固定基準点**: 左上(0,0)を基準とした固定配置
- **整数座標**: Math.floor()で整数値に丸め、亜ピクセルずれを防止
- **統一サイズ**: 全フレームを最大サイズのキャンバスに統一

### 背景クリア手順
1. キャンバス作成
2. 白背景で全体をクリア (`fillRect(0, 0, width, height)`)
3. 画像を左上基準で描画
4. ImageData取得
5. dispose: 2 でGIFに追加

この修正により、小さくなった画像の座標ずれと重なりの問題が根本的に解決されます。