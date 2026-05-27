# Requirements — WaitLess cycle-2

最終更新: 2026-05-27 (Requirements Analysis 完了時点)

---

## 0. Intent Analysis Summary

| 項目 | 内容 |
|------|------|
| **User Request (raw)** | 「娯楽タブへの切替に、YouTube動画への遷移だけでなく、ゲームやECサイトショッピング、SNSチャット、ストレッチ・瞑想指示、への遷移パターンも追加したい」 |
| **Request Type** | Feature (機能拡張 — ユーザー想定対象の拡大) |
| **Scope Estimate** | Light (cycle-1 のコード/データモデルを維持。ドキュメント・オンボーディング中心) |
| **Complexity Estimate** | Simple (タイプ概念は導入せず、`{domain, url, priority}` モデルのまま) |
| **Project Type** | Brownfield (cycle-1 成果物 `extension/` を継承する cycle-2) |

### 設計判断のサマリ (Clarifying Q&A の結果)

ユーザーとの確認の結果、以下の方針に確定:

1. **タイプ概念 (動画/ゲーム/EC/SNS/ストレッチ等のラベル) は導入しない** (Clarification Q1=B)
2. **データモデル `{domain, url, priority}` は cycle-1 のまま** — 新フィールド追加なし
3. **動作モデルも cycle-1 のまま** — URL アクティブ化 + 動画自動再生試行 (`PlaybackTrigger`) + 完了時動画一時停止 (`PlaybackPause`)
4. **拡張機能内蔵のストレッチ/瞑想ページは cycle-2 では実装しない** (Q2=B 撤回)
5. **cycle-2 の意義** = 「動画以外の遷移パターンも公式に想定対象として扱う」というメッセージング・ドキュメンテーション・オンボーディング上の整備、および新ユースケースでの動作検証
6. **Backlog の他項目 (B-01〜B-11) は cycle-2 では対応しない** (Q7=A)
7. **ペルソナはタカシのまま、興味の幅を拡張** (Q8=A)
8. **Security / PBT Extensions は Skip** (PoC/プロトタイプ寄りの位置づけ)

---

## 1. プロジェクト背景と cycle-2 の位置づけ

### 1.1 cycle-1 で達成済の機能 (前提)

cycle-1 で実装済の WaitLess (Chrome 拡張機能 / Manifest V3) は以下を提供:

- Claude.ai のストリーミング応答が N秒以上 続いたら、ユーザー登録の娯楽タブへ自動切替
- Claude.ai 応答完了で AI タブへ即時復帰
- 娯楽タブ側で動画を自動再生試行 / 完了時に動画一時停止 / 続きから再生
- Options Page でサイト登録・しきい値設定 (`chrome.storage.local` 永続化)
- 2 パスのタブ探索戦略 (URL 完全一致 → ドメイン一致 → 新規タブ作成)

詳細は `docs/architecture.md` および `aidlc-docs-waitless-archive/cycle-1/` 参照。

### 1.2 cycle-2 のスコープ

cycle-1 では「娯楽 = YouTube などの動画」が暗黙の前提だったが、cycle-2 ではユーザー視点で **「待ち時間に切り替わる先」のバリエーションを公式化** する。具体的には:

- 動画 (cycle-1 で実装済)
- **ゲーム** (cycle-2 で対象に追加)
- **EC サイトショッピング** (cycle-2 で対象に追加)
- **SNS チャット** (cycle-2 で対象に追加)
- **ストレッチ / 瞑想指示** (cycle-2 で対象に追加 — 外部の動画 / Web アプリを想定)

これらは **データモデル上は同じ「サイト登録」エントリ** として扱う (タイプによる分岐なし)。バリエーション拡張は主にユーザーへのコミュニケーション (README / 空状態案内 / 設定例) で実現する。

---

## 2. ペルソナ (再確認・拡張)

### Persona: タカシ (cycle-1 から継続、行動レンジを拡張)

