# Requirements — WaitLess cycle-3

最終更新: 2026-05-27 (Requirements Analysis 完了時点)

---

## 0. Intent Analysis Summary

| 項目 | 内容 |
|------|------|
| **User Request (raw)** | 「簡易な読書ページを追加せよ・AI出力待ち時間に、小説がテキストで書かれたページへ遷移・AI出力がいつ終わるかわからない制限時間の中で、スクロールしてテキストを読み進める・AI出力完了時にAIサイトへ戻る・再びAI出力待ち発生時に、前回読み進めたところに遷移して再び読み進められる・どこまで読んだかをわかりやすくするために、小説の文字色を視認性のある灰色から青色にする・小説のテキストをマウスカーソルでクリックすることでそこまでのテキストを青色に変化させられる」 |
| **Request Type** | New Feature (新規機能 — 拡張機能内蔵の読書ページ) |
| **Scope Estimate** | Medium (新規ページ + データモデル拡張 + 既存切替フローとの統合) |
| **Complexity Estimate** | Moderate (UI ロジック + 永続化 + クリックインタラクション + 起動時の状態復元) |
| **Project Type** | Brownfield (cycle-1 + cycle-2 成果物を継承) |

### 設計判断のサマリ (Q&A の結果)

ユーザー回答により以下の方針に確定:

1. **小説テキストは拡張機能組み込み** (Q1=A) — 1 編固定 (Q2=A)、ユーザーによるテキスト変更機能なし
2. **読書ページは既存 Site 登録モデルに乗せる** (Q3=A) — `chrome-extension://[ID]/reader/reader.html` を Options Page で 1 サイトとして登録
3. **既読位置の保存粒度はスクロール + クリック位置の両方** (Q4=C)
4. **既読色変化はクリック時のみ + 永続化** (Q5=D)
5. **クリックは双方向** (Q6=B) — 既読範囲より前をクリックすると、その位置まで戻る
6. **AI 完了時の離脱直前にスクロール + クリック位置を自動保存** (Q7=A)
7. **UI は最小限** (Q8=A) — 黒背景 / 灰色テキスト、クリックで青色化、スクロールのみ
8. **Options Page は拡張しない** (Q9=A) — ユーザーは普通に `chrome-extension://...` を 1 サイトとして登録
9. **PlaybackTrigger は既存挙動 (`<video>` がないので noop)** (Q10=A) — コード変更なし
10. **永続化は `chrome.storage.local` のみ** (Q11=A) — NFR-01 プライバシー方針継承
11. **Backlog 他項目は対応しない** (Q12=A) — 読書ページ機能に集中
12. **Security Extension / PBT Extension は Skip**

---

## 1. プロジェクト背景と cycle-3 の位置づけ

### 1.1 cycle-1 / cycle-2 から継承される機能

- cycle-1: Claude.ai 待ち N秒検知 → 娯楽タブ自動切替 → 完了で復帰、2 パス探索、動画自動再生 / 完了時一時停止
- cycle-2: 動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想等) を公式サポート対象に拡大、UI 文言更新

### 1.2 cycle-3 のスコープ

cycle-3 では **拡張機能内蔵の読書ページ** を新規実装し、AI 待ち時間中に小説テキストを読み進められる体験を提供する。

実装上、cycle-3 では以下を新規導入する:
- `extension/reader/` ディレクトリ (新規) — 読書ページ用 HTML / CSS / JS 一式 + 組み込み小説テキスト
- `chrome.storage.local` への新フィールド (既読位置の永続化) — `reader_state` などのキー名で追加 (既存の `sites` / `threshold_sec` とは別)
- 既存 Site 登録モデルへの乗せ方 (`chrome-extension://[ID]/reader/reader.html` を一般サイトとして登録、空状態案内で URL コピペを支援)

データモデル `{ sites: [{domain, url, priority}], threshold_sec }` 自体は **変更しない** (NFR-07 後方互換性継承)。新フィールドは独立して `reader_state` として保存。

---

## 2. ペルソナ (cycle-1 から継続、用途を拡張)

### Persona: タカシ (cycle-1 から継続)

cycle-1 / cycle-2 のペルソナを継承。
cycle-3 では **静かに読書したい時間** が AI 待ち時間に取れるようになる、という新しい体験を提供。

- 役割: AI を日常的に使うナレッジワーカー
- 背景: cycle-1 / cycle-2 の用途 (動画 / ゲーム / SNS 等) に加え、AI 待ち時間に **読書を進めたい** ニーズあり
- **cycle-3 での新たな振る舞い**:
  - 待ち時間に小説の続きを読み進める (10〜30 秒の細切れ時間でも、毎回続きから始められる)
  - 自動で AI 完了で AI タブに戻る (本のしおりを置いた感覚)
  - 文字色変化 (灰色→青色) で「ここまで読んだ」を視覚的に把握
  - クリックで意図した位置を「読んだ」とマーク

