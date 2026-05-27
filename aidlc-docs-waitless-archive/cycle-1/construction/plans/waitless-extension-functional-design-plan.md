# Functional Design Plan — waitless-extension (Unit U1)

**ステージ**: CONSTRUCTION - Unit U1 Functional Design
**ステータス**: アーティファクト生成プラン承認待ち

---

## 1. 目的
Application Design で「Functional Design 送り」とされた **8 つの未確定事項** を中心に、Unit U1 (`waitless-extension`) の業務ロジック詳細を確定する。

## 2. 入力
- `aidlc-docs/inception/application-design/components.md`, `component-methods.md`, `services.md`, `component-dependency.md`, `application-design.md`
- `aidlc-docs/inception/application-design/unit-of-work.md`, `unit-of-work-story-map.md`
- `aidlc-docs/inception/user-stories/stories.md` (US-01 〜 06)

## 3. 想定する成果物 (Step 6 で生成)
- `aidlc-docs/construction/waitless-extension/functional-design/business-logic-model.md` — DOM 監視、N秒判定、タブ切替、設定スキーマの詳細アルゴリズム
- `aidlc-docs/construction/waitless-extension/functional-design/business-rules.md` — バリデーション、優先順位、フォールバック規則
- `aidlc-docs/construction/waitless-extension/functional-design/domain-entities.md` — Site, Settings, RuntimeState 等の詳細スキーマ
- `aidlc-docs/construction/waitless-extension/functional-design/frontend-components.md` — Options Page UI コンポーネント階層、フォームバリデーション

## 4. Application Design 送り 8項目 (本フェーズで確定)

| # | 項目 | 関連質問 |
|---|------|---------|
| 1 | ClaudeSiteAdapter の DOM シグナル特定 | Q1, Q2 |
| 2 | PlaybackTrigger のサイト別セレクタ | Q3 |
| 3 | TabManager 探索ポリシーの詳細 (URL一致 vs ドメイン一致、ウィンドウ範囲) | Q4 |
| 4 | SettingsRepository のスキーマバリデーション詳細 | Q5 |
| 5 | しきい値の上限/下限と範囲外入力の扱い | Q6 |
| 6 | manifest.json の最小権限 | Q7 |
| 7 | 動画自動再生フォールバック | (Q3 で扱う) |
| 8 | 拡張機能アイコンクリック挙動 | Q8 |

## 5. 計画チェックリスト

- [x] 8 つの未確定事項を質問化
- [x] 全 [Answer]: タグの回答取得
- [x] 回答の曖昧性分析、必要なら follow-up → 曖昧性なし
- [x] 4 つの設計アーティファクトを生成
- [x] 関連 FR (FR-01〜11) のカバレッジ最終確認
- [ ] 完了メッセージ提示、承認 ← **承認待ち**

---

## 6. 質問

各質問の `[Answer]:` の右に英字を記入してください。X) Other を選ぶ場合は `[Answer]:` の後ろに自由記述を続けてください。

### Q1: Claude.ai のストリーミング状態 DOM シグナル

Claude.ai の応答ストリーミング中であることを判定するためのシグナルとして、何を見ますか?
注: Claude.ai の現行UIでは、応答中に「停止ボタン (□ アイコン)」が表示され、完了後に消えて代わりに「再送/コピー」等のボタンが現れる挙動があります。

A) 「停止ボタン」要素の **存在** をシグナルとする (存在 = ストリーミング中)
B) アシスタントメッセージ末尾の **アニメーションカーソル要素** の存在をシグナルとする
C) AとBの両方を OR でチェック (どちらかが見つかればストリーミング中)
D) AとBの両方を AND でチェック (両方が見つからないとストリーミング中とは見なさない、誤検知防止)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: A は実装が単純で誤検知少。B は Claude.ai の UI 変更に弱い場合あり。C はゆるく検知 (誤検知側に倒す)、D は厳格 (見落とし側に倒す)。AI 推奨は **A** (シンプル + 誤検知少、UI変更時は壊れたら直す方針)。

---

### Q2: DOM セレクタ特定の戦術

Claude.ai の DOM は React で頻繁にクラス名が変わる可能性があります。セレクタの戦術はどうしますか?