cycle-1 ペルソナ (`aidlc-docs-waitless-archive/cycle-1/inception/user-stories/personas.md`) を継承。
cycle-2 では **興味/遷移先のレンジを拡張** する位置づけ。

- 役割: AI を日常的に使うナレッジワーカー
- 背景: Claude.ai でリサーチ/コーディング支援を多用、待ち時間に SNS や YouTube に手が出るがコンテキストスイッチで集中力を失う
- **cycle-2 での新たな振る舞い**: 待ち時間に動画を見るだけでなく、気分に応じて以下も行いたい:
  - **ゲーム** で気分転換 (例: 短時間の Web ゲーム)
  - **EC サイト** でほしい物リストの確認、買い物
  - **SNS** で短時間のチャット/フィード閲覧
  - **ストレッチ / 瞑想** で身体・精神のリフレッシュ (集中力維持)

ニーズは cycle-1 と同じ: 「待ち時間が **強制的に有意義** になる仕組みがほしい」「自分で意思決定して切り替えるのではなく、自動で切り替わってほしい」。

---

## 3. 機能要件 (Functional Requirements)

### 3.1 cycle-1 から継承する FR (再記載)

cycle-2 では以下の cycle-1 FR を **そのまま維持** する。詳細は `aidlc-docs-waitless-archive/cycle-1/inception/requirements/requirements.md` 参照。

| ID | 概要 | 維持/変更 |
|----|------|---------|
| FR-01 | Claude.ai のストリーミングが N秒以上で待ち判定 | 維持 |
| FR-02 | 待ち判定時、登録娯楽タブを自動アクティブ化 | 維持 |
| FR-03 | 完了検知で AI タブに自動復帰 | 維持 |
| FR-04 | 娯楽タブが既存(URL一致)なら続きから再生 | 維持 |
| FR-05 | 娯楽タブが既存(ドメイン一致)なら登録 URL に navigate | 維持 |
| FR-06 | 娯楽タブが存在しなければ最高優先サイトを新規タブで開く | 維持 |
| FR-07 | Options Page でサイト追加 (domain + url) | 維持 |
| FR-08 | Options Page で優先順位の並び替え | 維持 |
| FR-09 | Options Page でしきい値 (秒数) 設定 | 維持 |
| FR-10 | しきい値変更が Claude.ai タブに即時反映 | 維持 |
| FR-11 | 動画自動再生試行 (best-effort、ブラウザポリシー次第) | 維持 |

### 3.2 cycle-2 で新規追加する FR

| ID | 名称 | 内容 | 受入条件 |
|----|------|------|---------|
| **FR-21** | 多様な遷移先のサポート | ユーザーは動画以外のサイト (ゲーム / EC / SNS / ストレッチ瞑想等) も Options Page で登録でき、登録した URL は cycle-1 と同じロジックで自動切替されること | ・Options Page で `https://example-game.com/play` のような任意 URL を登録できる<br>・登録したサイトが待ち発生時に自動で開かれる<br>・PlaybackTrigger は動画がないページでも例外を出さずに正常終了する (cycle-1 の best-effort 仕様を継承) |
| **FR-22** | オンボーディング (空状態案内) の拡張 | Options Page の空状態 (`sites.length === 0`) の案内テキストで、動画以外の遷移先 (ゲーム / EC / SNS / ストレッチ瞑想) も登録できることを明示 | ・空状態の案内テキストに 5 種以上の用途例 (動画 / ゲーム / EC / SNS / ストレッチ瞑想) が示されている<br>・各用途のサンプル URL が **コピペで使える形** で提示される (任意で必須ではない、ユーザーが自分で URL を選べる) |
| **FR-23** | README の更新 | `extension/README.md` で対応想定サイトの幅を明示 | ・README に「対応する遷移先パターン」セクションがあり、5 種以上のパターンが明記されている<br>・cycle-1 で「YouTube」中心だった文言が改訂されている |
| **FR-24** | 動画以外サイトでの誤動作なし (動作検証) | ゲーム / EC / SNS / ストレッチ瞑想用 URL に切替えても、PlaybackTrigger / PlaybackPause が **誤動作・例外・コンソールエラー** を引き起こさない | ・代表的なサイト (例: `https://store.steampowered.com/`、`https://www.amazon.co.jp/`、`https://x.com/`、瞑想 Web アプリ) で実機検証して切替正常<br>・コンソールに critical/error レベルのログが出ない (cycle-1 の `Extension context invalidated.` ガード相当) |
| **FR-25** | 拡張機能の `default_title` 文言の更新 | 拡張機能アイコンのツールチップ等が「動画以外の用途も含む」表現になっている | ・`manifest.json` の `action.default_title` が「YouTube」を直接含まない汎用的な文言になっている (例: 「WaitLess (待ち時間を有効活用)」「クリックで設定を開く」) |

