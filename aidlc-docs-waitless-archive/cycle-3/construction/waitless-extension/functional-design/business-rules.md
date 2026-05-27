# Business Rules — waitless-extension cycle-3 (Reader Page)

最終更新: 2026-05-27

cycle-3 で新規追加する **BR-31 〜 BR-37** を明文化する。
cycle-1 で確定した BR-01 〜 BR-22 は **すべて維持** され、Reader Page では原則として参照されない (Reader Page は SettingsRepository にも MessageRouter にも依存しないため)。

---

## 1. cycle-3 で新規追加する BR

### BR-31: クリックでの既読範囲指定 (双方向、絶対上書き)

ユーザーが Reader Page のテキストをクリックした時、

- **クリック位置 X** とすると、ReaderState の `readOffset` は **新しいクリック位置で絶対上書き** される (`readOffset = X`)
- これにより、以前のクリック位置より **前** をクリックすると **戻る** (進めた既読範囲を巻き戻す)、**後ろ** をクリックすると **進む**
- 既読範囲は常に「ページ先頭から `readOffset` 文字目まで」の連続区間として表現される

**整合する FR**: FR-33 (双方向)
**整合する Q&A**: Q5=A, Q6=B

### BR-32: スクロール位置と既読範囲は独立した記録

`reader_state` に保存される `readOffset` と `scrollY` は **独立した記録** であり、両方の値で **状態の完全復元** を行う:

- `readOffset` は **クリック時のみ更新** (`saveState`)
- `scrollY` は **クリック時 + 離脱時** に更新 (`saveState` and `savePartial`)
- 起動時の復元では `readOffset` で青色化 → `scrollY` でスクロール の順 (BR-33)

**整合する FR**: FR-34, FR-35
**整合する Q&A**: Q4=C (両方保存), Q7=A (離脱時は scrollY のみ)

### BR-33: 起動時の状態復元順序

ReaderApp.init() における状態復元の処理順序は **必ず以下** に従う:

1. テキストをレンダリング (`renderText`)
2. 既読範囲を青色化 (`applyReadProgress(readOffset)`)
3. スクロール位置を適用 (`window.scrollTo({ top: scrollY })`、`requestAnimationFrame` で 1 フレーム待ってから)

**理由**: 青色化で `<span>` が挿入されることでレイアウトが微妙に変わる可能性があるため、その後にスクロール位置を適用することでユーザーが期待する位置に正確に着地できる。

**整合する FR**: FR-36
**整合する Q&A**: Q3=A

### BR-34: 永続化のタイミング

`reader_state` の `chrome.storage.local` への保存は **以下のタイミングで** 発火する:

| トリガー | 保存内容 | API |
|---------|---------|-----|
| **テキストクリック時** | `readOffset` (新しいクリック位置) + `scrollY` (現在のスクロール) | `await saveState({readOffset, scrollY})` |
| **`pagehide` イベント** (タブを閉じる、ナビゲーション) | `readOffset` (前回値を維持) + `scrollY` (現在のスクロール) | `savePartial({scrollY})` (Promise を捨てる) |
| **`visibilitychange` (state='hidden')** (タブが背面に回る、別タブにフォーカス移動) | 同上 | 同上 |

それ以外のタイミング (スクロール中の interval や `scrollend`) では **保存しない**。

**整合する FR**: FR-34, FR-35
**整合する Q&A**: Q4=A

### BR-35: 永続化失敗の許容

`chrome.storage.local.set()` が失敗した場合、Reader Page は:

- **エラーをユーザーに通知しない** (UI を妨げない)
- **コンソールに warning ログを出すのみ** (`console.warn(...)`)
- **次のクリックや次のサイクルで自動的にリトライ** (新しい saveState が成功すればその値で上書き)

**整合する FR**: 該当 FR は本 BR を要件として含む
**整合する Q&A**: 共通設計判断 (cycle-1 BR-13 と同種の「best-effort」方針)

### BR-36: クリック対象の限定

Reader Page でのクリックは **テキスト本文 (`.paragraph` クラスの `<p>` 要素内のテキストノード)** のみを対象とする:

- ヘッダ、フッタ、ナビゲーション要素のクリックは **無視** (既読範囲の更新も保存もしない)
- 段落以外の要素 (改行のみの `<br>`、Empty `<p>` 等) のクリックは **無視**
- テキスト外の余白 (margin / padding 部分) のクリックは **無視** (caretRangeFromPoint が null を返すか、テキストノード以外を返すケースを排除)

