# AI-DLC Inception フェーズ Tips 完全抽出

**目的**: AWSハッカソン書類審査（Inception成果物のみ評価）で決勝に進むためのチェックリスト
**評価軸**: ①ビジネス意図(Intent)の明確さ ②創造性とテーマ適合性 ③Unit分解の適切さ ④ドキュメントの品質
**出典**: awslabs/aidlc-workflows 公式リポジトリ（main ブランチ）
**抽出日**: 2026年5月8日
**範囲**: Inceptionに効くもののみ。Construction専用Tipsは除外。

---

## 凡例

- 🟦 **公式記述**: 公式ドキュメントに直接書かれている内容（出典をそのまま反映）
- 🟧 **解釈/推測**: 公式記述からの推論や、ハッカソン文脈への当てはめ
- 出典は `[ファイル名 > セクション]` 形式

---

## 0. Inceptionフェーズで作る成果物（前提整理）

🟦 **公式記述** — `[inputs-quickstart.md > What Happens After You Provide These Documents]`

Inceptionは以下の流れで動く。書類審査の対象はこのフェーズの成果物すべて：

1. Workspace Detection（greenfield/brownfield判定）
2. Requirements Analysis（要件定義、ambiguityがあれば質問ファイル）
3. User Stories（プロジェクトの性質次第で生成）
4. 実行計画（どのステージを走らせるか）
5. Application Design（コンポーネント設計と Unit of Work への分解）

🟦 **公式記述** — `[core-workflow.md（参考）]`
`aidlc-docs/inception/` 配下に `plans/`, `reverse-engineering/`（brownfield限定）, `requirements/`, `user-stories/`, `application-design/` が並ぶ。

🟧 **解釈** — 書類審査ではこの5種類の成果物 + 入力2本（Vision / Technical Environment）を一括評価される前提で構成すべき。**Application Design配下のコンポーネント設計こそが「Unit分解の適切さ」評価軸の主戦場**。

---

## 1. 最重要 — 入力2文書の事前準備（評価軸①③④に効く）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Prepare Your Inputs Before Starting]`
> The single most effective thing you can do before kicking off AIDLC is prepare two documents: **Vision Document** と **Technical Environment Document**.

この2本を整えることで、AIの聞き返しが激減し、Inception成果物の質が決定的に変わる。

### 1.1 Vision Document（評価軸①Intentの明確さ に直結）

🟦 **公式記述** — `[vision-document-guide.md > Document Structure]`

必須セクション：
| セクション | 評価軸への効果 |
|---|---|
| Executive Summary（3〜5文） | ① |
| Problem Statement（具体的に。"improve efficiency"のような曖昧表現NG） | ① |
| Business Drivers（なぜ今やるのか） | ① |
| Target Users and Stakeholders（表形式：User Type / Description / Primary Need） | ① |
| Success Metrics（表：Metric / Current / Target / Measurement Method） | ①④ |
| Full Scope Vision（成熟時の全機能。Feature Areaに分けて記述） | ②④ |
| MVP Scope - Features IN（表：Feature / Description / Priority / Rationale） | ①③ |
| MVP Scope - Features OUT（表：Feature / Reason / Target Phase） | ①③ |
| MVP User Journeys（Full Visionとの差分も明記） | ①② |
| MVP Definition of Done（チェックボックス） | ①④ |
| Risks and Dependencies（表：Risk / Likelihood / Impact / Mitigation） | ④ |
| Open Questions（チェックボックスリスト） | ①④ |

### 1.2 Technical Environment Document（評価軸④に直結、③にも波及）

🟦 **公式記述** — `[technical-environment-guide.md > Document Structure]`

必須セクション：
- Project Technical Summary（greenfield/brownfield判定を最初に明示）
- Programming Languages（**Required / Permitted / Prohibited** の3区分テーブル、それぞれRationale必須）
- Frameworks and Libraries（**Required / Preferred / Prohibited**）
- Cloud Environment（**Service Allow List / Disallow List**、Disallowは代替必須）
- Preferred Technologies and Patterns（Architecture / API / Data / Messaging / Frontend）
- Security Requirements（Auth / Data Protection / Network / Secrets / Compliance Framework）
- Testing Requirements（Test Type表 / Coverage / CI/CD Gates）
- **Example and Template Code Guidance**（後述）

