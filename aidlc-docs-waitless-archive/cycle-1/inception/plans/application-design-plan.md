# Application Design Plan — WaitLess

**ステージ**: INCEPTION - Application Design
**ステータス**: 設計アーティファクト生成プラン承認待ち

---

## 1. 目的
Chrome 拡張機能 (Manifest V3) の **コンポーネント分割と責務定義** を行い、後続の Units Generation / Functional Design / Code Generation の前提を作る。詳細業務ロジックは Functional Design (per-unit) で扱うため、ここでは高レベル設計に留める。

## 2. 入力
- `aidlc-docs/inception/requirements/requirements.md` (FR-01 〜 11, NFR-01 〜 06, アンチスコープ)
- `aidlc-docs/inception/user-stories/personas.md` (タカシ)
- `aidlc-docs/inception/user-stories/stories.md` (US-01 〜 06)
- `aidlc-docs/inception/plans/execution-plan.md`

## 3. 想定する成果物 (Step 10 で生成)
- `aidlc-docs/inception/application-design/components.md` — コンポーネント定義 (名前、目的、責務、インタフェース)
- `aidlc-docs/inception/application-design/component-methods.md` — メソッドシグネチャ (高レベル、業務ロジックは Functional Design)
- `aidlc-docs/inception/application-design/services.md` — サービス層の責務とオーケストレーション
- `aidlc-docs/inception/application-design/component-dependency.md` — 依存関係マトリクスと通信パターン
- `aidlc-docs/inception/application-design/application-design.md` — 上記を統合

---

## 4. 計画チェックリスト

- [x] 要件・ストーリーの再読 (体験フロー / アンチスコープ / 用語の再確認)
- [x] Manifest V3 構成 (Service Worker / Content Script / Options Page) の責務分割を決定
- [x] コンポーネント間メッセージング設計を決定 (Q1=D)
- [x] 状態保持の責務を決定 (Q2=A)
- [x] DOM シグナル抽象化の責務を決定 (Q3=A)
- [x] タブ操作 (探索 + アクティブ化 + 新規作成) の責務を決定 (Q4=C)
- [x] 動画自動再生のトリガー責務を決定 (Q5=D)
- [x] ファイル/ディレクトリ構成方針を決定 (Q6=B)
- [x] 全 [Answer]: タグの回答取得
- [x] 回答の曖昧性分析、必要なら follow-up → 曖昧性なし
- [x] 5 つの設計アーティファクトを生成
- [x] 整合性チェック (FR/USカバレッジ、循環依存なし)
- [ ] 完了メッセージ提示、承認 ← **承認待ち**

---

## 5. 質問

各質問の `[Answer]:` の右に英字を記入してください。X) Other を選ぶ場合は `[Answer]:` の後ろに自由記述を続けてください。

### Q1: コンポーネント間メッセージング設計

Manifest V3 では、3層 (Service Worker、Content Script、Options Page) の間で通信する必要があります。どんな通信スタイルにしますか?

A) `chrome.runtime.sendMessage` / `onMessage` ベースのリクエスト・レスポンス型 (シンプル、各送信に応答)
B) `chrome.runtime.connect` ベースのポート (Long-lived) で双方向ストリーム (DOM 監視結果を継続送信したい時に向く)
C) `chrome.storage.onChanged` を介した間接通信 (ストレージの変化をトリガーに動く、疎結合)
D) A + C のハイブリッド (制御メッセージは A、状態反映は C)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

参考: WaitLess の通信は (1) Content Script → Service Worker: 「待ち発生検知」「完了検知」、(2) Service Worker → Content Script: 「動画再生試行依頼」(必要なら)、(3) Options Page → Service Worker: 「設定の参照/更新」あたり。

---

### Q2: 状態保持の責務

「現在 待ち中かどうか」「直近にアクティブ化した娯楽タブID」「直近の Claude.ai タブID」など実行時の状態をどこで持ちますか?

