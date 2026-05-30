# WaitLess — 要件定義: 待ち時間ブラウジング文脈の取り込み

機能名: **Leisure Context Capture & Reflection（待ち時間ブラウジング文脈の取り込み）**
対象 cycle: cycle-7（候補）
最終更新: 2026-05-29
関連: `architecture.md` / `backlog.md` / `cycle-7-handover.md`

---

## 1. 概要

AI の生成待ち時間中、ユーザーは WaitLess によって遷移先（娯楽・関連）タブへ自動で切り替えられ、そこで情報を閲覧する。本機能は、**その待ち時間中に閲覧した遷移先タブの内容を取得して保持し、生成完了で AI タブへ戻った際に、その内容を AI の入力欄へ反映（挿入・引用・要約）できる**ようにする。

デモ文脈（旅行計画）での具体例:

- 遷移先で「箱根観光サイト → Instagram のスポット投稿 → グルメ情報」を閲覧
- AI 出力が完了して AI タブに戻る
- 閲覧していた観光地・スポット・店名などが AI への追加入力として反映され、旅程に組み込まれる

これにより「待ち時間の受動的消費」が「次の AI 指示への能動的インプット」に変わり、待ち時間が成果に接続される。

---

## 2. 背景・目的

| 項目 | 内容 |
|-----|------|
| 課題 | 待ち時間に得た情報（観たい場所・気になった商品・参考記事）が、AI タブに戻ると手動コピペしない限り失われる |
| 目的 | 遷移先での閲覧文脈を AI に橋渡しし、待ち時間を成果へ接続する |
| 価値 | 旅行計画なら「閲覧したスポットを反映した旅程」、リサーチなら「閲覧したソースを反映した要約」が一手で得られる |
| 非目標 | 全自動での無確認入力（後述 NFR の通り、必ずユーザー確認を挟む） |

---

## 3. ユーザーストーリー

- **US-01**: ユーザーとして、待ち時間に閲覧したサイトの内容を、AI タブに戻ったときに AI へ渡したい。再度説明する手間を省くため。
- **US-02**: ユーザーとして、何が取り込まれるかを戻った瞬間に確認し、取り込む/取り込まないを選びたい。意図しない内容の混入を防ぐため。
- **US-03**: ユーザーとして、取り込み形式（原文抜粋 / リンク一覧 / AI 要約）を選びたい。用途に合わせて使い分けるため。
- **US-04**: ユーザーとして、この機能を ON/OFF できるようにしたい。プライバシー上、常時取得を望まない場面があるため。

---

## 4. 機能要件（FR）

| ID | 要件 |
|----|------|
| **FR-01** | 待ち時間中（`isWaiting === true`）にアクティブな遷移先タブから、ページ文脈を取得する |
| **FR-02** | 取得対象は次とする: ページ URL / ページタイトル / 主要見出し（h1–h3）/ 本文抜粋（先頭 N 文字）/ ユーザー選択テキスト（あれば優先）/ 主要リンク（最大 M 件） |
| **FR-03** | 待ち時間中に複数の遷移先を跨いだ場合、各ページの文脈をセッション内の履歴として蓄積する（時系列） |
| **FR-04** | 生成完了を検知し AI タブへ戻った時点で、取り込み候補（FR-03 の履歴）を要約プレビューとしてユーザーに提示する |
| **FR-05** | ユーザーの確認操作（取り込む/破棄/個別選択）に従い、AI タブの入力欄へ反映する |
| **FR-06** | 反映形式を選択できる: (a) 原文抜粋の貼り付け / (b) リンク一覧の貼り付け / (c) Amazon Bedrock による要約文の貼り付け |
| **FR-07** | 反映は AI の入力欄に対する「追記」とし、既存の入力済みテキストを破壊しない |
| **FR-08** | Options Page に本機能の ON/OFF トグル、取得文字数上限、反映形式の既定値を追加する |
| **FR-09** | 取り込みをスキップした履歴は、次の待ちサイクル開始時に破棄する（持ち越さない） |

---

