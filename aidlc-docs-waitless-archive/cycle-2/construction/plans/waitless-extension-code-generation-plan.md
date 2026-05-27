# Code Generation Plan — waitless-extension (cycle-2)

最終更新: 2026-05-27

このプランは cycle-2 の Code Generation で実行する全ステップを **単一の真実のソース** として記述する。各ステップ完了直後に [x] へ更新する。

---

## Unit Context

| 項目 | 内容 |
|------|------|
| **Unit Name** | `waitless-extension` (cycle-1 から継承する単一ユニット) |
| **Project Type** | Brownfield (cycle-1 成果物を継承) |
| **Workspace Root** | `/Users/nt-240003/workspace/aws-summit-japan-2026-hackathon` |
| **Application Code Path** | `extension/` 配下 |
| **Documentation Path** | `aidlc-docs/construction/waitless-extension/code/` |
| **依存ユニット** | なし (単一ユニット) |
| **新規データエンティティ** | なし (cycle-1 の Site / Settings / RuntimeState を維持) |
| **既存ファイル変更方針** | 既存ファイルを **in-place で modify** する (`*_modified.js` のような重複ファイルを作らない) |

## FR トレーサビリティ (cycle-2 で実装する FR)

| FR ID | 内容 | 該当ステップ |
|-------|------|-------------|
| **FR-21** | 多様な遷移先のサポート (任意 URL を登録可能) | 検証のみ (既存実装で対応済) — Step 9 (Build & Test) |
| **FR-22** | Options Page 空状態案内の拡張 (5 種以上の用途例 + サンプル URL) | Step 3, Step 4, Step 5 |
| **FR-23** | README の更新 (対応する遷移先パターン一覧) | Step 6 |
| **FR-24** | 動画以外サイトでの誤動作なし (実機検証) | Step 9 (Build & Test) で検証 |
| **FR-25** | `manifest.json` の `default_title` 文言を汎用化 | Step 2 |
| **NFR-07** | 後方互換性 (cycle-1 で登録済データのマイグレーションなし動作) | Step 9 (Build & Test) で検証 |

## Story Mapping (cycle-1 archive を参照)

cycle-2 で新たな US は作成していない (User Stories ステージ SKIP)。FR-21〜25 は cycle-1 の US-04 (登録サイトを切替先にできる) / US-05 (設定 UI) / US-06 (オンボーディング/空状態) の延長線上にある。

---

## Generation Steps

下記ステップを **順番に** 実施する。各ステップ完了時に [x] にチェック。

### Step 1: Pre-flight チェック

