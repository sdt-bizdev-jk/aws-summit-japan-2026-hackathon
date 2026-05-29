# cycle-6 Requirements — 統計ログ + ダッシュボード UI

最終更新: 2026-05-29

---

## 1. Intent Analysis (意図分析サマリ)

| 項目 | 内容 |
|------|------|
| **User Request** | cycle-6: 待ち時間等の統計ログを記録し、ダッシュボード画面で「今日ダメになった時間」「余暇種別の内訳 (SNS/ニュース/ストレッチなど)」「戻れた率 (→離脱継続率に再定義)」「集中復帰までの平均秒数」などの統計データを表示。週次トレンドも見られる |
| **Request Type** | New Feature (機能追加) |
| **Scope Estimate** | Multiple Components (新規 dashboard ページ + 新規 stats_repository + 既存イベント発火点への最小追記 + Options/Portal からの動線 + VS Code 拡張からの統計連携) |
| **Complexity Estimate** | Moderate (統計の定義と集計ロジック + 依存ゼロのグラフ描画 + 既存コア無変更制約) |
| **Project Type** | Brownfield (Chrome 拡張 v0.5.0 + VS Code 拡張 v0.1.0 への追加) |
| **Requirements Depth** | Standard 〜 Comprehensive (指標定義が実装を決定づけるため指標部分は詳細化) |

---

## 2. 用語と指標定義 (Metrics Definitions)

cycle-6 の中核は「何をどう測るか」の定義。以下を確定版とする。

### 2.1 計測の基本単位: 待ちサイクル (Wait Cycle)

1 回の「待ち発生 → (娯楽タブ切替) → 完了 → AI タブ復帰」を 1 **待ちサイクル** と呼ぶ。
各サイクルで以下のタイムスタンプ/データを記録する:

| フィールド | 意味 | 取得元 |
|-----------|------|--------|
| `source` | `"chrome"` (Claude.ai) または `"ide"` (VS Code/Kiro) | 発火経路 |
| `waitStartAt` | 待ち発生時刻 (WAIT_DETECTED) | `onWaitDetected` |
| `waitEndAt` | AI 完了時刻 (COMPLETION_DETECTED) | `onCompletionDetected` |
| `leisureStartAt` | 娯楽タブに切替できた時刻 (null=切替なし) | `findOrOpenPlaySite` 成功時 |
| `leisureEndAt` | 娯楽タブから AI へ戻した時刻 | `onCompletionDetected` |
| `leisureCategory` | 余暇種別 (12 ジャンル or "other") | 切替先 URL のドメイン逆引き |
| `leisureDomain` | 切替先ドメイン | 同上 |
| `resumeActionAt` | 復帰後の最初のユーザー操作時刻 (chrome のみ) | Claude.ai Content Script |
| `reLeftWithinStay` | 自動復帰後しきい値内に再離脱したか (chrome のみ) | Claude.ai Content Script |

> **保存方針 (Q6=A)**: 個々の待ちサイクルレコードを `chrome.storage.local` に **無期限・端末ローカル** で配列保持する。外部送信なし。ダッシュボードは表示時にこの生レコードから日次/週次へ集計する。

### 2.2 指標定義

| ID | 指標 | 定義 | 計算式 |
|----|------|------|--------|
| **M-01** | 待ち時間合計 (Q1=B) | AI が応答していた時間の合計 | Σ(`waitEndAt` − `waitStartAt`) |
| **M-02** | 今日ダメになった時間 (Q2=A) | 娯楽タブに滞在していた合計時間 | Σ(`leisureEndAt` − `leisureStartAt`)、当日分 |
| **M-03** | 余暇種別の内訳 (Q3=A) | 12 ジャンル別の娯楽滞在時間/回数の内訳 | ジャンルごとに `leisure` 時間を合算 |
| **M-04** | 離脱継続率 (C1=A、旧「戻れた率」を再定義) | 自動で AI へ戻された後、しきい値時間内に娯楽タブへ再離脱しなかったサイクルの割合 | (再離脱しなかったサイクル数) ÷ (自動復帰したサイクル数) |
| **M-05** | 集中復帰までの平均秒数 (Q5/C2=A, C3=A) | AI 完了から、AI タブ復帰後の最初のユーザー操作までの平均秒数 (chrome のみ) | avg(`resumeActionAt` − `waitEndAt`) |
| **M-06** | 待ちサイクル回数 | 待ちが発生した総回数 (補助指標) | レコード件数 |

### 2.3 余暇種別の分類ルール (Q3=A)