---

## 3. 機能要件 (Functional Requirements)

### 3.1 cycle-1 / cycle-2 から継承する FR (再記載なし、archive 参照)

cycle-1 の FR-01〜11 (`aidlc-docs-waitless-archive/cycle-1/inception/requirements/requirements.md`) と
cycle-2 の FR-21〜25 (`aidlc-docs-waitless-archive/cycle-2/inception/requirements/requirements.md`) は
**すべて維持** する。

### 3.2 cycle-3 で新規追加する FR

| ID | 名称 | 内容 | 受入条件 |
|----|------|------|---------|
| **FR-31** | 拡張機能内蔵の読書ページ | 拡張機能に内蔵された HTML ページ (`reader.html`) で組み込みの小説テキストを表示する | ・`chrome-extension://[ID]/reader/reader.html` が拡張機能ロード後に開ける<br>・組み込みの小説テキストが表示される (1 編固定、cycle-3 では青空文庫等のパブリックドメイン作品 1 編をバンドル)<br>・ページのスクロールでテキストが読み進められる |
| **FR-32** | 読書ページの最小限 UI | 黒(orダーク)背景に視認性のある灰色テキスト、クリックで青色化、スクロールのみのシンプル UI | ・本文テキストの初期色が **灰色 (例: `#888`)**<br>・クリックされたテキストまでが **青色 (例: `#3b82f6`)** に変化<br>・固定の文字サイズ・フォント・テーマ (調整 UI なし) |
| **FR-33** | クリックでの既読範囲指定 | テキスト内をクリックすると、ページ先頭からそのクリック位置までのテキスト全体が青色化する | ・テキスト内の任意位置をクリックすると、ページ先頭からその文字オフセット位置までが青になる<br>・既に青色化されている範囲より **前** をクリックすると、そこまで **戻る** (双方向、Q6=B)<br>・既に青色化されている範囲より **後ろ** をクリックすると、そこまで **進む** |
| **FR-34** | 既読位置の永続化 (クリック位置) | クリック位置 (= 既読末尾の文字オフセット) を `chrome.storage.local` に保存し、次回読書ページを開いた時に復元する | ・クリックした瞬間に保存される (即時)<br>・拡張機能をリロードしても保持される<br>・`chrome.storage.local` の独立キー (例: `reader_state`) に保存 |
| **FR-35** | スクロール位置の永続化 (離脱直前) | 読書ページから離脱する直前 (AI 完了で AI タブに戻る瞬間、またはタブを閉じる時) に、現在のスクロール位置を保存する | ・AI 完了で読書ページがバックグラウンド化したタイミング、または `pagehide` / `visibilitychange` 等で保存<br>・拡張機能をリロードしても保持される |
| **FR-36** | 起動時の状態復元 | 読書ページを開いたら、保存されているスクロール位置 + クリック位置を復元する | ・ページロード後、保存されているスクロール位置にスクロール<br>・保存されているクリック位置までを青色化<br>・初回起動時 (保存データなし) はページ先頭・全体灰色で表示 |
| **FR-37** | 既存 Site 登録モデルでの統合 | ユーザーは Options Page で `chrome-extension://[ID]/reader/reader.html` を 1 つの娯楽サイトとして登録できる。既存の 2 パス探索ロジックがそのまま適用される | ・Options Page に手動で読書ページの URL を登録できる<br>・空状態案内で読書ページの URL を **コピペ可能形式 (`<code>`)** で提示する。URL は実行時に `chrome.runtime.getURL(...)` で取得した値を表示<br>・登録後、待ち発生で読書ページが新規タブで開く / 既存タブがアクティブ化される |
| **FR-38** | 読書ページ用ビジネスルール | クリック位置の判定、起動時復元の挙動、保存タイミング等をビジネスルールとして明文化する | ・**BR-31** クリック位置はクリックされた **DOM 要素の文字オフセット位置**(段落単位の累積文字数 + 段落内オフセット)<br>・**BR-32** スクロール位置は `window.scrollY` を整数で保存<br>・**BR-33** 起動時の復元順序は (a) クリック位置で青色化 → (b) スクロール位置を適用<br>・**BR-34** 保存トリガーは「クリック時 (即時)」「`pagehide` / `visibilitychange` (hidden)」(離脱検知)<br>・**BR-35** 保存失敗時は黙って許容 (`chrome.storage.local` の限界等、ユーザー操作を妨げない)<br>・**BR-36** クリック判定は `<p>` または特定セマンティック要素のテキストノードを対象とする (アンカーや UI 要素のクリックは無視) |

### 3.3 cycle-3 で **明示的に変えない** 項目 (アンチスコープ)