A) **属性ベースセレクタ** ([aria-label], [data-testid] 等) を最優先で使う (クラス名が変わっても壊れにくい)
B) **DOM テキストマッチング** (停止ボタンなら 「Stop」「停止」等のテキストやタイトル属性) を使う
C) AとBの併用 (属性で見つからなければテキストにフォールバック)
D) Functional Design では戦術だけ決め、具体セレクタは Code Generation 時に DevTools で実機確認しながら確定 (ハッカソン文脈)
X) Other (please describe after [Answer]: tag below)

[Answer]: C+D

参考: AI 推奨は **C + D の組み合わせ** (戦術は属性優先 + テキストフォールバック、具体セレクタは Code Generation 時に決める)。

---

### Q3: PlaybackTrigger / 動画自動再生のフォールバック戦略

URL パラメータ (?autoplay=1 等) と動的注入 PlaybackTrigger をどう使い分けますか?

A) **YouTube 限定で URLパラメータ ?autoplay=1 を期待**、それ以外のサイトは PlaybackTrigger を注入してページ内の最初の `<video>` 要素を play() 試行
B) **URLパラメータは使わない**、すべてのサイトで PlaybackTrigger を動的注入し、`<video>` 要素または最初の play ボタン候補をクリック試行
C) **URLパラメータのみで完結**、PlaybackTrigger は実装しない (動かないサイトはユーザー責任)
D) A と同じだが、PlaybackTrigger のセレクタは「YouTube `.ytp-play-button`」「Vimeo `.play`」など主要サイト 2〜3個 + 汎用 `<video>` を試す
X) Other (please describe after [Answer]: tag below)

[Answer]: D

参考: AI 推奨は **D** (主要サイトは固有セレクタ + 汎用 `<video>` フォールバック)。失敗は黙って許容。

---

### Q4: TabManager のタブ探索ポリシー

`findOrOpenPlaySite` の探索範囲と、URL/ドメインの一致ルールはどうしますか?

#### Q4-1: 探索ウィンドウ範囲
A) 現在のフォーカスウィンドウのタブのみ探索
B) すべての Chrome ウィンドウのタブを探索 (複数ウィンドウ運用ユーザーに優しい)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

#### Q4-2: 一致判定ルール
A) **URL 完全一致のみ** (登録した動画URL とタブの URL が完全に一致する場合のみヒット)
B) **同ドメインなら一致と見なす** (登録 youtube.com で、タブが youtube.com の任意ページならヒット)
C) **ドメイン優先 + フォールバックなし**: 登録は domain ベースで保持し、タブも同ドメインを探す。URL は新規作成時のみ使う
D) **URL 完全一致 → なければドメイン一致 でフォールバック** (二段階)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

参考: AI 推奨は Q4-1=**B** (全ウィンドウ)、Q4-2=**C** (ドメイン一致、URLは新規作成時のみ。シンプル)。

---

### Q5: SettingsRepository のスキーマバリデーション

ユーザーが Options Page で入力する `domain` と `url` のバリデーションをどこまで厳しくしますか?

#### Q5-1: domain 入力のバリデーション
A) **緩やか**: 空文字でなければ受け入れる (URL から自動抽出する選択肢も提供)
B) **中程度**: ドメイン名らしい正規表現でチェック (`/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` 程度)
C) **厳格**: 有効な TLD リストで照合
X) Other (please describe after [Answer]: tag below)

[Answer]: B

#### Q5-2: url 入力のバリデーション
A) **緩やか**: `http(s)://` で始まるものだけ受け入れる
B) **中程度**: `new URL(input)` でパース成功し、プロトコルが http/https のもののみ
C) **厳格**: ドメインが Q5-1 で入力された domain と一致するもののみ
X) Other (please describe after [Answer]: tag below)

[Answer]: B

#### Q5-3: domain の重複と並び替え操作
A) 同一 domain の重複登録は **禁止** (UI でエラー表示)
B) 重複を **許容** (ユーザー責任)、ただし優先順位は高い順から評価される
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: AI 推奨は Q5-1=**B**、Q5-2=**B**、Q5-3=**A** (シンプル + 安全)。

---

### Q6: しきい値 (threshold_sec) の範囲

しきい値の有効範囲はどうしますか?