### 1.3 ミニマム入力（時間がない場合の最小セット）

🟦 **公式記述** — `[inputs-quickstart.md > Minimum Viable Input]`

Vision最小:
1. 何を誰のために作るかを1段落
2. MVPに含む機能リスト
3. MVPに含まない機能リスト
4. Open Questions（既知の未解決事項）

> Open questions are optional but valuable. They feed directly into Requirements Analysis as pre-declared ambiguities.

🟧 **解釈** — Open Questionsを明示すると、Requirements Analysisで生成される質問ファイルの質が上がり、結果として要件ドキュメントの精度が上がる。**書類審査でも「未解決事項を自覚している」こと自体が評価軸④の加点要素**になりうる。

Technical Environment最小:
1. 言語とバージョン
2. パッケージマネージャ
3. Webフレームワーク
4. クラウドプロバイダとデプロイモデル
5. テストフレームワーク
6. **Prohibited libraries（理由 / 代替）の表**
7. セキュリティ基本（認証 / 入力検証 / シークレット管理）
8. **典型的なエンドポイント・関数・テストの例コード**

🟦 **公式記述** — `[inputs-quickstart.md > Minimum Viable Input]`
> The example code patterns are the single highest-leverage addition beyond the basics: they give AI-DLC a concrete pattern to follow during code generation rather than inventing its own.

🟧 **解釈** — 書類審査の対象はInceptionだけでもCode Generationは走らないが、Application Design生成時にAIが参照するため、**設計の具体性=ドキュメントの品質**に直接効く。

---

## 2. 「Full Vision」と「MVP」を厳格に分離する（評価軸①③）

🟦 **公式記述** — `[vision-document-guide.md > Writing Guidelines]`
> Clearly separate full vision from MVP. Mixing them causes scope creep.
> Include "out of scope" lists. They are as valuable as "in scope" lists.

🟦 **公式記述** — `[inputs-quickstart.md > Vision Document]`
> If it is not listed, it is not in the MVP.

🟧 **解釈** — 「人をダメにする」のような遊び心のあるテーマでは特にスコープが膨張しがち。**Full Visionで野心的に語り、MVPで何を削ったかを表で明示**すると、評価軸①（意図の明確さ）と③（適切なUnit分解）の両方が一段上がる。Out of Scope表は「自覚的に切ったもの」を見せる場で、創造性のアピールにもなる（評価軸②）。

---

## 3. ぼかし表現の禁止（評価軸①④）

🟦 **公式記述** — `[vision-document-guide.md > Writing Guidelines > Do Not]`
禁句リスト:
- "world-class"
- "seamless"
- "intuitive"
- "best-in-class"

🟦 **公式記述** — 推奨例:
> "Reduce order processing time by 30%" is better than "make things faster."

🟧 **解釈** — 「人をダメにする」テーマでも、ダメさを **「1日n回開いてしまう」「離脱までt秒」** のような測定可能な指標に落とすこと。書類審査員はこの種の数値の有無を真っ先に見る。

---

## 4. Success Metricsは必ず測定方法まで書く（評価軸①④）

🟦 **公式記述** — `[vision-document-guide.md > Business Context > Success Metrics]`

| Metric | Current State | Target State | Measurement Method |
|---|---|---|---|

4列すべて埋める。Measurement Methodが空欄=未完成と扱われる。

---

## 5. Open Questionsを先回りで列挙する（評価軸①④）

🟦 **公式記述** — `[inputs-quickstart.md > Vision (minimum)]`
> Open questions feed directly into Requirements Analysis as pre-declared ambiguities, so AI-DLC addresses them early rather than surfacing them as surprises mid-design.

🟦 **公式記述** — `[vision-document-guide.md > Risks and Dependencies > Open Questions]`
> These feed directly into the Requirements Analysis clarifying questions.

🟧 **解釈** — Visionに5〜10個のOpen Questionsを書いておくと、Requirements Analysisで生成される `requirement-verification-questions.md` の質が上がる。書類提出時には**質問ファイルとその解答ペア**を含めると、思考の解像度を見せられる（評価軸①④）。

