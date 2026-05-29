# cycle-6 Application Design Plan

このプランは cycle-6 (統計ログ + ダッシュボード UI) のアプリケーション設計の進め方と、設計判断に必要な質問を含む。
質問の `[Answer]:` タグに記入してください。記入後「done」と教えていただければ設計成果物を生成します。

---

## 1. 設計対象コンポーネント (予定)

| # | コンポーネント | レイヤー | 新規/改修 | 役割概要 |
|---|--------------|---------|----------|---------|
| C1 | **StatsRepository** | Layer 1 (Domain) | 新規 `sw/stats_repository.js` | 統計レコードの CRUD + 日次/週次集計 + 指標 (M-01〜06) 計算 |
| C2 | **LeisureClassifier** | Layer 1 (Domain) | 新規 (StatsRepository 内 or 別ファイル) | 切替先ドメイン → 12 ジャンル逆引き分類 |
| C3 | **DashboardPage** | Layer 4 (Page) | 新規 `dashboard/dashboard.{html,css,js}` | 統計の可視化 (サマリカード + 内訳バー + 週次トレンド棒グラフ) |
| C4 | **DashboardAPI** | Layer 3 (Boundary) | 新規 (dashboard.js 内 or 直接 storage) | 統計データの取得 (sendMessage or 直接 chrome.storage.local) |
| C5 | **WaitOrchestrator** (改修) | Layer 2 | 改修 (最小追記) | 待ち/完了イベント時に StatsRepository へ記録呼び出し |
| C6 | **ClaudeSiteAdapter** (改修) | Layer 3 | 改修 | 復帰後の操作検知 (M-05) + 再離脱検知 (M-04) を SW へ送信 |
| C7 | **MessageRouter** (改修) | Layer 2 | 改修 | 新メッセージタイプのルーティング追加 |
| C8 | **IdeBridge** (改修) | Layer 1 | 改修 | VS Code から受けた IDE 統計を StatsRepository へ記録 |
| C9 | **VS Code Extension** (改修) | (別拡張) | 改修 `extension.ts` | IDE 待ちサイクル統計を算出し IPC で Chrome へ送信 |

---

## 2. 設計ステップ (チェックリスト)

- [ ] components.md 生成 (各コンポーネントの責務とインタフェース)
- [ ] component-methods.md 生成 (メソッドシグネチャ、入出力型)
- [ ] services.md 生成 (オーケストレーションパターン)
- [ ] component-dependency.md 生成 (依存関係 + 通信パターン + データフロー)
- [ ] application-design.md 生成 (上記を統合)
- [ ] 設計の完全性・一貫性を検証

---

## 3. 設計判断のための質問

### Question A1: 余暇種別の逆引き衝突の解決
ポータルデータを調べると、**同一ドメインが複数ジャンルに登場** します。例:
- `youtube.com` → 「動画視聴」「リラックス (ヨガ/ストレッチ/焚き火検索)」、`music.youtube.com` → 「音楽」
- `amazon.co.jp` → 「EC」「動画視聴 (Prime Video)」「読書 (Kindle)」
- `rakuten.co.jp` → 「EC」「スポーツ (NBA)」「旅行 (トラベル)」「料理 (レシピ)」

逆引きでどう分類しますか?

A) **URL のフルパス優先マッチ** → ポータルの登録 URL と完全一致すればそのジャンル、ダメならホスト名(サブドメイン込み)一致、最後にドメイン一致。多義ドメインはサブドメイン/パスで極力区別し、区別不能なら最初にマッチしたジャンル
B) **ドメイン (eTLD+1) 単位で 1 ジャンルに固定** → 多義ドメインは代表ジャンル 1 つに決め打ち (例: youtube.com=動画、amazon.co.jp=EC)。シンプルだが粒度は粗い
C) ホスト名 (サブドメイン込み) 単位でマッチ → `music.youtube.com`=音楽 / `youtube.com`=動画 のように区別。パスは見ない
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question A2: 統計レコードの保存粒度と肥大対策 (NFR-75)
Q6=A で「無期限保持」を選択いただきましたが、レコードが無限に増える懸念があります。どう扱いますか?

A) **個々の待ちサイクルレコードを全件保持** (無期限)。肥大対策は将来 Backlog (件数が数千でも JSON で数百 KB 程度、当面問題なし)
B) **個々のレコードを保持しつつ、上限 N 件 (例: 直近 5000 件) でリングバッファ的に古いものを削除** (無期限の趣旨は保ちつつ安全弁)
C) **日別集計サマリ + 直近の生レコードのみ保持** (古い生レコードは日次サマリに畳む)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question A3: ダッシュボードのデータ取得方式
ダッシュボードページが統計データを読む方法は?

A) **Service Worker 経由 (sendMessage)** で StatsRepository から取得 (集計ロジックを SW に集約、reader と異なるパターン)
B) **dashboard.js が直接 `chrome.storage.local` を読み、JS 側で集計** (cycle-3 Reader Page と同じパターン、SW 不要で軽量)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question A4: VS Code (Kiro) 側の統計送信方式
VS Code 拡張が IDE 待ちサイクル統計を Chrome に渡す方法は? (cycle-4 で既に WebSocket IPC `ws://127.0.0.1:39472` が存在)

A) **既存 IPC に新メッセージタイプ `STATS_RECORD` を追加** し、VS Code → Chrome へ待ちサイクル統計を送信。Chrome 側 IdeBridge が受信して StatsRepository に記録
B) VS Code 側で独立して統計を持ち、ダッシュボードは Chrome 分のみ表示 (IDE 分は別途)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question A5: 余暇種別の「種別判定タイミング」
余暇種別 (M-03) は、いつ確定して記録しますか?

A) 娯楽タブに切り替えた瞬間 (`findOrOpenPlaySite` 成功時) に、切替先 URL から種別を判定してレコードに保存
B) 完了時 (戻る時) に、その時点の娯楽タブの URL から判定 (ユーザーが娯楽タブ内で別サイトに移動した場合に対応)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question A6: ダッシュボードの「今日」の基準
「今日ダメになった時間」等の「今日」は何基準ですか?

A) ローカルタイムゾーンの 0:00〜23:59 (端末のローカル日付)
B) 起動からの 24 時間
X) Other (please describe after [Answer]: tag below)

[Answer]: A