A) Service Worker 内のメモリで保持 (Manifest V3 の Service Worker はアイドル時にアンロードされうる前提で、必要時に `chrome.storage.session` で復元)
B) `chrome.storage.session` に常時保存 (Service Worker のリスタートに耐性、ただし書き込みコストはある)
C) `chrome.storage.local` に永続保存 (再起動後にも残るが、本来は実行時状態なので適切ではない)
D) Content Script に保持 (待ち判定の中心が Content Script なので、そこに状態を寄せる)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Q3: DOM シグナル抽象化の責務

Claude.ai 特有の DOM 監視ロジック (どの要素を見るか、どう判定するか) はどこに置きますか?

A) Content Script の中に「Claude.ai サイトアダプタ」として閉じ込める (将来の他サイト対応に備えた抽象化、ただし今回は Claude.ai のみ)
B) Content Script のメインに直書き (シンプル、抽象化なし、Claude.ai のみ前提)
C) Service Worker 側に共通判定ロジックを置き、Content Script は DOM スナップショット情報を送るだけ (純粋なデータ送信、判定は中央集権)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Q4: タブ操作 (探索 / アクティブ化 / 新規作成) の責務

`chrome.tabs.*` API を呼ぶのは Manifest V3 では Service Worker からが基本ですが、責務上どこで持ちますか?

A) Service Worker 内に「TabManager」相当を置き、すべてのタブ操作をここに集約
B) Service Worker 内に集約 + Options Page から直接呼べる軽いユーティリティとして公開
C) ロジックは Service Worker、Options Page からは `sendMessage` 経由で間接的に呼ぶ
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---

### Q5: 動画自動再生のトリガー責務

切替先タブで動画再生をトリガーする責務はどこに置きますか? (URL 遷移は `chrome.tabs.update` でできるが、再生開始ボタンを押す等のページ内操作は Content Script でないとできない)

A) 切替先タブにも軽量 Content Script を注入し、再生試行を行う (汎用)
B) 登録された URL を毎回開くだけで、再生はサイト側のオートプレイに委ねる (Content Script 注入なし)
C) YouTube など特定サイトに限り、URLパラメータ (`?autoplay=1` 等) で再生試行 (Content Script 注入なし)
D) BとCの併用 (URLパラメータが効くものはそれで、効かないなら Content Script 注入)
X) Other (please describe after [Answer]: tag below)

[Answer]: D

参考: 自動再生はブラウザのオートプレイポリシーに左右されます (要件 §10.3 既知リスク)。失敗時は静かに無視する方針です。

---

### Q6: ファイル/ディレクトリ構成方針

Chrome 拡張のソースツリーのルート配置はどうしますか?

A) リポジトリのルート直下に `src/` を作り、その中に Manifest V3 構成 (manifest.json, service_worker.js, content_script.js, options/ 等) を配置
B) ルート直下に `extension/` (またはそれに準ずる名前) を作り、その中に拡張機能の実体一式を配置 (将来 docs や別の成果物が増えても整理される)
C) ルート直下に `manifest.json` を置き、JS/HTML 等を `js/`, `pages/`, `assets/` のような分散配置
X) Other (please describe after [Answer]: tag below)

[Answer]: B

参考: ストア申請時は manifest.json が含まれるルートをZIP化するため、A か B (拡張本体ディレクトリを 1つに集約) が無難です。

---

## 6. 参考: AI からの推奨案

参考までに、現時点での AI 側の推奨は以下です。回答時の参考情報として:

- **Q1: D** — 制御メッセージは sendMessage/onMessage、設定変更の伝播は storage.onChanged
- **Q2: A** — Service Worker メモリ + 必要に応じ session ストレージで復元 (シンプル、書き込みコスト最小)
- **Q3: A** — Content Script に「Claude.ai サイトアダプタ」として閉じ込め (将来他サイト対応の余地も自然に作れる、ただし今回はアダプタ 1つだけ)
- **Q4: C** — タブ操作は Service Worker に集約、Options Page からは sendMessage 経由 (責務明確)
- **Q5: D** — URLパラメータ優先、それで効かないサイトは軽量 Content Script 注入
- **Q6: B** — `extension/` で拡張本体一式を集約 (リポジトリには docs/aidlc-docs 等もあるため)