## 5. 非機能要件（NFR）

| ID | 要件 |
|----|------|
| **NFR-01** | すべての処理は端末ローカルで完結する。FR-06(c) の要約のみ Amazon Bedrock を呼ぶ場合があるが、それ以外で外部サーバーへ閲覧内容を送信しない |
| **NFR-02** | 取得する本文抜粋は既定 2,000 文字を上限とし、Options で変更可能（上限 8,000 文字）|
| **NFR-03** | 既存コンポーネントの無変更方針を踏襲する。`sw/tab_manager.js` / `reader/*` / `playback_*.js` / 既存 `content/playback_trigger.js` のコアロジックは原則無変更とし、新規 content script で取得を行う |
| **NFR-04** | 文脈取得は best-effort とする。取得失敗（権限なし・DOM 取得不可）でも待ち→切替→戻りの既存フローを阻害しない |
| **NFR-05** | パスワード入力欄・`type=password`・クレジットカード等の機微情報は取得対象から除外する |
| **NFR-06** | ユーザー確認なしに入力欄へ自動送信・自動実行しない（提示と挿入までで止める）|
| **NFR-07** | 既存 `chrome.storage.local` スキーマ（`sites` / `threshold_sec` / `reader_state` / `stats_events`）に干渉しない。新規キーは `chrome.storage.session` を用いる |
| **NFR-08** | 取得 → 提示の体感遅延は、AI タブ復帰後 500ms 以内を目標とする |

---

## 6. ビジネスルール（BR）

- **BR-01**: 取得対象ドメインは、既存の遷移先（`sites`）および内蔵ポータル/Reader に限定する。任意ページの常時取得はしない。
- **BR-02**: 本文抜粋は可視テキストのみ（`display:none` / `aria-hidden` 要素は除外）。
- **BR-03**: 主要リンク（FR-02）は最大 10 件、同一ドメイン内優先で抽出する。
- **BR-04**: 取り込みプレビューは、取得元 URL を必ず併記する（出典の明示）。
- **BR-05**: FR-06(c) の Bedrock 要約は、取得テキストを 1 回の `InvokeModel` で「箇条書き 5 行以内」に整形する。

---

## 7. データモデル

### LeisureContextSnapshot（新規）

```js
/**
 * @typedef {Object} LeisureContextSnapshot
 * @property {number} tabId        取得元の遷移先タブID
 * @property {string} url          取得元 URL
 * @property {string} title        ページタイトル
 * @property {string[]} headings   主要見出し（h1–h3、最大 10 件）
 * @property {string} excerpt      本文抜粋（NFR-02 の上限まで）
 * @property {string} selection    ユーザー選択テキスト（無ければ空文字）
 * @property {{text:string,href:string}[]} links  主要リンク（最大 10 件）
 * @property {number} capturedAt   取得時刻（Date.now()）
 */
```

### chrome.storage.session の保存形式（新規キー `leisure_context`）

```json
{
    "leisure_context": {
        "claudeTabId": 123,
        "items": [
            {
                "tabId": 456,
                "url": "https://www.hakone.or.jp/",
                "title": "箱根観光協会",
                "headings": ["箱根の見どころ", "モデルコース"],
                "excerpt": "箱根は…",
                "selection": "",
                "links": [{ "text": "大涌谷", "href": "https://..." }],
                "capturedAt": 1717200003000
            }
        ]
    }
}
```

`leisure_context` はセッション専用キー。待ちサイクル終了（取り込み or 破棄）でクリアする（FR-09）。既存スキーマには干渉しない（NFR-07）。

---

## 8. メッセージタイプ（追加）

すべて `chrome.runtime.sendMessage({ type, payload })` 形式。

| Type | 方向 | Payload | Response |
|------|------|---------|---------|
| `CONTEXT_CAPTURE` | Content（遷移先）→ SW | `LeisureContextSnapshot` | `{ ok }` |
| `CONTEXT_OFFER` | SW → Content（AI タブ） | `{ items: LeisureContextSnapshot[] }` | なし |
| `CONTEXT_INJECT` | Content（AI タブ）→ SW / または UI 内完結 | `{ format: 'excerpt'\|'links'\|'summary', selectedTabIds: number[] }` | `{ ok, text }` |
| `CONTEXT_DISCARD` | Content（AI タブ）→ SW | `{ claudeTabId }` | `{ ok }` |