| アンチスコープ | 理由 |
|-------------|------|
| **複数小説の管理** | Q2=A、cycle-3 では 1 編固定 |
| **ユーザーによる小説テキストの差替・追加** | Q1=A、組み込み 1 編のみ |
| **読書ページの UI カスタマイズ** | Q8=A、文字サイズ/フォント/テーマすべて固定 |
| **Options Page への新規 UI 追加** | Q9=A、ユーザーは `chrome-extension://...` を一般サイトとして登録 |
| **`chrome.storage.sync` (端末間同期)** | Q11=A、cycle-1/2 と同じく local のみ |
| **既存 PlaybackTrigger / PlaybackPause の挙動変更** | Q10=A、`<video>` 不在で既存実装が noop |
| **Backlog 項目 B-01〜B-11 の対応** | Q12=A、cycle-3 では読書ページに集中 |
| **読書専用モードのトグル** | Q3=A 採用、Q3=C は不採用 |
| **既読色のリセットボタン** | Q6=B 採用、Q6=C は不採用 (双方向クリックで実質代替可能) |
| **スクロールでの自動既読色変化** | Q5=D 採用、自動検知は導入しない |

---

## 4. 非機能要件 (Non-Functional Requirements)

### 4.1 cycle-1 / cycle-2 NFR の継承

NFR-01〜07 (cycle-1 + cycle-2 で確定) を **すべて維持**。詳細は archive 参照。

特に重要な継承:
- **NFR-01 プライバシー**: 全データ端末ローカル、外部送信なし → 読書ページの読書位置データも `chrome.storage.local` のみ
- **NFR-04 ビルド不要**: 素 JS / HTML / CSS のみで実装 → 読書ページも同方針
- **NFR-06 日本語 UI**: 読書ページの UI 文言と組み込み小説も日本語
- **NFR-07 後方互換性**: 既存の `{ sites, threshold_sec }` データ形式を維持。`reader_state` は **新規追加** であり、cycle-1/2 の既存データに干渉しない

### 4.2 cycle-3 で新規追加する NFR

| ID | 概要 | 詳細 |
|----|------|------|
| **NFR-08** | 起動時の復元パフォーマンス | 読書ページを開いてから状態復元 (青色化 + スクロール) が完了するまで、知覚的に「すぐ」(目安 200ms 以内)。組み込み小説の長さ (例: 数万文字) を想定 |
| **NFR-09** | 既読位置データのサイズ制約 | `reader_state` の保存サイズは数 KB 以下を保つ (クリック位置の整数 + スクロール位置の整数、タイムスタンプ程度)。`chrome.storage.local` の上限 (10MB) には十分収まる |
| **NFR-10** | 読書ページの可読性 (色設計) | 灰色テキストは視認性のある灰色 (コントラスト比 WCAG AA 相当の目安、例: `#888` 以下の暗さで背景が `#fff` の場合 / 背景がダークなら `#aaa` 程度)。青色は灰色より明確に異なる色相で、既読範囲が一目でわかる |

---

## 5. ユーザーシナリオ (代表)

### Scenario S-1: 初回利用時の登録〜読書

1. タカシは cycle-3 の WaitLess を Unpacked ロード
2. Options Page を開き、空状態案内に表示されている「読書ページ」サンプル (`chrome-extension://[実 ID]/reader/reader.html`) をコピペで登録
3. Claude.ai で長めの質問を送信
4. N秒経過 → 自動で読書ページタブが新規作成 / 開く
5. 灰色のテキスト (例: 夏目漱石「坊っちゃん」冒頭) が表示される、ページ先頭にスクロール
6. タカシはスクロールしてテキストを読み進める
7. 「ここまで読んだ」と思った位置でテキストをクリック → クリック位置までが **青色化**
8. クリック直後に Claude.ai 応答完了 → AI タブに自動復帰、読書ページのスクロール位置とクリック位置が保存される

### Scenario S-2: 次サイクルでの続きから再開

1. タカシは数分後に Claude.ai で次の質問を送信
2. N秒経過 → 既存の読書ページタブがアクティブ化される (URL 完全一致で 2 パス探索 Pass 1)
3. **検証**: 前回のスクロール位置が保持されている、クリック位置までが青色化されている (= 続きから再開できる)
4. タカシはスクロールしてさらに読み進める、新しい位置をクリック
5. クリック位置が更新される
6. AI 完了で Claude.ai タブに戻る、新しいスクロール + クリック位置が保存される

### Scenario S-3: 双方向クリック (戻し)

1. タカシは前回のセッションで結構な範囲を青色化していた
2. 戻ってもう一度読み直したい部分が出てきた → その位置 (青色範囲の中) をクリック
3. **検証**: クリック位置までを青に、それより後ろは灰色に **戻る** (Q6=B、双方向)

### Scenario S-4: 拡張機能リロード後の永続化

