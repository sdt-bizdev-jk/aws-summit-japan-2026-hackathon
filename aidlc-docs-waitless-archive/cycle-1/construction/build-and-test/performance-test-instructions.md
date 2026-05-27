# Performance Test Instructions — WaitLess

**プロジェクト**: WaitLess (Chrome 拡張機能 / Manifest V3)
**フェーズ**: CONSTRUCTION - Build and Test
**作成日**: 2026-05-26

---

## 1. パフォーマンステストの方針

WaitLess は以下の理由により、**専用のパフォーマンステストフレームワーク (k6 / JMeter 等) は採用しない**:

- サーバーサイド処理なし、API 呼び出しなし
- 単一クライアント (1 Chrome ブラウザ) で動作する拡張機能
- ハッカソン MVP 規模 (Q8=B)
- パフォーマンス要件は NFR-05 (DOM 監視オーバーヘッドの最小化) に集約

代わりに、以下の **観察ベースの軽量検証** を行う。

---

## 2. パフォーマンス要件 (NFR-05 由来)

| 項目 | 目標 / 許容 |
|------|------------|
| Claude.ai タブの操作応答性 | 拡張機能なしと体感差を感じない |
| MutationObserver のオーバーヘッド | DevTools Performance パネルで CPU 占有が継続的に上がらない |
| Service Worker のメモリ使用量 | 数 MB 程度に収まる (アイドル時) |
| Options Page のロード時間 | < 500ms (ローカル読み込みなのでほぼ即時) |

---

## 3. 検証手順

### 3.1 Claude.ai での体感確認

**手順**:
1. WaitLess を Unpacked ロード済みの Chrome で Claude.ai を開く
2. WaitLess を **無効化** (`chrome://extensions/` のトグル OFF)、再ロード、長文プロンプト入力で応答性を確認
3. WaitLess を **有効化** して同じ操作を行い、体感差を比較

**期待結果**:
- ✅ 応答性に体感差なし (主観評価で OK)
- ✅ Claude.ai のスクロール、入力、送信が引っかからない

### 3.2 DevTools Performance パネルでの観察

**手順**:
1. Claude.ai タブで DevTools を開き、「Performance」タブを選択
2. 録画開始 → 長文プロンプト送信 → ストリーミング 30秒程度 → 録画停止
3. CPU と Heap の推移を観察

**期待結果**:
- ✅ MutationObserver のコールバック (claude_site_adapter.js 内) が CPU の数% 程度に収まる
- ✅ メモリリーク (継続的な Heap 増加) が見られない

### 3.3 Service Worker のリソース確認

**手順**:
1. `chrome://extensions/` で WaitLess の「サービス ワーカー」リンクから DevTools を開く
2. 「Memory」タブで Heap snapshot を取得
3. 数分使用後、再度 snapshot を取得して差分確認

**期待結果**:
- ✅ Heap サイズが数 MB 程度
- ✅ 継続的な増加 (リーク) が観察されない

### 3.4 Options Page のロード時間

**手順**:
1. Options Page を開いて DevTools (F12) → Performance または Network タブ
2. ページリロード ($Cmd+R$ / $F5$)
3. 完全描画までの時間を確認

**期待結果**:
- ✅ DOMContentLoaded まで < 500ms
- ✅ chrome.runtime.sendMessage('GET_SETTINGS') の応答時間 < 50ms (ローカルストレージのみ)

---

## 4. パフォーマンス改善の余地 (将来用)

本サイクルでは未対応だが、将来必要になった場合の改善候補:

- MutationObserver の `subtree: true` を狭めるため、Claude.ai の応答コンテナ要素 (例: `[role="main"]` 等) のみを観察対象に
- N秒タイマーの管理を `setInterval` から `setTimeout` の re-arm に統一 (既に実装済)
- Options Page のテーブルレンダリングを差分更新化 (現在は全 sites を `innerHTML = ''` してから再構築)

---

## 5. 結論

WaitLess の本サイクルでは、**専用パフォーマンステストは N/A** (Not Applicable) とする。
体感ベース・DevTools 観察での確認のみで MVP 品質には十分。