---

## 7. 設計アーティファクト生成プラン (承認待ち)

回答に基づく設計の方向性は以下の通りです。この方向性で 5つの設計アーティファクトを生成します。

### 7.1 全体アーキテクチャ (3層 + 1ストア)

```
+----------------------------------------------------------------+
|                    Chrome Browser                              |
+----------------------------------------------------------------+
|                                                                |
|  [Options Page]                                                |
|   options.html / options.js                                    |
|   - 娯楽サイト登録/編集/削除/並び替え                          |
|   - しきい値 (秒) 設定                                         |
|         |                                                      |
|         | (sendMessage)                                        |
|         v                                                      |
|  [Service Worker (background)]                                 |
|   service_worker.js                                            |
|   ├ MessageRouter (sendMessage 受信窓口)                      |
|   ├ WaitOrchestrator (待ち発生→切替→完了→戻り を司る)       |
|   ├ TabManager (chrome.tabs 操作集約)                          |
|   ├ SettingsRepository (chrome.storage.local 読み書き)        |
|   └ RuntimeState (メモリ保持の実行時状態)                     |
|         ^                  |                                   |
|         | (sendMessage)    | (storage.onChanged)              |
|         |                  v                                   |
|  [Content Script (Claude.ai タブに注入)]                       |
|   content_claude.js                                            |
|   └ ClaudeSiteAdapter (DOM監視・しきい値判定・イベント送出)  |
|         |                                                      |
|         | (chrome.runtime.sendMessage)                         |
|         v                                                      |
|     Service Worker へ「待ち発生 / 完了検知」イベント送信      |
|                                                                |
|  [Content Script (娯楽タブに動的注入、必要時のみ)]             |
|   content_play.js                                              |
|   └ PlaybackTrigger (URLパラメータが効かない場合の再生試行)  |
|                                                                |
|  [chrome.storage.local]                                        |
|   - sites: [{ domain, url, priority }, ...]                    |
|   - threshold_sec: 5                                           |
+----------------------------------------------------------------+
```

### 7.2 コンポーネント一覧 (生成予定)

| 層 | コンポーネント | 責務 |
|----|---------------|------|
| Service Worker | **MessageRouter** | sendMessage の受信ハブ。Content Script や Options Page からのメッセージを適切なコンポーネントへルーティング |
| Service Worker | **WaitOrchestrator** | 待ち発生→娯楽タブ切替→完了検知→AIタブ戻り の全体フローをオーケストレーションする中心 |
| Service Worker | **TabManager** | `chrome.tabs.*` 操作を集約。優先順位付きの娯楽タブ探索、アクティブ化、新規作成 |
| Service Worker | **SettingsRepository** | `chrome.storage.local` の読み書き。設定スキーマ (sites, threshold_sec) のバリデーション |
| Service Worker | **RuntimeState** | 待ち中フラグ、直近 Claude.ai タブID、直近娯楽タブID 等の実行時状態 (メモリ + 必要時 session 復元) |
| Content Script (Claude.ai) | **ClaudeSiteAdapter** | Claude.ai 固有 DOM の監視、ストリーミング状態判定、しきい値 N秒 経過判定、Service Worker への待ち発生/完了イベント送出 |
| Content Script (娯楽タブ、動的) | **PlaybackTrigger** | URLパラメータで自動再生が効かないサイト向けに、ページ内の再生ボタンを試行クリック |
| Options Page | **OptionsApp** | 設定UIの状態管理とレンダリング |
| Options Page | **OptionsAPI** | Service Worker (SettingsRepository) と sendMessage で通信する薄いラッパー |

