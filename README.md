# ⏳ WaitLess

> **AIの待ち時間を、余暇に変える。**

生成AI（Claude.ai）の出力ストリーミングを待っている数十秒〜数分。その「手持ち無沙汰」を、動画・ゲーム・読書・ショッピングなどの余暇活動に自動で振り向ける Chrome 拡張機能 + VS Code (Kiro) 拡張機能。

AIが応答を返し終えたら、自動で AI のタブに戻る。待ち時間を捨てずに使い切る。

---

## 💡 コンセプト

生成AIに何かを頼むと、答えが返るまで待たされる。その間ただ画面を眺めているのはもったいない。かといって自分で別タブを開くと、戻り忘れて本来の作業に集中できなくなる。

**WaitLess は、この「待ち」を自動でハンドリングする。**

- ⏱️ Claude.ai のストリーミングが **しきい値秒** 以上続いたら、登録済みの娯楽サイトへ自動切替
- ↩️ AI の出力完了を検知したら、**自動で AI タブに戻る**（動画は一時停止、次の待ち時間に続きから再生）
- 🔒 すべての設定・記録は端末ローカル（`chrome.storage.local`）に保存。外部サーバーへの送信なし

「待っている時間」を意識せず、気づけば余暇を挟んで作業に戻れている。それが WaitLess。

---

## 🗺️ 体験フロー

```
AIにプロンプト送信 → ストリーミングがN秒継続 → 娯楽タブに自動切替 → ちょっと余暇
                                                              ↓
                            AI出力完了を検知 → AIタブに自動で戻る（動画は一時停止）
```

| # | ステップ | 説明 |
|:---:|---|---|
| 1 | ✍️ **AIに頼む** | Claude.ai でプロンプトを送信。普段どおり |
| 2 | ⏱️ **待ちを検知** | ストリーミングがしきい値（デフォルト5秒）以上続くと「待ち」と判定 |
| 3 | 🎬 **娯楽へ自動切替** | 登録した娯楽サイト（動画 / ゲーム / SNS / EC / 読書など）に切替。動画は自動再生を試行 |
| 4 | ↩️ **AIに自動で戻る** | 出力完了を検知すると AI タブをアクティブ化。動画は一時停止して次サイクルへ |
| 5 | 📊 **記録が貯まる** | 待ち時間・余暇種別・復帰率などをダッシュボードで可視化。閲覧したページは Bedrock で要約 |

---

## ✨ 主な機能

| 機能 | 概要 | 追加サイクル |
|---|---|---|
| 🔄 **待ち時間 自動切替** | Claude.ai のストリーミングを DOM 監視し、しきい値超で娯楽タブへ切替・完了で自動復帰 | cycle-1 |
| 🎯 **遷移先バリエーション** | 動画 / ゲーム / EC / SNS / ストレッチ瞑想 を公式サポート。任意の URL を登録可 | cycle-2 |
| 📖 **内蔵リーダー** | 拡張機能内蔵の読書ページ。既読範囲の青色化 + スクロール位置を永続化 | cycle-3 |
| 🔌 **IDE 連携 (実験的)** | Kiro IDE 用 VS Code 拡張と WebSocket 連携。AI 待ち中にブラウザ起動 + Kiro 最前面化 | cycle-4 |
| 🎬 **娯楽ポータル** | Netflix 風カードグリッド。12 ジャンル × 6 サイト = 72 カードへ 1 クリック遷移 | cycle-5 |
| 📊 **統計ダッシュボード** | 待ち時間合計・余暇種別内訳・復帰率・週次トレンドを可視化（純粋 HTML/CSS グラフ） | cycle-6 |
| 🧠 **待ち時間文脈の反映** | 遷移先タブの文脈を取得し、AI 入力欄へ反映できる（部分実装） | cycle-7 |
| 🍿 **エンタメ発見ポップアップ** | 待ち検知時に AI タブ上で広告風モーダル（映画予告 / 読書）を表示 | cycle-8 |
| 🔍 **デスクリサーチ ダイジェスト** | 待ち時間に閲覧したページを **Amazon Bedrock (Claude)** で要約し、タスク別に蓄積 | cycle-9 |

---

## 🏗️ アーキテクチャ

WaitLess は **2 つの拡張機能** で構成され、ローカル WebSocket で連携する。両者は独立しても動作する。

```
+------------------------------------------------------------------+
|  Kiro IDE                              Chrome Browser            |
|  [Agent Hooks] ──runCommand──┐         [Content Script]          |
|                              │          claude_site_adapter.js   |
|  [VS Code Extension Host]    │              │ DOM監視            |
|   vscode-extension/          │              ▼                    |
|   extension.ts (IPC Server)  │         [Service Worker]          |
|        │                     │          service_worker.js + sw/* |
|        └────── WebSocket ─────┴────────────────┘                 |
|         ws://127.0.0.1:39472 (外部公開なし)                      |
|                                                                  |
|  娯楽タブ ← 自動切替 / 動画再生・一時停止                          |
|  Amazon Bedrock (Claude) ← デスクリサーチ要約 (cycle-9)          |
+------------------------------------------------------------------+
```

詳細は [`docs/architecture.md`](./docs/architecture.md) を参照。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| 🧩 Chrome 拡張 | Manifest V3 / 素の JavaScript・HTML・CSS（バンドラ・npm 依存ゼロ） |
| 🧑‍💻 VS Code 拡張 | TypeScript（Kiro Agent Hooks 連携、osascript によるウィンドウ制御） |
| 🔗 拡張機能間 IPC | ローカル WebSocket（`ws://127.0.0.1:39472`、外部公開なし） |
| 🗄️ データ保存 | `chrome.storage.local` / `chrome.storage.session`（端末ローカルのみ） |
| 🤖 AI | Amazon Bedrock（Claude）— デスクリサーチ要約。未設定時はローカル簡易要約にフォールバック |
| 👤 認証 | なし（外部送信なし、Claude.ai 自体の認証は本拡張は扱わない） |