- ポータルページ (cycle-5) の **12 ジャンル** を正準カテゴリとする: 動画視聴 / 音楽 / EC / ゲーム / SNS / ニュース / 読書 / 漫画 / スポーツ / 料理 / 旅行 / リラックス
- 切替先 URL のドメインを、ポータルデータ (`portal_data.js`) のドメイン → ジャンル逆引きマップで分類する
- ポータルに存在しないドメイン (ユーザー独自登録サイトなど) は **「その他 (other)」** に集約する
- 拡張機能内蔵 Reader Page (`chrome-extension://.../reader/...`) は「読書」に分類する

### 2.4 離脱継続率の補足 (M-04)

- 自動復帰 (`onCompletionDetected` で AI タブをアクティブ化) の後、Claude.ai Content Script が `visibilitychange` を監視 (C5=A)
- 復帰から **しきい値 `stayWindowSec` (デフォルト 30 秒、設計で確定)** 以内にタブが hidden になった場合 = 「再離脱」とみなし `reLeftWithinStay=true`
- しきい値内に hidden にならなければ「継続成功」
- ほぼ 100% になりがちな旧「戻れた率」を、行動の質を測る指標に置き換える

---

## 3. Functional Requirements (機能要件)

### 3.1 統計記録 (Stats Recording)

| ID | 要件 | Priority |
|----|------|----------|
| **FR-71** | 待ちサイクルごとに §2.1 のレコードを生成し `chrome.storage.local` の統計キー (`stats_events` 等) に追記する | High |
| **FR-72** | 統計記録は新規モジュール `extension/sw/stats_repository.js` に集約する。既存コアロジックへの変更は発火点での呼び出し追加のみに留める (Q13=A) | High |
| **FR-73** | 待ち時間 (M-01) と娯楽タブ滞在時間 (M-02) を別々に記録する (Q1=B) | High |
| **FR-74** | 切替先ドメインから余暇種別 (M-03) を逆引き分類し、レコードに保存する (Q3=A)。未知ドメインは "other" | High |
| **FR-75** | 自動復帰後、Claude.ai Content Script が最初のユーザー操作 (scroll/mousemove/keydown/click のどれか早い、C2=A) を検知し、その時刻を SW へ送信する。集中復帰秒数 (M-05) を算出する | High |
| **FR-76** | 自動復帰後、Claude.ai Content Script が `visibilitychange` を監視し、しきい値時間内の再離脱有無 (M-04) を SW へ送信する (C5=A) | High |
| **FR-77** | VS Code (Kiro) 拡張側の IDE 待ちサイクルも統計対象に含める。待ち時間・娯楽滞在時間・余暇種別を記録するが、集中復帰秒数 (M-05) は記録しない (Q7=B, C4=B) | Medium |
| **FR-78** | 統計データは端末ローカルに無期限保持し、外部サーバー/API へ送信しない (Q6=A) | High |

### 3.2 ダッシュボード UI (Dashboard)

