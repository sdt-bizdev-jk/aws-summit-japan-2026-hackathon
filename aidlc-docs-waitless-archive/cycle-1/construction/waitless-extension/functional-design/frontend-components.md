# Frontend Components — waitless-extension (Options Page)

**プロジェクト**: WaitLess
**ユニット**: U1 (waitless-extension)
**フェーズ**: CONSTRUCTION - Functional Design
**作成日**: 2026-05-26

このドキュメントは、Unit U1 のオプションページ UI を詳細化する。Q9=A (全部入り、インライン編集) に基づく構成。

---

## 1. 画面構成

オプションページは **単一ページ** で、以下のセクションを縦に並べる。

```
+------------------------------------------------------------+
|  [WaitLess アイコン] WaitLess                                |
|                                                            |
|  [サブタイトル: 生成AIの待ち時間を、あなたの娯楽時間に]      |
+------------------------------------------------------------+

+------------------------------------------------------------+
|  ⚙ しきい値設定                                              |
|                                                            |
|  応答が __[5]__ 秒 以上 続いたら、登録した娯楽サイトに切替する |
|         [▲▼] (number input)                                |
|  範囲: 1 〜 60 秒    [保存] ボタン                          |
|                                                            |
|  (エラー表示エリア: バリデーション失敗時のみ表示)             |
+------------------------------------------------------------+

+------------------------------------------------------------+
|  📋 登録した娯楽サイト                                       |
|                                                            |
|  (空状態の場合)                                             |
|  ┌──────────────────────────────────────────┐               |
|  │  まだ登録がありません                       │               |
|  │  最低 1件 登録すると WaitLess が動作します。│               |
|  │  優先順位の上位から、開いている同ドメインの │               |
|  │  タブが選ばれます。                          │               |
|  └──────────────────────────────────────────┘               |
|                                                            |
|  (登録あり: テーブル表示)                                    |
|  ┌─────┬───────────────┬──────────────────────────┬──────┐  |
|  │ 順  │ ドメイン       │ URL                       │ 操作 │  |
|  ├─────┼───────────────┼──────────────────────────┼──────┤  |
|  │ 1   │ youtube.com   │ https://youtu.be/xxx...  │ ✏ 🗑 ▲▼│  |
|  │ 2   │ x.com          │ https://x.com/home       │ ✏ 🗑 ▲▼│  |
|  └─────┴───────────────┴──────────────────────────┴──────┘  |
|                                                            |
+------------------------------------------------------------+

+------------------------------------------------------------+
|  ➕ 新規登録                                                  |
|                                                            |
|  ドメイン: [_________________________]  例: youtube.com      |
|  URL:      [________________________________________]        |
|             例: https://youtu.be/xxx?autoplay=1            |
|                                                            |
|  [追加] ボタン                                              |
|                                                            |
|  (エラー表示エリア)                                          |
+------------------------------------------------------------+
```

---

## 2. コンポーネント階層 (素のJS / DOM ベース)

素のJS構成のため React 風のコンポーネントツリーではないが、論理的な区分を示す:

```
<OptionsApp>
├── <Header>
├── <ThresholdSection>
│   ├── number input (1-60)
│   ├── 保存 ボタン
│   └── エラーメッセージ領域
│
├── <SitesSection>
│   ├── (sites.length === 0 の場合) <EmptyStateMessage>
│   └── (sites.length > 0 の場合) <SitesTable>
│       └── <SiteRow> (繰り返し)
│           ├── 表示モード: priority / domain / url / [編集 / 削除 / ▲ / ▼]
│           └── 編集モード (インライン): domain input / url input / [保存 / キャンセル]
│
└── <AddSiteForm>
    ├── domain input
    ├── url input
    ├── 追加 ボタン
    └── エラーメッセージ領域
```

実装上は `<OptionsApp>` の DOM ルートを `options.html` に作り、`options.js` に `OptionsApp.init()` から各セクションを描画する関数を分けて持つ。

---

## 3. 各セクションの詳細

### 3.1 Header

| 項目 | 内容 |
|------|------|
| 要素 | h1 (アイコン + 「WaitLess」)、p (サブタイトル) |
| 動的要素 | なし (静的 HTML) |

