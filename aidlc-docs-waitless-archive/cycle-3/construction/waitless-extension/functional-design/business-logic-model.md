# Business Logic Model — waitless-extension cycle-3 (Reader Page)

最終更新: 2026-05-27

cycle-3 で新規追加する Reader Page の中核アルゴリズムと処理フローを疑似コードで記述する。
詳細なコード生成は Code Generation で行う。

---

## 1. ReaderApp.init() — 起動シーケンス

```pseudo
async function ReaderApp.init():
    // ① 組み込み小説テキストをロード
    novelUrl = chrome.runtime.getURL('reader/novel.txt')
    response = await fetch(novelUrl)
    if not response.ok:
        log error and render fallback message
        return
    novelText = await response.text()
    state.totalChars = countChars(novelText)
    state.paragraphs = splitIntoParagraphs(novelText)

    // ② 永続化された ReaderState をロード
    saved = await ReaderApp.loadState()
    state.readOffset = saved.readOffset    // 0 if 不在
    state.scrollY    = saved.scrollY       // 0 if 不在

    // ③ DOM レンダリング
    ReaderApp.renderText(state.paragraphs)

    // ④ 既読範囲を青色化 (Q3=A: 青色化を先に)
    ReaderApp.applyReadProgress(state.readOffset)

    // ⑤ スクロール位置を復元 (青色化後にレイアウトが安定してから)
    //    requestAnimationFrame で 1 フレーム待ってから scrollTo すると、
    //    レンダリングが反映された後に正しい位置にスクロールできる。
    requestAnimationFrame(() => {
        window.scrollTo({ top: state.scrollY, behavior: 'auto' })
    })

    // ⑥ イベントリスナを設定
    document.body.addEventListener('click', ReaderApp.onTextClick)
    window.addEventListener('pagehide', ReaderApp.onPageHide)
    document.addEventListener('visibilitychange', ReaderApp.onVisibilityChange)
```

---

## 2. ReaderApp.renderText(paragraphs) — DOM 構築

```pseudo
function ReaderApp.renderText(paragraphs):
    container = document.querySelector('#reader-content')
    container.innerHTML = ''
    cumOffset = 0   // 累積文字オフセット (段落の先頭位置)

    for each text in paragraphs:
        p = document.createElement('p')
        p.className = 'paragraph'
        p.dataset.start = cumOffset             // この段落の先頭オフセット
        p.dataset.length = countChars(text)     // この段落の文字数
        p.textContent = text                    // 初期は単一テキストノード
        container.appendChild(p)
        cumOffset += countChars(text)
        cumOffset += 1                          // 段落区切り (改行) を 1 文字として数える
    
    state.totalCharsIncludingBreaks = cumOffset
```

設計判断: **段落区切りは 1 文字として数える** (改行が `\n` 1 文字でカウントされるため、オフセットの計算が単純)。

---

## 3. ReaderApp.applyReadProgress(offset) — 既読範囲の青色化

```pseudo
function ReaderApp.applyReadProgress(offset):
    paragraphs = document.querySelectorAll('#reader-content .paragraph')

    for each p in paragraphs:
        start = parseInt(p.dataset.start)
        length = parseInt(p.dataset.length)
        end = start + length

        if offset <= start:
            // 段落全体が未読
            ReaderApp.setParagraphAsUnread(p)
        else if offset >= end:
            // 段落全体が既読
            ReaderApp.setParagraphAsRead(p)
        else:
            // 段落途中で分割: [start, offset) 既読 / [offset, end) 未読
            inParaOffset = offset - start
            ReaderApp.splitParagraph(p, inParaOffset)
```

```pseudo
function ReaderApp.setParagraphAsRead(p):
    text = p.textContent     // 既存の HTML を text に丸めて取り直す
    p.innerHTML = ''
    span = document.createElement('span')
    span.className = 'read'
    span.textContent = text
    p.appendChild(span)

function ReaderApp.setParagraphAsUnread(p):
    text = p.textContent
    p.innerHTML = ''
    p.textContent = text     // 単一テキストノードに戻す

function ReaderApp.splitParagraph(p, inParaOffset):
    text = p.textContent
    readPart = text.slice(0, inParaOffset)
    unreadPart = text.slice(inParaOffset)

    p.innerHTML = ''
    readSpan = document.createElement('span')
    readSpan.className = 'read'
    readSpan.textContent = readPart
    p.appendChild(readSpan)
    p.appendChild(document.createTextNode(unreadPart))
```

設計判断:
- 各段落で「単一テキストノード」「.read span のみ」「.read span + テキストノード」の 3 状態のいずれかに正規化
- 部分更新ではなく **段落全体を再構築** することで、複数回のクリックによる DOM の汚れを防止
- 計算量は O(段落数 × 1 段落の文字数) = O(N)、ただし実用上は段落単位の処理なので大量段落でも高速

---

## 4. ReaderApp.onTextClick(event) — クリックハンドラ