1. タカシが読書セッションを終え、Chrome を再起動
2. WaitLess は自動で復活、Claude.ai 再開
3. 待ち時間で読書ページが開く
4. **検証**: 前回のスクロール位置 + クリック位置が復元されている

---

## 6. 制約事項 (Constraints)

cycle-1/2 から継承:

- Manifest V3 / 素 JS / ビルド不要 (NFR-04)
- 全データ端末ローカル (NFR-01)
- 日本語 UI (NFR-06)
- Service Worker のアイドルアンロードがあるため `chrome.storage.session` で状態復元 (cycle-1 から既存)

cycle-3 で新規:

- **`chrome-extension://[ID]/...` の URL は拡張機能 ID に依存** — Unpacked ロード時の ID は環境ごとに異なる。ユーザーは Options Page の **空状態案内に表示される動的 URL** をコピペすることで対応 (FR-37)
- **読書ページ内では Web 側の `chrome.runtime.sendMessage` 等は使えるが、Content Script ベースの DOM 監視ロジックは適用されない** (動的注入 PlaybackTrigger は `<video>` がないので noop、cycle-1 から既存挙動)
- **組み込み小説のサイズ** — `extension/reader/` のテキストファイル/JS バンドルが拡張機能のサイズ予算 (Web Store 申請時 100MB 程度) に収まる必要あり。現実的には数十KB 〜 数百KB 程度 (1 編なら問題なし)

---

## 7. 既知のリスク

| リスク | 影響 | 緩和策 |
|-------|------|-------|
| **拡張機能 ID の変更による URL 不整合** | 中 (ユーザー再登録が必要) | 空状態案内に動的 URL を表示。Web Store 申請後は ID 固定なので影響なし |
| **クリック位置の再現精度 (DOM 構造変化に弱い)** | 低 (cycle-3 では小説テキストが固定なので構造変化なし) | クリック位置は文字オフセットで保存、DOM 構造は固定 |
| **`pagehide` イベントが発火しないケース (タブ kill 等)** | 低 | クリック時に **即時保存** することで、最低限「クリックしたところまで」は保証 |
| **読書ページ内での意図しないクリック (UI 要素のクリック)** | 低 | BR-36 でクリック対象を `<p>` 等のテキスト要素に限定 |
| **大きな小説テキストでの色変化パフォーマンス** | 低〜中 | NFR-08 で目安提示。クリック位置でテキストを 2 つの span に分割するアプローチで O(N) を回避 |
| **永続化失敗 (`chrome.storage.local` の quota overflow 等)** | 低 | BR-35 黙って許容、ユーザー操作を妨げない |
| **2 パス探索における `chrome-extension://` のドメイン抽出** | 中 (機能影響大) | Application Design ステージで cycle-1 の `extractDomain` を確認、必要なら最小修正 |

---

## 8. Extension Configuration

| Extension | Enabled | Decided At |
|-----------|---------|-----------|
| Security Baseline | No | Requirements Analysis (cycle-3) |
| Property-Based Testing | No | Requirements Analysis (cycle-3) |

理由: cycle-1 / cycle-2 と同方針 (PoC / 個人ツール)。

---

## 9. 主要要件サマリ

cycle-3 のスコープを 1 行でまとめると:

> **拡張機能内蔵の最小限読書ページ (`reader.html`) を新規実装し、AI 待ち時間中に組み込み小説 1 編を読める体験を提供。クリックで既読範囲を青色化、スクロール位置とクリック位置を `chrome.storage.local` に永続化、起動時に復元。既存の Site 登録モデルにそのまま乗せ、cycle-1/2 のコアロジックは変更しない。**

実装規模: **中** (新規 HTML/CSS/JS 一式 + 永続化 + クリック・スクロールハンドラ + 起動時復元 + 組み込み小説テキスト)。コード変更:
- **新規**: `extension/reader/reader.html`, `extension/reader/reader.css`, `extension/reader/reader.js`, `extension/reader/novel.txt` (or `.json`)
- **修正 (最小)**:
  - `extension/manifest.json` (`web_accessible_resources` 追加で `reader.html` を URL アクセス可能にする、必要なら)
  - `extension/options/options.html` (空状態案内に読書ページの動的 URL 提示を追加)
  - `extension/options/options.js` (動的 URL を生成する `chrome.runtime.getURL(...)` 呼び出し)
  - `extension/README.md` (読書ページの紹介)

cycle-1 のロジック側ファイル (sw/*, content/*, service_worker.js) は **基本的に変更しない**。ただし、Application Design ステージで `extractDomain` の `chrome-extension://` 対応確認結果次第で、最小修正が必要になる可能性あり。

---

## 関連ドキュメント

- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-3 引き継ぎ: `docs/cycle-3-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- cycle-2 archive: `aidlc-docs-waitless-archive/cycle-2/`
- 確認質問: `aidlc-docs/inception/requirements/requirement-verification-questions.md`