### 3.2 ThresholdSection

| 項目 | 内容 |
|------|------|
| HTML 要素 | `<input type="number" min="1" max="60" step="1">` + `<button>保存</button>` |
| state | `currentThresholdSec`, `isDirty` (入力値が保存値と異なるか) |
| 初期化 | OptionsAPI.getSettings() で取得した thresholdSec を input に表示 |
| バリデーション | 整数、1-60 の範囲、値が変更されているかをチェック |
| 保存ボタンの挙動 | 1) クライアント側バリデーション → エラーは即時表示 2) OptionsAPI.setThresholdSec(sec) → 結果に応じて成功/失敗メッセージ |
| エラー表示 | 「しきい値は 1 〜 60 の整数で入力してください」(BR-04) |

### 3.3 SitesSection (空状態 / 一覧)

#### 空状態 (`sites.length === 0`)

| 項目 | 内容 |
|------|------|
| 要素 | div with テキスト |
| 文言 | 「まだ登録がありません。最低 1件 登録すると WaitLess が動作します。優先順位の上位から、開いている同ドメインのタブが選ばれます。」 |
| 関連 US | US-06 (オンボーディング) |

#### 一覧テーブル (`sites.length > 0`)

| 列 | 内容 | 編集可否 |
|----|------|---------|
| 順 | priority (1, 2, 3, ...) | 編集不可 (UI 経由で並び替え) |
| ドメイン | domain | インライン編集可 |
| URL | url | インライン編集可 |
| 操作 | ✏(編集) / 🗑(削除) / ▲(上に移動) / ▼(下に移動) | ボタン |

#### 操作の挙動

##### 編集 (✏)
- そのセルの値を input 要素に置き換える (インライン編集)
- 同じセルに [保存] / [キャンセル] ボタンが現れる
- 保存: バリデーション → OptionsAPI.updateSite({ originalDomain, domain, url })
- キャンセル: 元の表示に戻る

##### 削除 (🗑)
- `confirm()` ダイアログで「{domain} を削除しますか?」確認
- OK: OptionsAPI.deleteSite(domain) → 成功すれば一覧再描画
- 削除後、priority が再採番される (BR-05)

##### 上に移動 (▲)
- priority が 1 (最上位) のときは無効 (グレーアウト)
- それ以外は orderedDomains を作成し、OptionsAPI.reorderSites(orderedDomains)
- 同様に下に移動 (▼) は priority が末尾のときは無効

### 3.4 AddSiteForm

| 項目 | 内容 |
|------|------|
| HTML 要素 | `<input type="text" id="add-domain">` + `<input type="url" id="add-url">` + `<button>追加</button>` |
| state | `domainValue`, `urlValue`, `isSubmitting` |
| バリデーション | BR-01 (domain), BR-02 (url), BR-03 (重複) |
| エラー表示 | 入力欄の下にメッセージ。複数のエラー (domain と url 両方) は箇条書き |
| 成功時 | 入力欄をクリア → SitesSection を再描画 |

---

## 4. インライン編集の挙動 (詳細)

### 4.1 状態遷移

```
[表示モード] --(編集ボタン ✏ クリック)--> [編集モード]
[編集モード] --(保存ボタンクリック)----> バリデーション
    OK -> updateSite -> [表示モード] (新値)
    NG -> エラー表示 (編集モード継続)
[編集モード] --(キャンセルボタンクリック)-> [表示モード] (元の値)
```

### 4.2 同時編集の制約
- 一度に編集モードにできる行は **1 行のみ** (シンプル化)
- 別の行の ✏ をクリックすると、未保存の変更は破棄して新しい行が編集モードに入る (確認ダイアログ任意)

---

## 5. フォームバリデーションの UI 挙動

### 5.1 バリデーションのタイミング

| タイミング | 実行内容 |
|----------|---------|
| `<input>` の `blur` イベント | 該当フィールドのみバリデーション、エラーをそのフィールド下に表示 |
| 保存/追加ボタンクリック | 全フィールドのバリデーション → エラーがあれば一覧表示し、フォーカスを最初のエラーフィールドに |
| OptionsAPI 呼び出し失敗 | サーバ側 (Service Worker) のエラー reason をフォーム下にメッセージ表示 |