---

## 6. 質問ファイル（[Answer]:タグ）への解答テクニック（評価軸①④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > The Question → Doc → Approval Flow]`

解答時のベストプラクティス:
- **文字＋ラベル**: `C` ではなく `C — financial summary and debt service coverage`
- **正当化の付記**: `A — design-first; generate the OpenAPI spec before writing code`
- **複数選択の合成**: `B and C — rate limiting at both API Gateway level and application level (not D)`
- **ほぼ正解時のキャベアット**: `B — migration is a separate project; however, include a one-time migration into the new data structures.`
- **当てはまらない時はXを使う**: 無理に当てはめるよりX（カスタム）が常に正解

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Answering Requirements Questions]`
- Full visionとMVPを明示的に分けて答える
- 意図的なNo決定もはっきり書く: `D — no caching required at this time`（空欄は推測を招く）
- 段階的アプローチを1行で: `X — simple role-based workflow now; replace with external workflow engine when available`

🟧 **解釈** — 書類提出時、回答済みの質問ファイルをそのまま添付できる形に整える。「自覚的にNoを選んだ理由」が並ぶと評価軸①が強くなる。

---

## 7. 「Re-read」を必ず指示する（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Step 3 — Tell the AI your answers are ready]`
> Tip: explicitly asking the AI to *re-read* the file ensures it loads your answers from disk rather than relying on an in-memory version that may not reflect your latest edits.

合言葉: `We have answered your clarification questions. Please re-read the file and proceed.`

🟧 **解釈** — このひと工夫がないと、編集前のメモリ内バージョンで処理が進み、要件ドキュメントが微妙にズレる。書類審査では小さなズレが「精度が低い」印象になる。

---

## 8. Context管理 — Gateごとにリセット（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Context Management]`
> The core rule: clear the context at every natural decision point.

ルール:
- 質問ファイル解答後 → リセットして「再読してから続行」
- ドキュメント承認時 → リセットしてから次へ
- ツールが「context compact」を提案したら **必ず断る**（compactionとリセットは違う）

リセット後の再開コマンド（公式推奨）:
```
Go to aidlc-docs/aidlc-state.md, find the first unchecked item,
then go to the corresponding plan file and resume from that point.
```

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md]`
> Commit and push all current changes to the repository whenever you reset context.

🟧 **解釈** — 提出物のドキュメント品質は、context汚染で滲む。Inceptionだけでも複数Gateを通るので、**Workspace Detection後 / Requirements確定後 / User Stories確定後 / Application Design確定後**にリセットすべき。

---

## 9. 探索的質問は「Do not update any documents.」で囲む（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Asking Questions Without Changing Files]`

パターン:
```
Do not update any documents. Help me understand why [this decision] was made.
```
```
Do not change anything. Assess the impact of [proposed change].
```

🟧 **解釈** — 提出直前に「Inceptionドキュメント全部読んで、評価軸4つに対して弱点を指摘して」と依頼するとき、これを付けないと勝手にドキュメントが書き換わって整合性が崩れる。

---

## 10. 独立した批評は **新しいContext** で取る（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Getting Independent Critiques]`
> AIDLC will defend its own prior decisions. When you want an unbiased evaluation of an artifact, ask for a critique in a fresh context.

```
Produce a critique document of [the requirements document / the component design].
Do this in a new context separate from everything else.
```

🟧 **解釈** — 提出前のセルフレビューに必須。同じcontextだと「自分が書いた理由」を防衛してしまうため、本当の弱点が見えない。**評価軸4つそれぞれで批評を取る**のが理想。

---

## 11. Depth Levelを明示する（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Depth Levels]`
```
This is a production-critical component. Please run at comprehensive depth.
```

🟧 **解釈** — ハッカソン提出物では `comprehensive depth` を明示する。defaultだと簡略化されることがある。

---

## 12. 既存資料の取り込み（評価軸①④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Loading External Reference Files]`
```
Please read [file path or description]. Use it as the basis for [what you want].
```