| ID | 要件 | Priority |
|----|------|----------|
| **FR-79** | 拡張機能内蔵の新規ダッシュボードページ `extension/dashboard/` を追加する。Reader/Portal と同じく `chrome-extension://.../dashboard/dashboard.html` で開ける (Q8=A) | High |
| **FR-80** | ダッシュボードに以下のサマリカードを表示する: 今日ダメになった時間 (M-02)、余暇種別の内訳 (M-03)、離脱継続率 (M-04)、集中復帰までの平均秒数 (M-05)、待ち時間合計 (M-01)、待ちサイクル回数 (M-06) | High |
| **FR-81** | 余暇種別の内訳 (M-03) を、ジャンル別の構成比として可視化する (純粋 HTML/CSS の棒/比率バー、依存ゼロ、Q9=A) | High |
| **FR-82** | 週次トレンドを表示する: 直近 7 日間の日別「今日ダメになった時間」等を、純粋 HTML/CSS の棒グラフ (div 高さ表現) で可視化する (Q9=A) | High |
| **FR-83** | ダッシュボードは日本語固定。ポータル (cycle-5) と同じダーク基調 (#0a0a0f) + 紫アクセント (#7c3aed) のテーマで統一する (Q11=A) | Medium |
| **FR-84** | ポータルページ (cycle-5) からダッシュボードへの動線 (リンク/ボタン) を設置する (Q8 コメント)。Options Page の空状態案内にもダッシュボードへの動線を追加する | Medium |
| **FR-85** | 統計データが 0 件のときは「まだデータがありません」の空状態を表示する | Medium |

---

## 4. Non-Functional Requirements (非機能要件)

| ID | 要件 | Priority |
|----|------|----------|
| **NFR-71** | **後方互換性**: 既存 `extension/sw/{message_router, wait_orchestrator, tab_manager, settings_repository, runtime_state}.js` のコア責務は破壊しない。統計記録は最小の呼び出し追加のみ (Q13=A)。cycle-1〜5 の主要シナリオ (待ち→切替→戻り、Reader、Portal) を壊さない | High |
| **NFR-72** | **依存ゼロ**: 外部ライブラリ・画像を持ち込まない。グラフは純粋 HTML/CSS のみ (Q9=A)。ビルド不要を維持 (NFR-04 踏襲) | High |
| **NFR-73** | **プライバシー**: 統計は端末ローカル (`chrome.storage.local`) のみ。外部送信ゼロ (NFR 既存方針踏襲) | High |
| **NFR-74** | **パフォーマンス**: 統計記録は非同期で待ちサイクルの体験を阻害しない。記録失敗は握りつぶしてコア体験を継続する (best-effort) | High |
| **NFR-75** | **ストレージ堅牢性**: 統計レコードの読み書きは破損データに対して防御的 (不正値はスキップ/フォールバック)。レコード肥大に備え、設計時に上限/間引き方針を検討する | Medium |
| **NFR-76** | **テーマ統一**: ダッシュボードはポータルの CSS デザイントークン (ダーク #0a0a0f + 紫 #7c3aed) と視覚的に一貫する | Medium |
| **NFR-77** | **VS Code 連携の堅牢性**: VS Code 側の統計送信が失敗しても Chrome 側ダッシュボードは Chrome 分のデータで動作する (部分動作可) | Medium |

---

## 5. User Scenarios (利用シナリオ)

- **AS-61**: ユーザーが 1 日 AI を使った後、ダッシュボードを開いて「今日ダメになった時間」と余暇種別の内訳を確認し、自分の娯楽傾向を把握する
- **AS-62**: ユーザーが週次トレンドを見て、曜日ごとの娯楽時間の増減を把握する
- **AS-63**: ユーザーがポータルページから 1 クリックでダッシュボードへ移動して統計を確認する
- **AS-64**: 統計が 0 件の新規ユーザーが空状態の案内を見る
- **AS-65**: VS Code (Kiro) で AI を待った分も、Chrome 拡張のダッシュボードに合算されて表示される

---

## 6. アンチスコープ (今回やらないこと)

- 統計のクリア/リセット機能 (Q10=B、将来 Backlog)
- 統計データの CSV/JSON エクスポート
- 日次以外の任意期間フィルタ (今回は「今日」+「直近 7 日」のみ)
- VS Code 側の集中復帰秒数の計測 (C4=B)
- 外部サーバーへの統計集約/同期
- cycle-5 実機 E2E 検証 (T-51〜T-60、Q12=A で別途)
- カード画像・お気に入り等 cycle-5 由来 Backlog (B-21〜B-27)
- セキュリティ拡張ルール (Security=B で OFF)、PBT 拡張ルール (PBT=C で OFF)

---

## 7. 既存資産との整合

- cycle-1〜5 で確定した BR (BR-01〜37, BR-41〜58, BR-61〜70, BR-71〜80)、FR (FR-01〜11, FR-21〜25, FR-31〜38, FR-41〜61, FR-51〜60)、NFR (NFR-01〜10, NFR-21〜29, NFR-51〜59) は引き続き有効
- cycle-6 は採番 **FR-71〜85 / NFR-71〜77 / AS-61〜65 / M-01〜06 / (BR は Functional Design で BR-81〜 を採番)** を使用
- データスキーマは既存 `sites` / `threshold_sec` / `reader_state` に **干渉しない新規キー** (`stats_events` 等) を追加する (後方互換)

---

## 8. Key Requirements Summary (要点)

1. **統計記録**: 待ちサイクルごとに待ち時間・娯楽滞在時間・余暇種別・集中復帰秒数・再離脱有無を `chrome.storage.local` に無期限記録 (新規 `sw/stats_repository.js` に集約、既存コア無変更)
2. **指標**: 今日ダメになった時間 (娯楽合計) / 余暇種別内訳 (12 ジャンル) / 離脱継続率 (旧戻れた率の再定義) / 集中復帰平均秒数 (完了→最初の操作)
3. **ダッシュボード**: 新規 `extension/dashboard/`、ダーク+紫テーマ、純粋 HTML/CSS グラフ、週次トレンド、ポータル/Options からの動線
4. **VS Code 連携**: IDE 待ちサイクルも合算 (集中復帰秒数は除く)
5. **制約**: 依存ゼロ・端末ローカル・既存互換・リセット機能なし