**整合する FR**: FR-33 (クリック対象の妥当性確保)
**整合する Q&A**: 設計上の安全策

### BR-37: 既読オフセットの境界

`readOffset` の値域は:

- **下限**: 0 (ページ先頭、未読状態)
- **上限**: テキスト全体の文字数 (改行含む) — 全文既読状態
- **不正値の処理**: 負の値や上限を超える値は **クランプ** (`Math.max(0, Math.min(totalChars, value))`)
- **読み込み時の不正値**: `loadState` で不正値を検出したら 0 にフォールバック (BR-35 と同方針)

**整合する FR**: FR-34, FR-36
**整合する Q&A**: 設計上のロバスト性

---

## 2. cycle-3 で **修正される** cycle-1 BR

### BR-01 改訂 (cycle-3): ドメイン形式バリデーション拡張

cycle-1 で確定した BR-01 (`DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`) を以下に拡張する:

- **拡張後**: `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` (通常ドメイン) **または** `^[a-z]{32}$` (32 文字英小数字 = 拡張機能 ID)
- **拡張理由**: FR-37 — ユーザーが Options Page から `chrome-extension://[ID]/...` を 1 サイトとして登録できるようにするため
- **検証ロジック**: いずれかの正規表現にマッチすれば valid

**整合する FR**: FR-37
**整合する Q&A**: Application Design Plan Q1=A

### BR-02 改訂 (cycle-3): URL プロトコル許可リスト拡張

cycle-1 の BR-02 (URL プロトコルは `http:` または `https:`) に **`chrome-extension:` を追加**:

- **拡張前**: `http: | https:`
- **拡張後**: `http: | https: | chrome-extension:`
- **拡張理由**: 同上 (FR-37)

**整合する FR**: FR-37
**整合する Q&A**: Application Design Plan Q1=A

---

## 3. cycle-3 で **変更されない** cycle-1 / cycle-2 BR

下記は **すべて維持** される (Reader Page は SettingsRepository / MessageRouter / WaitOrchestrator / TabManager に依存しないため、cycle-1 BR の挙動に影響なし):

| BR | 内容 | cycle-3 での変更 |
|----|------|----------------|
| BR-03 | ドメイン重複の禁止 | なし |
| BR-04 | しきい値の範囲・型 | なし |
| BR-05 | priority の連番化 | なし |
| BR-06 | priority 昇順ソート | なし |
| BR-07 | 2 パスのタブ探索 (URL 完全 → ドメイン) | なし |
| BR-08 | 既存タブヒット時のアクティブ化 | なし |
| BR-09 / BR-09b | 待ち / 完了の DOM 検知 | なし |
| BR-10 | しきい値の即時反映 | なし |
| BR-11 | 動画自動再生 best-effort | なし (Reader Page では `<video>` がないので noop、Q10=A) |
| BR-12 | PlaybackPause | なし (同上) |
| BR-13 | エラー黙認方針 | なし (Reader Page にも継承、BR-35 で再宣言) |
| BR-14 | UI バリデーション (二重防御) | なし (`validateUrl` の protocol 拡張は BR-02 改訂と整合) |
| BR-15〜22 | その他の cycle-1 BR | なし |

---

## 4. cycle-3 BR / FR トレーサビリティ

| FR | 紐づく BR |
|----|----------|
| FR-31 | (実装の挙動に直接対応する BR は内部実装事項) |
| FR-32 | (UI 仕様、BR ではなく `frontend-components.md` で扱う) |
| FR-33 | BR-31, BR-36 |
| FR-34 | BR-32, BR-34, BR-35, BR-37 |
| FR-35 | BR-32, BR-34, BR-35 |
| FR-36 | BR-32, BR-33, BR-37 |
| FR-37 | BR-01 改訂, BR-02 改訂 |
| FR-38 | (本ファイル全体) |

---

## 5. 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- Application Design: `aidlc-docs/inception/application-design/application-design.md`
- Business Logic Model: `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md`
- ドメインエンティティ: `aidlc-docs/construction/waitless-extension/functional-design/domain-entities.md`
- フロントエンド: `aidlc-docs/construction/waitless-extension/functional-design/frontend-components.md`
- cycle-1 BR (継承): `aidlc-docs-waitless-archive/cycle-1/construction/waitless-extension/functional-design/business-rules.md`