---

## 9. 想定コンポーネント（新規・改修）

| 区分 | コンポーネント | 配置 | 責務 |
|-----|--------------|------|------|
| 新規 | LeisureContextCapturer | `content/leisure_context_capturer.js`（遷移先タブへ動的注入） | FR-01/02/03 の取得。`playback_trigger.js` と同様に待ち時に注入 |
| 新規 | ContextReflector | `content/context_reflector.js`（AI タブ静的注入 or 既存 adapter 拡張） | FR-04/05/06/07 の提示・挿入 UI |
| 新規 | ContextRepository | `sw/context_repository.js` | `chrome.storage.session.leisure_context` の CRUD（FR-09 のクリア含む）|
| 改修（追記中心） | WaitOrchestrator | `sw/wait_orchestrator.js` | 待ち開始で Capturer 注入、完了で Reflector へ `CONTEXT_OFFER` |
| 改修（追記中心） | OptionsApp | `options/*` | FR-08 の設定 UI |
| 既存活用 | IdeBridge / Bedrock 経路 | `sw/ide_bridge.js` ほか | FR-06(c) の要約に既存 Bedrock 呼び出し経路を再利用 |

---

## 10. 受け入れ基準（Acceptance Criteria）

- **AC-01**（FR-01/04）: 待ち時間中に遷移先で箱根観光サイトを閲覧 → 生成完了で AI タブに戻ると、取り込み候補プレビューに当該ページの URL・タイトル・抜粋が表示される。
- **AC-02**（FR-03）: 待ち時間中に 2 つ以上の遷移先を閲覧 → 戻ると両方が時系列で候補に並ぶ。
- **AC-03**（FR-05/07）: 「取り込む」を選ぶと、AI 入力欄に内容が**追記**され、既存の入力文字は消えない。
- **AC-04**（FR-06）: 反映形式を「リンク一覧」にすると、選択テキストや本文ではなくリンクのみが挿入される。
- **AC-05**（FR-06c / BR-05）: 反映形式を「AI 要約」にすると、Bedrock が 5 行以内に整形した要約が挿入される。
- **AC-06**（US-02 / NFR-06）: 確認操作をしない限り、入力欄は一切変更されない。
- **AC-07**（NFR-05）: パスワード欄等の機微情報を含むページでも、機微情報は取得・提示されない。
- **AC-08**（FR-09）: 取り込みをスキップして次の待ちサイクルに入ると、前回の候補は破棄されている。
- **AC-09**（NFR-04）: 取得が失敗しても、待ち→切替→完了→戻りの既存動作は正常に完了する。

---

## 11. スコープ外（Out of Scope）

- 取り込んだ内容を AI に**自動送信・自動実行**すること（提示と挿入まで）
- 任意（未登録）ドメインからの取得
- 画像そのものの解析（画像は URL のみ。OCR・画像理解は対象外）
- 休日/平日プロファイルの自動判定（別機能 / 別 cycle）

---

## 12. 未決事項（Open Questions）

- **OQ-01**: AI タブ入力欄への挿入は DOM 直接操作（`execCommand`/`InputEvent`）か、クリップボード経由＋ユーザー貼り付けか。Claude.ai の入力欄実装に依存（要 DOM 調査）。
- **OQ-02**: Bedrock 要約（FR-06c）を Chrome 拡張単体（IDE 連携なし）の場合にどの経路で呼ぶか。cycle-4 の IPC は IDE 前提のため、ブラウザ単体用の呼び出し方式を別途定義する必要あり。
- **OQ-03**: SNS（Instagram 等）は DOM 構造が動的かつ規約上の制約があるため、取得対象を「タイトル＋URL のみ」に限定するか要検討。