🟧 **解釈** — テーマ「人をダメにする」に関する既存リサーチ（行動経済学、依存性設計、ダークパターンの議論など）を事前にmarkdownでまとめてAI-DLCに食わせると、Visionの厚みが増し、創造性・テーマ適合性（評価軸②）が上がる。

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Advanced tip — Enterprise standards as extensions]`
> 組織の標準ルール（API、セキュリティ、コンプライアンス等）は `aidlc-rules/extensions/` に置くと全フェーズで自動ロードされる。

🟧 **解釈** — ハッカソンでは、AWSサービス利用ルール・予算上限・テーマ規約などを extensions/ に置いておくと、すべての成果物に自動反映される。

---

## 13. 自動back-propagation の standing rule を仕掛ける（評価軸③④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Advanced tip — Standing back-propagation rule]`
> Instead of asking after each change, set this as a standing instruction at the start of a phase: "Every time you update a document, check whether the change impacts the requirements document and user stories, and prompt me if it does."

🟧 **解釈** — 提出物全体の整合性は書類審査の評価軸④で必ず見られる。standing ruleにしておけば、Application Designで何かが変わるたびに上流（要件・ユーザストーリー）の更新可否を自動で問い合わせてくれる。

---

## 14. Component設計時に **story pointの上限** を設定する（評価軸③）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Advanced tip — Component size constraints]`
```
At the component design phase, inject the following instruction:
no single component should have more than [X] aggregate story points.
If a component exceeds this limit, break it down into smaller sub-components.
```

🟧 **解釈** — **「Unit分解の適切さ」評価軸の最大の効きどころ**。1ユニット=1スプリントで作れるサイズ、というガード。X=8〜13あたりが現実的（Tシャツサイズで言うMくらい）。書類審査員に「分解の意思決定の根拠」を見せられる。

---

## 15. バックログ化は「削除しない」（評価軸①③）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Deferring a feature mid-stream]`
```
We are going to backlog the [feature name] capability for the current release.
Please remove it from the component design and flag the related user stories as backlogged.
```
> Backlogging (rather than deleting) preserves the work for future iterations without it influencing the current build.

🟧 **解釈** — 「Full Visionにあるが MVP に入らないもの」をbacklog化と表示すれば、評価軸①（Intent明確）と③（MVPの適切な絞り込み）の両方を満たせる。「捨てた」ではなく「フェーズ2に積んだ」という見せ方になる。

---

## 16. 設計変更の影響を上流に伝搬させる（評価軸③④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Checking for upstream impact after a design change]`
```
Now review the previous steps — user stories and requirements — to ensure
this change does not require updates to any of those documents.
```

🟧 **解釈** — Application Design中に発見が起きるのは普通。そのつど上流をチェックする習慣を仕掛けておくと、提出時に**Vision ⇄ Requirements ⇄ User Stories ⇄ Application Design がトレースアブル**な状態になる。トレース可能性は評価軸④で大きい。

---

## 17. 並行レビュー時の衝突解消フロー（評価軸③④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Parallel team review of component design]`

チームでApplication Designを分担する場合:
1. 各チームは自分の担当ファイルだけ編集
2. 全員終わったら「全ファイル読んで衝突レポートを作って（編集はしない）」
3. 番号で衝突を1つずつ解消:
   ```
   For conflict #[number] ([conflict description]):
   update [target file] to reflect [your decision].
   ```

🟧 **解釈** — 一人参戦でも、レビューフェーズで「衝突レポートだけ作って」と指示すると、自分では気付かない不整合が見つかる。

---

## 18. 古い設計ファイルはアーカイブする（評価軸④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Archiving stale design files]`
```
Move the [file descriptions] to an archive folder — do not delete them.
Then confirm whether they are required for code generation.
```

🟧 **解釈** — 探索の過程で生まれた使わない設計ファイルが `aidlc-docs/inception/` に残ると、書類審査員が「どれが正？」となる。提出前にarchiveに移動。

---

