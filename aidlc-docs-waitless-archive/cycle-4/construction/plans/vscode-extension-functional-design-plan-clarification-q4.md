# cycle-4 — Q4 Clarification (`tab_manager.js` の `injectPlaybackPause` 昇格)

最終更新: 2026-05-27

Q4 への説明を整理しました。背景と各選択肢のメリデメを比較し、推奨を示します。

---

## 背景

cycle-1 (既存) の `extension/sw/wait_orchestrator.js` は、AI 完了時に「動画タブに対して `playback_pause.js` を注入する」処理を **WaitOrchestrator のクロージャ内** で持っています。具体的には、`onCompletionDetected` のフロー内で `chrome.scripting.executeScript({ files: ['content/playback_pause.js'] })` のような形で呼ばれます (※ 実際の実装は `tab_manager.js` の関数を呼んでいる可能性あり、要コード確認)。

cycle-4 では、Unit 2 の `IdeBridge` が VS Code 側からの `PAUSE_MEDIA` メッセージを受信した時に、**同じ動画一時停止ロジックを呼びたい** わけです。問題は、その処理が `WaitOrchestrator` のクロージャに閉じている (もしくは export されていない) と、`IdeBridge` から直接呼べないことです。

## 既存コードの確認 (推定)

cycle-1 archive を見る限り、`tab_manager.js` には既に `injectPlaybackPause` 相当のメソッドが実装されている可能性が高いですが、export されていない、または公開 API として位置づけられていない可能性があります。

実装段階で実際のコードを確認して、既に export されていれば「何もしなくていい (= 選択肢 D 相当)」になります。

---

## 各選択肢のメリデメ

### A) `tab_manager.js` に `injectPlaybackPause(tabId)` メソッドを export 化

**やること**: `tab_manager.js` に以下のような形で公開メソッドを追加する (もし既存していれば追加不要):

```javascript
const TabManager = {
  // ... 既存メソッド ...
  
  /**
   * 指定タブで playback_pause.js を実行する。
   * cycle-4 で IdeBridge から呼ばれる用。既存 WaitOrchestrator も同じ実装を使う。
   */
  async injectPlaybackPause(tabId) {
    if (!tabId) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/playback_pause.js']
      });
    } catch (e) {
      console.warn('[TabManager] injectPlaybackPause failed:', e);
    }
  }
};
```

**メリット**:
- ✅ DRY (重複なし)。1 つの実装を `WaitOrchestrator` と `IdeBridge` 両方で使える
- ✅ `tab_manager.js` は元々「タブ操作の集約」が責務なので、export が自然
- ✅ 既存 WaitOrchestrator のクロージャ内で同じ処理をしていた場合は、呼び出し先を `TabManager.injectPlaybackPause()` に差し替えるだけ (1 行変更)
- ✅ 既存シナリオ (cycle-1〜3 の T-01〜T-30) は **動作変更なし** (TabManager 経由でも同じ DOM 操作)

**デメリット**:
- ⚠️ `tab_manager.js` に変更が入る (FR-60 「既存 WaitOrchestrator / TabManager は完全無変更」と微妙に矛盾)
- ⚠️ 「export メソッド追加」は API 拡張なので、後方互換性は保たれる (既存コードは追加メソッドを使わない限り影響なし) → **実質的な後方互換性 ✅**

**設計上の含意**: FR-60 を「**機能の挙動を変えない**」と解釈すれば A は許容。「**コード行を一切変更しない**」と厳密に解釈すれば A は不可。

---

### B) `IdeBridge` 側で同じロジックを再実装 (重複)

**やること**: `sw/ide_bridge.js` 内に独自の `injectPlaybackPause` を持つ。`tab_manager.js` には触らない。

```javascript
// sw/ide_bridge.js 内
async function _injectPause(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/playback_pause.js']
    });
  } catch (e) { /* ... */ }
}
```

**メリット**:
- ✅ FR-60 を厳密に守れる (`tab_manager.js` は完全無変更)
- ✅ `IdeBridge` は独立したモジュールとして既存への結合度が下がる (テストしやすい)

**デメリット**:
- ⚠️ DRY 違反 (同じコードが 2 箇所、`tab_manager.js` のクロージャと `ide_bridge.js`)
- ⚠️ 将来 `playback_pause.js` のパスが変わった時、両方を直す必要がある (保守性低下)
- ⚠️ 「scripting API の使い方」のような共通の知識が分散する

---

### C) `wait_orchestrator.js` の関数を export して直接呼ぶ

**やること**: `wait_orchestrator.js` 内のクロージャから関数を露出させる (例: `WaitOrchestrator.__internal.injectPlaybackPause = ...`)。

**メリット**:
- ✅ DRY (重複なし)

**デメリット**:
- ⚠️ `wait_orchestrator.js` は **オーケストレーション層** (Layer 2) で、TabManager (Layer 1) を呼ぶ立場。タブ操作の関数を `wait_orchestrator.js` から export するのはレイヤー違反
- ⚠️ `wait_orchestrator.js` への変更は、cycle-1〜3 の中核機能 (WAIT_DETECTED / COMPLETION_DETECTED フロー) のテスト範囲を再検証する必要があり、リスクが上がる
- ⚠️ FR-60 の精神に反する

---

### (追加) D) 既存 `tab_manager.js` を確認、既に export メソッドがあれば何もしない

cycle-1 の実装を実際に確認して、既存の `tab_manager.js` に `injectPlaybackPause` 相当が export されていれば、**何も変更不要**。

**メリット**:
- ✅ FR-60 完全遵守
- ✅ DRY 完全遵守
- ✅ 変更ゼロ

**デメリット**:
- ⚠️ 確認しないと判断できない (Unit 2 の Functional Design で実コードを確認する必要あり)

---

## 推奨

### 推奨順位: D → A → B → C

1. **第一推奨: D (実コード確認、既に export されていればそのまま使う)**
   - Unit 2 の Functional Design ステージで `extension/sw/tab_manager.js` を実際に読み、`injectPlaybackPause` 系のメソッドが既に export されているか確認
   - されていれば cycle-4 では **何も触らない**

2. **第二推奨: A (export 化、1 メソッド追加)**
   - 実コードで未 export だった場合、`tab_manager.js` にメソッド 1 つだけ追加 export する
   - 既存呼び出し元 (`wait_orchestrator.js` 内のクロージャ) も同じメソッドに切り替える
   - FR-60 の解釈を「機能の挙動を変えない」と緩めて適用

3. **避けるべき: B**
   - DRY 違反、保守性低下

4. **避けるべき: C**
   - レイヤー違反、リスク高

---

## 推奨に基づく Q4 の確定提案

**Q4 の回答を「D (まず実コード確認)、不可なら A」 に確定する**ことを提案します。

これは Unit 2 の Functional Design ステージで実コードを確認する `[ ]` (TODO) として記録しておけば、フローとして自然です。

### 改めて Q4 への選択肢:

E) **D (まず実コード確認、既に export 済なら使うだけ)、不可なら A (1 メソッド昇格)** — 推奨
F) **A (確認せずとも export 化することを決定打にする)** — シンプル
G) **B (重複容認、FR-60 厳守)**
H) **C (wait_orchestrator から export)**

**[Answer]:**  D

回答後、Q4 の確定値で Functional Design 成果物の生成に進みます。