### コンポーネント構成（Chrome 拡張）

| Layer | 役割 | 主なコンポーネント |
|---|---|---|
| UI / Page | ユーザーインタフェース | OptionsApp, DashboardPage, PortalPage, ReaderPage |
| Adapter / Boundary | DOM / メッセージとの境界 | ClaudeSiteAdapter, PlaybackTrigger, PlaybackPause |
| Orchestration | 体験フローの調整 | MessageRouter, WaitOrchestrator |
| Domain Services | 単一責務のロジック | TabManager, SettingsRepository, RuntimeState, StatsRepository, LeisureClassifier, ContextRepository, BedrockClient, ResearchRepository |
| Platform | プラットフォーム | Chrome 拡張機能 API, DOM API |

各レイヤーは下位レイヤーのみを呼び出し、上位への通知はイベント（sendMessage / storage.onChanged）を介する。循環依存なし。

---

## 🧭 タブ探索戦略（2パス）

待ち検知時、`TabManager.findOrOpenPlaySite(sites)` が優先順位順に娯楽タブを探す。

```
[Pass 1] URL 完全一致 → 既存タブをアクティブ化（続きから再生）
[Pass 2] ドメイン一致 → 登録 URL に navigate（再生試行）
[Pass 3] 該当なし     → 最優先サイトの URL で新規タブを開く
```

| シナリオ | 該当 Pass | 結果 |
|---|---|---|
| 娯楽タブを 1つも開いていない | Pass 3 | 登録 URL で新規タブ |
| ホームを開いている | Pass 2 | 登録 URL に navigate |
| 登録 URL のタブを開いている（一時停止中） | Pass 1 | アクティブ化、続きから再生 |

---

## 📁 プロジェクト構成

```
aws-summit-japan-2026-hackathon/
├── extension/                  # Chrome 拡張機能 (Manifest V3)
│   ├── manifest.json
│   ├── service_worker.js       # SW エントリ
│   ├── sw/                     # Service Worker モジュール
│   │   ├── message_router.js       # メッセージ受信ハブ
│   │   ├── wait_orchestrator.js     # 待ち→切替→完了→戻りの全体フロー
│   │   ├── tab_manager.js          # タブ集約・2パス探索・再生注入
│   │   ├── settings_repository.js   # 設定 CRUD + バリデーション
│   │   ├── runtime_state.js         # 実行時状態の保持
│   │   ├── ide_bridge.js            # VS Code 拡張との IPC (cycle-4)
│   │   ├── stats_repository.js      # 待ちサイクル統計 (cycle-6)
│   │   ├── leisure_classifier.js    # 余暇ジャンル分類 (cycle-6)
│   │   ├── context_repository.js    # 遷移先文脈取得 (cycle-7/9)
│   │   ├── entertainment_ads.js     # エンタメ発見ポップアップ (cycle-8)
│   │   ├── bedrock_client.js        # Amazon Bedrock クライアント (cycle-9)
│   │   └── research_repository.js   # デスクリサーチ記録 (cycle-9)
│   ├── content/                # Content Script (Claude.ai 監視・娯楽タブ注入)
│   ├── dashboard/              # 統計ダッシュボード (cycle-6)
│   ├── portal/                # 娯楽ポータルページ (cycle-5)
│   ├── reader/                # 内蔵リーダー (cycle-3)
│   ├── player/                # 内蔵プレイヤー (cycle-8、現状未使用)
│   ├── options/               # オプションページ
│   └── README.md              # ユーザー向け（インストール・既知制限）
├── vscode-extension/          # VS Code (Kiro) 拡張機能 (TypeScript)
├── docs/                      # アーキテクチャ・バックログ・各 cycle 引き継ぎ
│   ├── architecture.md
│   ├── backlog.md
│   └── cycle-*-handover.md
└── aidlc-docs-waitless/       # 設計ドキュメント（AI-DLC、cycle-1〜9 アーカイブ）
```

---

## 🚀 インストール（Unpacked ロード）

1. このリポジトリを clone する
2. Chrome で `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. このリポジトリの `extension/` ディレクトリを選択

初期設定（しきい値・娯楽サイト登録）や、内蔵リーダー / 娯楽ポータル / IDE 連携の詳細手順は [`extension/README.md`](./extension/README.md) を参照。

---

## 🔤 ネーミング

**WaitLess** = "Wait"（待つ）+ "Less"（より少なく）

AI の待ち時間（Wait）を、感じさせない（Less）。待ち時間をゼロにはできないが、その体感をゼロに近づける。

---

## 📚 ドキュメント

- 🏛️ [アーキテクチャ](./docs/architecture.md) — コンポーネント・通信パターン・データモデル（cycle-9 完了状態）
- 📋 [バックログ](./docs/backlog.md) — 既知の制限・次にやること（B-01〜B-47）
- 🔁 [cycle 引き継ぎ](./docs/) — `cycle-3-handover.md` 〜 `cycle-10-handover.md`
- 🧩 [ユーザー向け（Chrome）](./extension/README.md)
- 🧑‍💻 [ユーザー向け（VS Code / Kiro）](./vscode-extension/README.md)
- 🗂️ [設計ドキュメント（AI-DLC）](./aidlc-docs-waitless/) — cycle-1〜9 の要件・設計・テスト記録
```