## 19. データソース・既存スキーマを明示登録する（評価軸①④）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Registering an existing data structure]`
```
We have an existing [schema/structure name]. Please add it to the inception documents
and reference it for this service. When we proceed, expect new requirements and
stories related to this service.
```

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Making implicit data sources explicit]`
```
For the [service name], add the understanding that [new data source] is also a
data source for this feature, in addition to [existing data source]. Then review
requirements and user stories to ensure this is captured.
```

🟧 **解釈** — AWSハッカソンならDynamoDB/RDSのテーブル構造、外部API、S3のオブジェクトキー命名等を明示登録すると、Application Designの解像度が上がる。

---

## 20. Security Extensionsの選択は意図的に（評価軸①）

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Advanced tip — Security Extensions]`
> During Requirements Analysis, AIDLC will ask whether you want to enforce security extension rules. For production-grade applications, choose Yes. For prototypes, No is fine.

🟧 **解釈** — ハッカソンでも「production-grade相当を狙う」スタンスを示したいならYes。逆にPoC感を出したいならNoを選んだ理由を明記。**選択の理由を書くこと自体が評価軸①の加点**。

---

## 21. プロジェクト立ち上げの定型コマンド

🟦 **公式記述** — `[WORKING-WITH-AIDLC.md > Kicking Off a New Project]`
```
I want to start a new project. Please read [path to vision document] and
[path to technical environment document], then begin the AIDLC workflow.
```

---

## 22. Greenfield/Brownfield の自己判定をはっきりさせる（評価軸④）

🟦 **公式記述** — `[technical-environment-guide.md > Document Applicability]`

| Context | 違い |
|---|---|
| Greenfield | 既存コードなし。すべての選択がオープン。 |
| Brownfield | 既存コードベースあり。何を残し、何を変え、何を避けるかを定義。 |

🟧 **解釈** — ハッカソン新規開発はGreenfieldだが、もし既存リポジトリに乗せるならBrownfield扱いで「**must NOT change**」リストを書くこと。

---

## 23. Prohibited Librariesは **理由 + 代替** が必須（評価軸④）

🟦 **公式記述** — `[inputs-quickstart.md > Minimum Viable Input]`
> On item 6: including the reason and the recommended alternative is important. Without them, AI-DLC may honour the prohibition but not understand the intent well enough to make good substitution decisions.

🟦 **公式記述** — `[technical-environment-guide.md > Frameworks and Libraries > Prohibited Libraries]`

| Library | Reason | Alternative |
|---|---|---|

🟧 **解釈** — 「LangChainは使わない（実行時依存が大きすぎる、Bedrock APIを直接叩く）」のように理由+代替で書くと、設計判断の透明性が出る。

---

## 24. Cloud Service Allow/Disallow Listを書く（評価軸④）

🟦 **公式記述** — `[technical-environment-guide.md > Cloud Environment]`

Allow Listは `Service / Approved Use Cases / Constraints` の3列。
Disallow Listは `Service / Reason / Alternative` の3列。

🟧 **解釈** — AWSハッカソンならBedrock、Lambda、DynamoDB、S3、API Gateway、Step Functionsあたりを Allow に。EC2直やElastic BeanstalkはDisallowに代替（Lambda/Fargate）と一緒に書く。

---

## 25. Example Code パターン（最高レバレッジの追加）（評価軸③④）

🟦 **公式記述** — `[inputs-quickstart.md]`
> The example code patterns are the single highest-leverage addition beyond the basics.

🟦 **公式記述** — `[technical-environment-guide.md > Example and Template Code Guidance]`

各サンプルには以下を同梱:
1. 動くコード（pseudocode禁止）
2. 対応するテスト
3. README.md（パターン名 / 使う条件 / 使わない条件 / カスタマイズ可否表 / 参照すべき標準）

🟧 **解釈** — Inceptionのみが評価対象でも、Application Design段階のコンポーネントAPI記述の精度がここに依存する。**1〜2個のexample（典型的なエンドポイント、典型的なLambdaハンドラ）だけでいいので必ず置く**。

---

## 26. Security Compliance Frameworkを **1つ選んで明記** する（評価軸①④）

🟦 **公式記述** — `[technical-environment-guide.md > Security Compliance Framework]`
> Every project must adopt a security risk framework and document how the project addresses each risk category in that framework.

選択候補（公式のCommon frameworks表より）:

