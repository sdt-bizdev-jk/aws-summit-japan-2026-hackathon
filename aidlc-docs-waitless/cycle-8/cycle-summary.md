# WaitLess cycle-8 — サイクルサマリ (後付けアーカイブ)

最終更新: 2026-05-29

> **注**: このサイクルは AIDLC プロセスを踏まずに実装された。
> `aidlc-docs/` は作成されていないため、後付けでサマリのみを記録する。

---

## 1. 実装スコープ (エンタメ発見ポップアップ)

**機能名**: エンタメ発見ポップアップ（広告風・動画再生）

待ち時間検知時、AI タブ中央にモーダル風ポップアップを表示。映画予告（YouTube 埋め込み、autoplay+mute）を iframe 再生、読書はサムネ＋リンク。レコメンドはハードコード＋ランダム選択（セレンディピティ）。

### 変更ファイル

| 区分 | ファイル | 内容 |
|------|---------|------|
| 新規 | `extension/sw/entertainment_ads.js` | ポップアップロジック。`pickAd()` + `showAdPopup()` + `injectAdPopup()` |
| 新規 | `extension/player/player.html` | 内蔵プレイヤーページ (?v= で YouTube 全面表示) |
| 新規 | `extension/player/player.js` | player.html の iframe 生成スクリプト |
| 改修 | `extension/sw/wait_orchestrator.js` | `onWaitDetected()` に ads_enabled チェックを追加。ON 時はタブ切替をスキップしてポップアップ表示 |
| 改修 | `extension/sw/tab_manager.js` | `waitForTabComplete` を `export` に変更 |
| 改修 | `extension/options/options.html` | 「エンタメ発見ポップアップ」セクション + ON/OFF トグル追加 |
| 改修 | `extension/options/options.js` | `initAdsToggle()` メソッド追加 |
| 改修 | `extension/manifest.json` | `web_accessible_resources` に player/player.{html,js} 追加、version `0.7.0` → `0.8.0` |

### 実装済みの機能

| 機能 | 内容 |
|------|------|
| ランダムレコメンド | `ADS[]` 4 件（映画予告 3 + 読書 1）からランダム 1 件選択 (`pickAd`) |
| 動画ポップアップ | 16:9 iframe (YouTube autoplay+mute)、フェード + スケールイン |
| 読書ポップアップ | グラデーション + 絵文字サムネ + Google Books リンク |
| ON/OFF トグル | Options Page から `chrome.storage.local.ads_enabled` で制御。デフォルト ON |
| 自動消去 | 動画 60 秒 / 読書 12 秒でタイムアウト自動消去 |
| best-effort | 失敗してもコア体験を阻害しない |

### 重要な設計決定

**`ads_enabled` が `true`（デフォルト）の場合、既存のタブ切替フローを完全にスキップする。**

`wait_orchestrator.js` の `onWaitDetected()` で `ads_enabled` を確認し、ON なら `RuntimeState.setWaiting(false)` → `showAdPopup(claudeTabId)` → `return` の順に処理して、後続のタブ切替処理を実行しない。

```
ads_enabled = true (デフォルト)
  → タブ切替なし、AI タブにポップアップを表示
ads_enabled = false
  → 従来のタブ切替フロー (cycle-1〜7 の挙動) を維持
```

---

## 2. 動作確認状況

自動テスト: なし (AIDLC 外で実装、テストスクリプト未作成)

手動確認:
- `entertainment_ads.js` の構文: 未確認
- 実機 E2E (Claude.ai で待ち時間発生 → ポップアップ表示 → 動画再生 / CTA / 閉じる): 未実施

---

## 3. 新規制限事項

| ID | 内容 |
|----|------|
| B-39 | レコメンドがハードコード 4 件のみ (映画 3 + 読書 1)。動的化・件数増・ジャンル多様化が必要 |
| B-40 | ads ON 時、AI 生成完了後もポップアップが残る (自動消去タイムアウトまで表示される)。completion 連動での自動消去が未実装 |
| B-41 | `player/player.html|js` は manifest に追加されているが現状未使用 (showAdPopup が直接 AI タブへ inject する方式のため) |
| B-42 | `entertainment_ads.js` のデバッグログ常時 ON (`DEBUG = true`) |

---

## 4. 関連ドキュメント

- cycle-9 引き継ぎ: `docs/cycle-9-handover.md`