A) **1 〜 60 秒** (デフォルト 5、ユーザーは整数入力)
B) **3 〜 120 秒** (デフォルト 5、より長い待ちにも対応)
C) **0.5 〜 60 秒** (小数点 1桁まで許容、より細かい調整)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

#### Q6-2: 範囲外入力の扱い
A) UI でエラー表示し、保存させない
B) クランプ (1未満は1へ、60超は60へ自動補正) して保存
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: AI 推奨は Q6=**A (1〜60秒)**, Q6-2=**A (エラー表示)**。

---

### Q7: manifest.json の最小権限

`host_permissions` をどこまで限定しますか?

A) `https://claude.ai/*` のみ (Claude.ai 監視に必要な分のみ。`chrome.tabs.update` でタブを開く操作は host_permissions 不要、`chrome.scripting.executeScript` を娯楽タブに使うなら追加権限が必要)
B) `https://claude.ai/*` + `<all_urls>` (PlaybackTrigger を任意の娯楽タブに動的注入するため必須、ただし審査時に説明が必要)
C) `https://claude.ai/*` + `<all_urls>` の代わりに **アクティブタブ権限 (`activeTab`)** を使う (ユーザーが拡張アイコンクリック時のみ動的注入できる、自動切替には弱いかも)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

参考: PlaybackTrigger を自動注入する場合は実質 B が必要。`activeTab` だと切替トリガー時に注入できない。AI 推奨は **B** (機能要件と整合、ストア審査用説明文を README に併記)。

---

### Q8: ツールバー拡張機能アイコンの挙動

ツールバーアイコンをクリックしたとき、何をしますか?

A) **オプションページを開く** (`chrome.runtime.openOptionsPage`)
B) **何もしない** (ポップアップなし、`action.default_title` に「設定は拡張機能管理画面から」と表示するだけ)
C) **小さなポップアップ** で「設定を開く」ボタンと現在の状態を表示
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: AI 推奨は **A** (アイコンクリック → オプションページ。ポップアップを持たないアンチスコープ #7 と整合)。

---

### Q9 (補足): Options Page のUI構成

オプションページの主要 UI 要素を確認させてください (回答内容を business rules / frontend-components で詳細化します)。

下記は全部入りプランです。不要なものや別案があれば指示ください:

- 設定の **空状態案内** (sites=0件 のとき): 「最低 1件 登録すると WaitLess が動作します」のテキスト
- **しきい値入力** (number input、Q6 の範囲)
- **登録サイト一覧** (テーブル形式、列: 優先順位 / ドメイン / URL / 操作[編集/削除/上下移動])
- **新規登録フォーム** (domain入力 + url入力 + 追加ボタン)
- **編集モーダル** または **インライン編集** (どちらか)

A) 全部入りで OK、編集は **インライン編集** (テーブル内で直接編集)
B) 全部入りで OK、編集は **モーダルダイアログ**
C) 編集機能はカット、削除して再登録 する形 (シンプル)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

参考: AI 推奨は **C (編集なし)** または **A (インライン編集)**。MVP/ハッカソン文脈では C が最速。

---

## 7. アーティファクト生成プラン (承認待ち)

回答に基づき、以下の構成で 4つのアーティファクトを生成します。

### 7.1 確定方針サマリ

| 項目 | 方針 |
|------|------|
| ストリーミング検知 | 「停止ボタン要素の存在」を唯一のシグナルとする (Q1=A) |
| DOM セレクタ戦術 | 属性ベース優先 (`aria-label`, `data-testid`) + テキストフォールバック。具体セレクタは Code Generation 時に DevTools で実機確認 (Q2=C+D) |
| 動画自動再生 | 1) URLパラメータで開く 2) 主要サイト固有セレクタ (YouTube `.ytp-play-button`, Vimeo `.vp-controls-play` 等) 3) 汎用 `<video>` 要素の `play()` (Q3=D) |
| タブ探索範囲 | **現在ウィンドウのみ** (Q4-1=A) |
| タブ一致判定 | **ドメイン一致のみ**。Site の `domain` フィールドを基準に既存タブを探索。`url` は新規作成時のみ使用 (Q4-2=C) |
| domain バリデーション | 正規表現 `^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$` (Q5-1=B) |
| url バリデーション | `new URL(input)` パース成功 + protocol が http/https (Q5-2=B) |
| domain 重複 | 禁止、UI でエラー表示 (Q5-3=A) |
| しきい値範囲 | 1〜60 秒整数、デフォルト 5 (Q6=A) |
| 範囲外入力 | UI でエラー表示、保存させない (Q6-2=A) |
| host_permissions | `https://claude.ai/*` + `<all_urls>` (Q7=B) |
| アイコンクリック | `chrome.runtime.openOptionsPage()` でオプションページ開く (Q8=A) |
| Options Page 編集 | 全部入り + **インライン編集** (テーブル内で直接編集) (Q9=A) |