```pseudo
function ReaderApp.onTextClick(event):
    // BR-36: クリック対象が <p> 内のテキストであることを検証
    target = event.target
    if not (target is <p> or target.closest('.paragraph')):
        return  // テキスト外のクリックは無視

    // クリック座標 → 文字オフセット変換
    offset = ReaderApp.clickPointToCharOffset(event.clientX, event.clientY)
    if offset < 0:
        return  // 変換失敗時は何もしない

    // 双方向クリック (BR-31, Q5=A: 絶対上書き)
    state.readOffset = offset

    // 青色化を再適用
    ReaderApp.applyReadProgress(offset)

    // 永続化 (BR-34: クリック時に即時保存)
    ReaderApp.saveState({
        readOffset: offset,
        scrollY: window.scrollY
    })
```

```pseudo
function ReaderApp.clickPointToCharOffset(clientX, clientY):
    // Q2=A: caretRangeFromPoint を使用
    range = document.caretRangeFromPoint(clientX, clientY)
    if range == null:
        return -1
    
    container = range.startContainer
    if container.nodeType != Node.TEXT_NODE:
        // テキストノード以外がクリックされた場合は親段落を探す
        p = container.closest('.paragraph') if container is Element else null
        if p:
            return parseInt(p.dataset.start)  // 段落の先頭にスナップ
        return -1

    // テキストノードを含む <p> を見つける
    p = container.parentElement.closest('.paragraph')
    if not p:
        return -1

    // 段落内の文字オフセットを計算
    inParaOffset = ReaderApp.calcInParaOffset(p, container, range.startOffset)
    return parseInt(p.dataset.start) + inParaOffset
```

```pseudo
function ReaderApp.calcInParaOffset(paragraph, container, charOffsetInContainer):
    // 段落内のテキストノードを順に走査して、container に到達するまでの文字数を加算
    cumOffset = 0
    walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    while node = walker.nextNode():
        if node === container:
            return cumOffset + charOffsetInContainer
        cumOffset += node.length
    return cumOffset  // フォールバック (理論上ここには来ないはず)
```

---

## 5. ReaderApp.saveState / loadState — 永続化

```pseudo
async function ReaderApp.saveState({ readOffset, scrollY }):
    snapshot = {
        read_offset: readOffset,
        scroll_y:    scrollY,
        novel_id:    'default',
        updated_at:  Date.now()
    }
    try:
        await chrome.storage.local.set({ reader_state: snapshot })
    catch e:
        // BR-35: 保存失敗は黙って許容
        log warning
```

```pseudo
async function ReaderApp.loadState():
    try:
        raw = await chrome.storage.local.get('reader_state')
        s = raw.reader_state
        if s and isValidSnapshot(s):
            return {
                readOffset: max(0, s.read_offset || 0),
                scrollY:    max(0, s.scroll_y || 0)
            }
    catch e:
        log warning
    
    // 不在/不正データ
    return { readOffset: 0, scrollY: 0 }


function isValidSnapshot(s):
    return (
        typeof s.read_offset === 'number' &&
        typeof s.scroll_y === 'number' &&
        Number.isFinite(s.read_offset) &&
        Number.isFinite(s.scroll_y)
    )
```

---

## 6. ReaderApp.savePartial / 離脱検知

```pseudo
function ReaderApp.onPageHide(event):
    // pagehide はタブを閉じる / ナビゲーションで発火、戻れない
    ReaderApp.savePartial({ scrollY: window.scrollY })


function ReaderApp.onVisibilityChange(event):
    // タブが他に切り替えられた / アクティブから離れた瞬間
    if document.visibilityState === 'hidden':
        ReaderApp.savePartial({ scrollY: window.scrollY })


function ReaderApp.savePartial({ scrollY }):
    // 離脱時の scrollY のみを更新。readOffset は前回値を維持。
    snapshot = {
        read_offset: state.readOffset,    // 現在の readOffset を維持
        scroll_y:    scrollY,
        novel_id:    'default',
        updated_at:  Date.now()
    }
    try:
        // 同期的に呼ぶ (await しない、戻り値の Promise は捨てる)
        chrome.storage.local.set({ reader_state: snapshot })
    catch e:
        // BR-35: 黙って許容
        log warning
```

設計判断: **`pagehide` は同期的に発火するため、`await` せず Promise を投げっぱなしにする** (Chrome の `chrome.storage.local.set` はブラウザ実装内部で writes をキューするので、同期発火後でもストレージへの書き込みは概ね保証される)。

---

## 7. 全体の状態遷移図 (Reader Page)

```
[ロード]
   ↓
ReaderApp.init()
   ├─ fetch novel.txt
   ├─ loadState
   ├─ renderText
   ├─ applyReadProgress(readOffset)  ← Q3=A: 先に
   ├─ scrollTo(scrollY)              ← その後
   └─ addEventListeners
       ↓
[ユーザー操作待ち]
       ↓
       ├──[ユーザーがテキストをクリック]
       │      ↓
       │   onTextClick
       │   ├─ caretRangeFromPoint
       │   ├─ readOffset = newOffset (絶対上書き)
       │   ├─ applyReadProgress(newOffset)
       │   └─ saveState
       │      ↓
       │   [ユーザー操作待ち] へ戻る
       │
       └──[タブ離脱 / Claude 完了 / Chrome 終了]
              ↓
           pagehide / visibilitychange='hidden'
              ↓
           savePartial({ scrollY })   ← readOffset は維持
              ↓
           [タブ閉じ or 復帰待機]
```

次回起動時には ReaderApp.init() から再度同じシーケンスを通る。