### 3.3 cycle-1 から **明示的に変えない** 項目 (アンチスコープ)

混乱を避けるため、cycle-2 で **やらない** ことを明示する:

| アンチスコープ | 理由 |
|-------------|------|
| **タイプ (カテゴリ) フィールドの追加** | Clarification Q1=B により、`{domain, url, priority}` モデルを維持 |
| **拡張機能内蔵のストレッチ / 瞑想指示ページ** | Q2=B 撤回。ユーザーは外部 URL (例: 瞑想 Web アプリ、瞑想 YouTube 動画) を登録する形で対応 |
| **タイプ別の優先順位** | タイプ概念がないため不要 |
| **「気分」モード切替** | タイプ概念がないため不要 |
| **PlaybackTrigger / PlaybackPause のタイプ別分岐** | 全サイト共通で動作 (動画があれば再生・一時停止、なければ何もしない、現状の best-effort 動作を継続) |
| **Backlog 項目 B-01〜B-11 の対応** | Q7=A により今 cycle ではスコープ外 |
| **新ペルソナの追加** | Q8=A、タカシのレンジ拡張のみ |
| **新規 Chrome API の追加** | 通知・ON/OFF トグル等は導入しない |
| **データマイグレーション処理** | データモデルが変わらないため不要 |

---

## 4. 非機能要件 (Non-Functional Requirements)

cycle-2 では cycle-1 の NFR をすべて維持する。新規 NFR の追加はなし。

| ID | 概要 | 維持/変更 |
|----|------|---------|
| NFR-01 | プライバシー: 全データ端末ローカル (`chrome.storage.local`)、外部送信なし | 維持 |
| NFR-02 | パフォーマンス: 切替遅延は知覚的に「すぐ」(目安 1秒以内) | 維持 |
| NFR-03 | レスポンシブ: Options Page は標準的なデスクトップ画面で支障なく操作可能 | 維持 |
| NFR-04 | ビルド不要: 素の JavaScript / HTML / CSS のみ | 維持 |
| NFR-05 | Manifest V3 準拠 | 維持 |
| NFR-06 | UI 表記は日本語 | 維持 |

### NFR-07 (新規、軽微): 後方互換性

- **要旨**: cycle-1 で既に登録済みのユーザーデータ (`chrome.storage.local`) は **そのまま読み込めて動作継続** すること
- **詳細**: cycle-2 ではデータモデルが変わらないため、マイグレーションなしで `{ sites: [...], threshold_sec: N }` がそのまま読める
- **検証**: cycle-1 で登録済みのデータが入った Chrome プロファイルで cycle-2 の拡張機能をリロードし、Options Page と切替動作が正常であることを確認

---

## 5. ユーザーシナリオ (代表)

### Scenario S-1: 新規ユーザーが「ゲーム」を登録

1. タカシは WaitLess を初インストール後、Options Page を開く
2. 空状態の案内テキストに「ゲーム」のサンプルが提示されている
3. タカシは `https://store.steampowered.com/` のような Web ゲームの URL を登録 (domain と url を入力)
4. Claude.ai で重い質問をすると N秒経過で Steam ストアタブが自動オープン
5. Claude.ai 応答完了で Claude タブに自動復帰