### 7.2 生成する 4つのアーティファクト

#### a) `business-logic-model.md`
中核アルゴリズムの詳細記述:
- **ClaudeSiteAdapter のストリーミング状態判定アルゴリズム** (MutationObserver 監視対象、停止ボタン検知のステートマシン、N秒タイマー管理)
- **WaitOrchestrator の待ち発生サイクル/完了サイクルフロー** (Application Design の §2.2/2.3 を疑似コードで詳細化)
- **TabManager.findOrOpenPlaySite アルゴリズム** (現在ウィンドウ + ドメイン一致探索、優先順位ループ、新規作成 + 注入)
- **PlaybackTrigger 再生試行アルゴリズム** (固有セレクタリスト → `<video>` フォールバック)
- **しきい値の動的反映フロー** (Options 変更 → storage.onChanged → ClaudeSiteAdapter 再読み込み)

#### b) `business-rules.md`
判断ルール / バリデーション / フォールバック規則:
- **入力バリデーション規則** (domain 正規表現、URL パース、重複チェック、しきい値範囲)
- **タブ一致判定規則** (ドメイン抽出、サブドメイン扱いの方針)
- **優先順位再採番規則** (CRUD 後の priority 連番化)
- **エラー時のフォールバック** (タブ消失、再生失敗、Service Worker 再起動、不明メッセージ)
- **重複イベント抑制ルール** (RuntimeState の isWaiting フラグ)

#### c) `domain-entities.md`
データモデルの詳細:
- **Site エンティティ** (フィールド型、制約、JSON 例)
- **Settings エンティティ** (sites + thresholdSec の構造)
- **RuntimeState エンティティ** (isWaiting, claudeTabId, playTabId)
- **Message エンティティ** (sendMessage の各タイプの payload と response 型)
- **chrome.storage.local / session 物理スキーマ** (キー名と保存形式)

#### d) `frontend-components.md`
Options Page の UI 詳細:
- **コンポーネント階層** (`<OptionsApp>` ルート、空状態案内、しきい値設定、サイト一覧テーブル、新規登録フォーム)
- **テーブル列**: 優先順位 / ドメイン / URL / 操作 (削除 / 上下移動 / インライン編集トグル)
- **インライン編集挙動** (行クリックで編集モード切替、保存/キャンセルボタン)
- **フォームバリデーションのUI挙動** (エラー表示位置、リアルタイム vs サブミット時)
- **空状態の文言** (「最低 1件 登録すると WaitLess が動作します」)
- **API 連携ポイント** (各 UI 操作 → どの sendMessage タイプ → どの SettingsRepository メソッド)

### 7.3 関連 FR/US カバレッジ確認

| アーティファクト | カバーする FR | カバーする US |
|----------------|--------------|--------------|
| business-logic-model.md | FR-02, FR-03, FR-05, FR-06, FR-07, FR-08, FR-11 | US-01, US-02, US-03, US-04 |
| business-rules.md | FR-04, FR-11 + 全体的なエラー規則 | US-05 |
| domain-entities.md | FR-04, FR-10, FR-11 | US-05 |
| frontend-components.md | FR-09, FR-11 | US-05, US-06 |

→ FR-01〜11 全カバー、US-01〜06 全カバー。

---

## 8. 承認

このプランで 4 つの functional design アーティファクトを生成してよろしいですか?

- ✅ **承認**: 上記プラン通りに生成
- 🔧 **修正**: 構成、セクション、含める要素への指示
- ➕ **追加**: 含めたい項目があれば指示