### 7.3 通信パターン (Q1=D ハイブリッド)

| 経路 | 用途 | スタイル |
|------|------|---------|
| Content Script → Service Worker | 「待ち発生」「完了検知」イベント送信 | sendMessage (一方向、応答不要) |
| Service Worker → Content Script (動的注入) | 「再生試行を試みて」依頼 | 動的注入 + sendMessage |
| Options Page → Service Worker | 設定の取得/更新 | sendMessage (リクエスト/レスポンス) |
| Service Worker → Content Script (Claude.ai) | しきい値変更の伝播 | storage.onChanged で間接通知 (Content Script が監視) |

### 7.4 設定スキーマ (`chrome.storage.local`)

```
{
  "sites": [
    { "domain": "youtube.com", "url": "https://youtu.be/...?autoplay=1", "priority": 1 },
    { "domain": "x.com",       "url": "https://x.com/home",              "priority": 2 }
  ],
  "threshold_sec": 5
}
```

### 7.5 ファイル構成 (Q6=B)

```
extension/
├── manifest.json
├── service_worker.js          (Service Worker エントリ)
├── sw/
│   ├── message_router.js
│   ├── wait_orchestrator.js
│   ├── tab_manager.js
│   ├── settings_repository.js
│   └── runtime_state.js
├── content/
│   ├── claude_site_adapter.js (Claude.ai タブに注入)
│   └── playback_trigger.js    (娯楽タブに動的注入)
├── options/
│   ├── options.html
│   ├── options.css
│   ├── options.js             (OptionsApp + OptionsAPI)
└── assets/
    └── icons/                 (16/48/128 サイズの PNG)
```

### 7.6 生成する 5つのアーティファクト

| ファイル | 内容 |
|---------|------|
| `application-design/components.md` | §7.2 のコンポーネント定義 (各コンポーネントの目的、責務、提供インタフェース) |
| `application-design/component-methods.md` | 各コンポーネントの主要メソッドシグネチャ (高レベル、業務ルールの詳細は Functional Design) |
| `application-design/services.md` | WaitOrchestrator を中心としたサービスオーケストレーション (待ち発生サイクル、完了サイクル) |
| `application-design/component-dependency.md` | 依存マトリクス、通信パターン、データフロー図 (循環依存なしを確認) |
| `application-design/application-design.md` | 上記を統合した総合設計ドキュメント |

### 7.7 トレーサビリティ (要件 → コンポーネント)

| FR | 主に対応するコンポーネント |
|----|--------------------------|
| FR-01 (Claude.ai タブ自動検出) | Content Script の `matches` 設定 + ClaudeSiteAdapter |
| FR-02 (応答ストリーミング DOM 監視) | ClaudeSiteAdapter |
| FR-03 (N秒判定) | ClaudeSiteAdapter (しきい値受領は SettingsRepository → storage.onChanged 経由) |
| FR-04 (娯楽サイト登録) | SettingsRepository + OptionsApp |
| FR-05 (既存タブ探索 + 優先順位) | TabManager |
| FR-06 (娯楽タブ自動切替 + 動画再生) | TabManager + PlaybackTrigger (必要時) |
| FR-07 (応答完了 DOM 検知) | ClaudeSiteAdapter |
| FR-08 (Claude.ai タブ自動戻り) | TabManager (WaitOrchestrator 経由) |
| FR-09 (オプションページUI) | OptionsApp + OptionsAPI |
| FR-10 (`chrome.storage.local` 永続化) | SettingsRepository |
| FR-11 (しきい値設定) | OptionsApp + SettingsRepository |

---

## 8. 承認

このアーキテクチャと生成プランで設計アーティファクト 5つ を生成してよろしいですか?

- ✅ **承認**: 上記プランで `application-design/*.md` を生成
- 🔧 **修正**: コンポーネント分割、責務、通信パターン、ファイル構成などの修正指示
- ➕ **追加**: 含めたい要素があれば指示