### Scenario S-2: 既存ユーザー (cycle-1 から継続) が「ストレッチ用瞑想動画」を追加

1. cycle-1 から WaitLess を使っていたタカシは、cycle-2 で拡張機能が更新される
2. 既存登録 (例: YouTube お気に入り動画) はそのまま動作 (NFR-07)
3. タカシは Options Page で `https://www.youtube.com/watch?v=meditation-xxx` のような瞑想動画 URL を新規登録
4. 待ち時間に瞑想動画タブが開き、自動再生 → 完了で一時停止 → 次サイクルで続きから再生 (cycle-1 と同じ動画ロジック)

### Scenario S-3: タカシが「EC サイト (Amazon)」を登録

1. タカシは `https://www.amazon.co.jp/` を登録
2. Claude.ai 待ち発生で Amazon タブが開く
3. PlaybackTrigger は実行されるが Amazon に動画はないので何もせず終了 (例外なし、FR-24)
4. 完了で Claude タブに復帰、PlaybackPause は動画がないので何もせず終了

---

## 6. 制約事項 (Constraints)

cycle-1 から継承:

- Manifest V3 / 素 JS / ビルド不要 (NFR-04)
- 全データ端末ローカル (NFR-01)
- 日本語 UI (NFR-06)
- Chrome のオートプレイポリシーにより動画再生は best-effort
- Service Worker のアイドルアンロードがあるため `chrome.storage.session` で状態復元

cycle-2 で新規:

- なし

---

## 7. 既知のリスク

| リスク | 影響 | 緩和策 |
|-------|------|-------|
| **新サイトでの DOM 干渉** (例: ゲームサイトで PlaybackTrigger が予期せぬ DOM 操作) | 中 | FR-24 の動作検証で代表的なサイトを実機チェック。PlaybackTrigger は `<video>` 要素のみ対象、それ以外は触らない実装を維持 |
| **EC サイトでの自動再生試行が広告動画を起動** | 低 | PlaybackTrigger は最初に見つかった `<video>` を再生する仕様。広告動画が再生される可能性は cycle-1 から既存。アンチスコープと判断 |
| **ストレッチ用 Web アプリのオフライン挙動** | 低 | 外部サイトの問題でユーザー責任。WaitLess は URL を開くまでが責務 |
| **cycle-1 で確定したセレクタの脆さ (B-03)** | 中 | cycle-2 のスコープ外、Backlog 継続 (cycle-1 から既存) |

---

## 8. Extension Configuration

| Extension | Enabled | Decided At |
|-----------|---------|-----------|
| Security Baseline | No | Requirements Analysis (cycle-2) |
| Property-Based Testing | No | Requirements Analysis (cycle-2) |

理由: PoC / 個人ツール寄りの位置づけ、cycle-1 と同方針。

---

## 9. 主要要件サマリ

cycle-2 のスコープを 1 行でまとめると:

> **cycle-1 のデータモデル / コアロジックを維持しつつ、対象遷移先のバリエーションを公式化 (動画以外もサポート対象と明記)、ドキュメント・オンボーディング・default_title を整備し、新ユースケースで動作検証を行う。**

実装規模: **小〜中** (主に文言更新、UI 微調整、検証)。コード変更があるとすれば:
- `extension/options/options.html` (空状態案内テキスト)
- `extension/options/options.js` (案内テキスト関連)
- `extension/manifest.json` (`action.default_title` の文言)
- `extension/README.md` (対応サイト一覧の追加)

ロジックの変更は **意図的に行わない**。

---

## 関連ドキュメント

- 現状アーキテクチャ: `docs/architecture.md`
- バックログ: `docs/backlog.md`
- cycle-1 → cycle-2 引き継ぎ: `docs/cycle-2-handover.md`
- cycle-1 archive: `aidlc-docs-waitless-archive/cycle-1/`
- 確認質問: `aidlc-docs/inception/requirements/requirement-verification-questions.md`
- 矛盾解消質問: `aidlc-docs/inception/requirements/requirement-clarification-questions.md`