| Context | Framework |
|---|---|
| Web app/API | OWASP Top 10, OWASP API Security Top 10 |
| クラウドネイティブ | AWS Well-Architected Security Pillar, CIS Benchmarks |
| 規制業界 | NIST 800-53, FedRAMP, ISO 27001 |
| 一般 | CIS Controls v8, SANS Top 25 |

各カテゴリについて以下を必ず書く:
1. プロジェクトでどう対処しているか（具体的な統制・パターン・ツール）
2. Not Applicable の場合はその理由
3. 後フェーズに延期する場合は現在のギャップと修復目標フェーズ

🟧 **解釈** — ハッカソンならOWASP Top 10 (2021)が現実的。10カテゴリすべてを表で埋めると、評価軸④（ドキュメント品質）が一気に上がる。

---

## 27. Risks and Open Questions を必ず書く（評価軸①④）

🟦 **公式記述** — `[vision-document-guide.md > Risks and Dependencies]`

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

🟧 **解釈** — 「人をダメにする」テーマでは倫理的リスク（依存性誘発、未成年への影響、利用時間の長期化）を Risk として書き、Mitigation でどう設計上ガードするかを示すと、テーマへの自覚が見え評価軸②（創造性）にも効く。

---

## 28. Vision Documentで **書いてはいけないもの**（評価軸④）

🟦 **公式記述** — `[vision-document-guide.md > Writing Guidelines > Do Not]`

- 技術や実装の詳細（→ Technical Environment側に書く）
- マーケ風の言葉（"world-class", "seamless"）
- MVPセクションの省略
- featureとuser journeyの混同
- 文脈を読者が知っている前提（Problem Statementを必ず書く）

🟧 **解釈** — 書類審査では「VisionとTechnical Environmentの責任分界が曖昧」だと減点されやすい。Visionは **何を なぜ 誰のために**、Tech Envは **何で どう作るか**。

---

## 29. MVP Definition of Done をチェックボックスで（評価軸①④）

🟦 **公式記述** — `[vision-document-guide.md > MVP Definition of Done]`
- [ ] All "Must Have" features implemented and tested
- [ ] [Additional criteria specific to this project]
- [ ] [Deployment or accessibility requirement]
- [ ] [Stakeholder sign-off requirement]

🟧 **解釈** — 「MVPがいつ完成と言えるか」が箇条書きで具体に書かれていると、書類審査員が一目でスコープ感を掴める。

---

## 30. Vision各セクションがAI-DLCのどのステージで使われるか（評価軸④理解のため）

🟦 **公式記述** — `[vision-document-guide.md > How This Document Feeds Into AI-DLC]`

| Visionセクション | AI-DLCステージ | 用途 |
|---|---|---|
| Executive Summary | Workspace Detection | プロジェクト分類の初期文脈 |
| Business Context | Requirements Analysis | 質問の方向と要件の深さを決める |
| Full Scope Vision | User Stories, Application Design | ペルソナ生成、コンポーネント識別 |
| MVP Scope | Workflow Planning | どのステージを実行するか、スコープ境界 |
| Features In/Out | Code Generation | 何を作るか（Constructionなので参考） |
| Risks and Dependencies | All stages | リスク評価、エラー処理の方針 |
| Open Questions | Requirements Analysis | 質問ファイルの種になる |

🟧 **解釈** — この対応を理解した上でVisionを書くと、後続成果物がブレずに生成される。

---

## 31. Tech Env各セクションのAI-DLC利用箇所（評価軸④）

🟦 **公式記述** — `[technical-environment-guide.md > How This Document Feeds Into AI-DLC]`

Inception関連だけ抜粋:
| Tech Envセクション | AI-DLCステージ | 用途 |
|---|---|---|
| Project Technical Summary | Workspace Detection | プロジェクト分類 |
| Preferred Patterns | Application Design, Functional Design | アーキ・設計パターン決定 |
| Cloud Allow/Disallow | Infrastructure Design | サービス選択の境界 |
| Brownfield Inventory | Reverse Engineering, Workflow Planning | 移行とコエグジスタンス |

---

## 32. ハッカソン提出用の最終チェックリスト（評価軸4軸の総まとめ）