### 5.2 エラー表示のスタイル

- フィールド下に赤文字 (例: `color: #d32f2f`) でメッセージ
- 複数エラーは `<ul>` で箇条書き
- 成功時は緑チェック (例: `color: #388e3c`) で「保存しました」を一時表示 (3秒後消滅)

---

## 6. API 連携ポイント (UI → OptionsAPI → SettingsRepository)

| UI 操作 | sendMessage type | OptionsAPI メソッド | SettingsRepository メソッド |
|---------|------------------|--------------------|-----------------------------|
| 画面ロード | `GET_SETTINGS` | `getSettings()` | `getSettings()` |
| しきい値保存 | `SET_THRESHOLD` | `setThresholdSec(sec)` | `setThresholdSec(sec)` |
| サイト追加 | `ADD_SITE` | `addSite({domain, url})` | `addSite(site)` |
| サイト編集保存 | `UPDATE_SITE` | `updateSite({originalDomain, domain, url})` | `updateSite(site)` |
| サイト削除 | `DELETE_SITE` | `deleteSite(domain)` | `deleteSite(domain)` |
| 並び替え (▲▼) | `REORDER_SITES` | `reorderSites(orderedDomains)` | `reorderSites(orderedDomains)` |

---

## 7. ライフサイクル

```
DOMContentLoaded
   |
   v
OptionsApp.init()
   |
   ├─ OptionsAPI.getSettings() で初期データ取得
   ├─ render(settings)
   │   ├─ ThresholdSection を描画
   │   ├─ SitesSection を描画 (空状態 or テーブル)
   │   └─ AddSiteForm を描画
   └─ 各種イベントハンドラを登録 (click, blur, submit)

(以後はユーザー操作のたびに該当部分のみ再描画)
```

---

## 8. スタイル方針 (`options.css`)

- **ライト/ダークモード**: 今回はライトのみ (i18n と同様、後回し可)
- **フォント**: システムフォント (`-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Meiryo", sans-serif`)
- **配色**: 落ち着いたグレー基調、操作ボタンは控えめなアクセントカラー
- **幅**: max-width 720px、中央寄せ (オプションページの一般的なサイズ)
- **アクセシビリティ**: ボタンには `aria-label`、テーブルには `<caption>` または `<thead>`

CSS の詳細は Code Generation 時に確定する。

---

## 9. アクセシビリティ

| 項目 | 対応 |
|------|------|
| キーボード操作 | Tab で各 input/ボタン、Enter で submit、Esc で編集モードキャンセル |
| スクリーンリーダー | `<label for="...">` で input と紐付け、エラー領域に `aria-live="polite"` |
| コントラスト | テキスト/背景のコントラスト比 4.5:1 以上 (実装時に確認) |
| フォーカスインジケータ | ブラウザのデフォルトフォーカスリングを残す |

注意: WaitLess は MVP のため、WCAG 完全準拠の検証は範囲外 (NFR-06 日本語UI、英語版なし)。

---

## 10. アンチスコープに関する UI 不在の確認

オプションページに **持たない** UI:

- ON/OFFトグル / 一時停止ボタン (アンチスコープ #6)
- 統計ダッシュボード (アンチスコープ #1)
- 言語切替 (アンチスコープ #9)
- アカウント関連 (ログイン、同期設定 — アンチスコープ #3)
- 別 AI サービス追加の UI (アンチスコープ #2)

ツールバーアイコンのポップアップは **存在しない** (Q8=A の方針、アンチスコープ #7)。

---

## 11. 関連 FR / US

| FR | 該当セクション |
|----|---------------|
| FR-04 | SitesSection、AddSiteForm |
| FR-09 | OptionsApp 全体 (オプションページUI) |
| FR-10 | OptionsAPI 経由の永続化 (storage.local) |
| FR-11 | ThresholdSection |

| US | 該当セクション |
|----|---------------|
| US-05 | OptionsApp 全体 (登録/編集/削除/並び替え/しきい値) |
| US-06 | EmptyStateMessage (初回オンボーディング) |