- [x] cycle-1 の `extension/` 配下の主要ファイル状態を確認 (manifest.json / options/* / README.md は既読、構造は cycle-1 archive と整合)
- [x] cycle-2 で **ロジック側 (sw/*, content/*, service_worker.js)** には変更を加えないことを確認 (Skip 対象)
- [x] cycle-2 用の `aidlc-docs/construction/waitless-extension/code/` ディレクトリ作成準備
- [x] `aidlc-docs/construction/build-and-test/` ディレクトリ作成準備

---

### Step 2: `extension/manifest.json` の `default_title` を汎用文言に更新 (FR-25)

- [x] 現状: `"default_title": "WaitLess (クリックで設定を開く)"`
- [x] 既に「YouTube」を含まない汎用文言ではあるが、cycle-2 のメッセージング (動画以外も対象) との整合をより明確にするため、以下のいずれかに更新:
  - **採用案**: `"default_title": "WaitLess — 待ち時間を有効活用 (クリックで設定)"` (汎用 + 操作示唆)
- [x] `extension/manifest.json` を直接編集
- [x] 他のフィールド (`description`、`permissions` 等) は変更しない (cycle-2 アンチスコープ)

#### 注意点
- `description` は既に「動画やSNS」を含むため、せっかくなのでこの段階で軽くアップデートしても良い。ただしユーザー要望は「default_title」中心 (FR-25) なので、`description` の表現は「動画やSNSなどの娯楽」→「動画・ゲーム・SNS・EC・ストレッチなどの娯楽」程度の最小変更に抑える。

---

### Step 3: `extension/options/options.html` の空状態案内マークアップ更新 (FR-22)

- [x] 現状の空状態 (`#empty-state`) は `<p>まだ登録がありません。</p><p>最低 1件 登録すると WaitLess が動作します。<br>優先順位の上位から、開いている同ドメインのタブが選ばれます。</p>` の 2 段落のみ
- [x] 以下を追加:
  - 「こんな使い方ができます:」というガイダンス見出し
  - **5 種の用途例** (動画 / ゲーム / EC / SNS / ストレッチ瞑想) を箇条書き
  - 各用途に **サンプル ドメイン と URL** をコピペで使える形で表示 (`<code>` で囲む)
- [x] サンプル URL は実在する代表的な URL (登録例として参考になるもの)
- [x] レイアウトは既存の `.empty-state` クラスのスタイルに収まる範囲で
- [x] `data-testid` を新規要素にも付与 (例: `data-testid="empty-state-examples"`)

#### サンプル例の確定 (案)

| 用途 | ドメイン | サンプル URL |
|------|---------|-------------|
| 動画 | `youtube.com` | `https://www.youtube.com/feed/subscriptions` |
| ゲーム | `games.greggman.com` (HTML5 ゲーム) | `https://games.greggman.com/game/htmlbird/` |
| EC | `amazon.co.jp` | `https://www.amazon.co.jp/gp/your-account/order-history` |
| SNS | `x.com` | `https://x.com/home` |
| ストレッチ瞑想 | `youtube.com` | `https://www.youtube.com/results?search_query=10分+ストレッチ` |

注: ストレッチ瞑想は YouTube ベースの提案 (動画用ドメインとも重複可)。実装上、ドメインが重複する登録 (`youtube.com` の動画と瞑想) はバリデーションで「重複」エラーになるため、ユーザーが片方を登録する前提で良い。サンプル提示としては OK。

#### マークアップ案

```html
<div id="empty-state" class="empty-state" data-testid="empty-state" hidden>
  <p>まだ登録がありません。</p>
  <p>最低 1件 登録すると WaitLess が動作します。<br>
    優先順位の上位から、開いている同ドメインのタブが選ばれます。</p>

  <div class="empty-examples" data-testid="empty-state-examples">
    <p class="empty-examples-title">こんな使い方ができます:</p>
    <ul class="empty-examples-list">
      <li>
        <span class="example-emoji" aria-hidden="true">🎬</span>
        <strong>動画</strong> — 例: <code>youtube.com</code> /
        <code>https://www.youtube.com/feed/subscriptions</code>
      </li>
      <li>
        <span class="example-emoji" aria-hidden="true">🎮</span>
        <strong>ゲーム</strong> — 例: <code>games.greggman.com</code> /
        <code>https://games.greggman.com/game/htmlbird/</code>
      </li>
      <li>
        <span class="example-emoji" aria-hidden="true">🛒</span>
        <strong>EC ショッピング</strong> — 例: <code>amazon.co.jp</code> /
        <code>https://www.amazon.co.jp/gp/your-account/order-history</code>
      </li>
      <li>
        <span class="example-emoji" aria-hidden="true">💬</span>
        <strong>SNS チャット</strong> — 例: <code>x.com</code> /
        <code>https://x.com/home</code>
      </li>
      <li>
        <span class="example-emoji" aria-hidden="true">🧘</span>
        <strong>ストレッチ・瞑想</strong> — 例: <code>youtube.com</code> /
        <code>https://www.youtube.com/results?search_query=10分+ストレッチ</code>
      </li>
    </ul>
    <p class="empty-examples-note">※ 上記は一例です。お好みのサイトを登録してください。</p>
  </div>
</div>
```

---

### Step 4: `extension/options/options.css` のスタイル追加 (FR-22 補助)

- [x] Step 3 で追加したマークアップに対応するスタイル追記:
  - `.empty-examples` (区切り線、上余白)
  - `.empty-examples-title` (用途見出し)
  - `.empty-examples-list` (箇条書きリスト、ulのインデント / マーカー調整)
  - `.example-emoji` (絵文字サイズ調整)
  - `.empty-examples-note` (補足の小さい字)
  - `.empty-state code` (インラインコード風のスタイル、`<code>` の見せ方)
- [x] 既存スタイル (`.empty-state` の中央寄せ等) との整合を保つ
- [x] レスポンシブ性 (狭い画面でも崩れない) を維持

---

### Step 5: `extension/options/options.js` (空状態関連の挙動変更があれば対応)

- [x] options.js の `renderSites()` における `empty.hidden = false;` 制御は **そのまま** 維持
- [x] HTML 側で完結するため、JS 側は **変更不要** の見込み
- [x] 変更不要であることを確認したらこのステップは [x] にして次へ

---

### Step 6: `extension/README.md` の更新 (FR-23)

- [x] 現状の README には「動画やSNS」程度の記述しかない
- [x] 以下のセクションを追加または更新:
  1. **「特徴」** (冒頭) を更新: 「動画・ゲーム・SNS・EC・ストレッチ瞑想など、お好みの娯楽サイト」と幅を明示
  2. **新規セクション「対応する遷移先パターン」** を追加 (5 種類 + サンプル URL の表)
  3. **「初期設定」** の例で動画以外も挙げる
  4. **「動作の概要」** の表現を「娯楽」一般化
- [x] 既存セクション「アンチスコープ」「プライバシー」「開発メモ」「ライセンス」「アイコンについて」「動作要件」「インストール」「既知の制限事項」は **そのまま維持**
- [x] cycle-1 で実装済の機能 (動画自動再生、続きから再生、2パス探索) を否定する表現は入れない

---

### Step 7: `aidlc-docs/construction/waitless-extension/code/code-generation-summary.md` の作成

- [x] cycle-2 のコード変更サマリ (FR トレーサビリティ + 変更ファイル一覧 + 変更前後の差分概要) を記述
- [x] 変更したファイル / 変更しなかったファイルを明記
- [x] cycle-1 サマリとの差分が分かるように構造化

---

### Step 8: 自己レビュー (オプション、軽量)

- [x] 各変更ファイルを読み直し、cycle-1 のロジックに副作用がないか目視確認
- [x] 文言がポジティブで、「YouTube」のような特定サイトに偏っていないか確認
- [x] FR-21 (多様な遷移先のサポート) は実装変更なし、検証で対応することを再確認
- [x] `getDiagnostics` で manifest.json / options.html / options.css / README.md の Lint エラーなしを確認

---

### Step 9: Build & Test 用の検証手順ドキュメント作成 (Build & Test ステージへの引き渡し)

- [x] (Code Generation の範囲では「ドキュメントの土台」だけ。Build & Test ステージで完成させる)
- [x] `aidlc-docs/construction/build-and-test/build-instructions.md` を作成 (cycle-2 でも Unpacked ロードの手順は cycle-1 と同一だが、参照のしやすさのため概要を記載)
- [x] `aidlc-docs/construction/build-and-test/integration-test-instructions.md` を作成 (cycle-2 で追加検証する 4 シナリオ + UI/メッセージング 3 シナリオ + cycle-1 リグレッション主要シナリオへの参照)

---

## 完了条件 (Code Generation Part 2 完了の判定)

- [x] Step 2〜7 のすべてが [x]
- [x] Step 8 (自己レビュー) が [x]
- [x] Step 9 (検証手順ドキュメント) が [x]
- [x] 重複ファイル (`*_modified.js`, `*_new.html` 等) が作成されていないこと
- [x] cycle-1 のロジック側ファイル (`sw/*`, `content/*`, `service_worker.js`) に変更がないこと
- [x] `aidlc-state.md` の Code Generation 進行状況を更新する (次に実施)

---

## 関連ドキュメント

- 要件: `aidlc-docs/inception/requirements/requirements.md`
- 実行計画: `aidlc-docs/inception/plans/execution-plan.md`
- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