🟧 **解釈/推測** — 公式の各Tipsを評価軸別に組み替えたもの。

### 評価軸① ビジネス意図(Intent)の明確さ
- [ ] Executive Summary 3〜5文（人をダメにする対象と方法を即座に伝える）
- [ ] Problem Statement に "make better" 等の曖昧語がない
- [ ] Success Metrics に Measurement Method まで埋まっている
- [ ] MVP Objective が1〜2文で明示
- [ ] Features IN/OUT が表で分かれている
- [ ] 意図的なNo決定（"D — no caching"のような）が要件Q&Aに残っている
- [ ] Open Questions が5個以上、自覚的に列挙されている
- [ ] テーマ「人をダメにする」の倫理的Riskと Mitigation が書かれている

### 評価軸② 創造性とテーマ適合性
- [ ] Full Scope Vision が野心的（MVPの先の世界観が見える）
- [ ] User Personaに「ダメになるユーザ」の解像度が高い記述
- [ ] User Journeyに「依存させる仕掛け」が具体的に表現
- [ ] AWSサービスの組み合わせに独自性のあるアイディアがある
- [ ] Out of Scope に「あえて外した遊び心」が見える

### 評価軸③ Unit分解の適切さ
- [ ] Application Designで各コンポーネントのstory pointが書かれている
- [ ] story point上限ルール（例: 13）が明記され遵守されている
- [ ] MVP Features IN表で Priority と Rationale が埋まっている
- [ ] バックログ化機能が「削除」ではなく「Phase 2」と書かれている
- [ ] 各User Storyが1ユニットに紐づく対応表がある
- [ ] コンポーネント間の責任分界が衝突しない（衝突レポートで確認済）

### 評価軸④ ドキュメントの品質
- [ ] Vision と Tech Env の責任分界が守られている（技術詳細がVisionに混入していない）
- [ ] Prohibited 系すべてに Reason と Alternative が書かれている
- [ ] Cloud Service Allow/Disallow が表で書かれている
- [ ] Security Compliance Framework が1つ選ばれ、各カテゴリ埋まっている
- [ ] Example Codeが少なくとも1〜2個ある（動くコード+テスト+README）
- [ ] Vision ⇄ Requirements ⇄ User Stories ⇄ Application Design が相互参照可能
- [ ] aidlc-state.md と audit.md が残っている
- [ ] 古い/没ファイルは archive/ に移動済み
- [ ] 独立Contextでの critique を実施し、指摘点に対処済み
- [ ] aidlc-docs/ にreport類（人向け資料）を混入させていない

---

## 33. 提出物に同梱すると有利になりそうなもの（解釈中心）

🟧 **解釈/推測**（公式の直接記述ではないが、上記Tipsから合理的に導かれる）

- `inputs/vision.md` と `inputs/technical-environment.md` の入力本体
- `aidlc-docs/inception/` 配下の全成果物
- `aidlc-docs/aidlc-state.md`（進捗の自己証明）
- `aidlc-docs/audit.md`（意思決定のトレース）
- 質問ファイルとその解答（`requirement-verification-questions.md` など）
- 独立Contextで取った critique ドキュメント（`critique-*.md`）
- examples/ 配下のテンプレートコード

これらが揃っているだけで「AI-DLCを正しく回した」ことの証明になり、評価軸④の根拠になる。

---

## 出典ファイル一覧（再掲）

1. https://github.com/awslabs/aidlc-workflows/blob/main/docs/WORKING-WITH-AIDLC.md
2. https://github.com/awslabs/aidlc-workflows/blob/main/docs/writing-inputs/inputs-quickstart.md
3. https://github.com/awslabs/aidlc-workflows/blob/main/docs/writing-inputs/vision-document-guide.md
4. https://github.com/awslabs/aidlc-workflows/blob/main/docs/writing-inputs/technical-environment-guide.md
5. https://github.com/awslabs/aidlc-workflows/blob/main/README.md（インストール手順中心。Inception実務Tipsはほぼ含まれない）

WORKING-WITH-AIDLC.md内の "Construction Phase" 節と "Never Vibe Code" 節は要請通り除外した。
