/**
 * Options Page (OptionsApp + OptionsAPI)
 *
 * 関連 FR: FR-04, FR-09, FR-10, FR-11
 * 関連 US: US-05 (設定UI), US-06 (空状態案内)
 *
 * 関連ルール: BR-01〜04 (UI バリデーション、二重防御として SettingsRepository でも検証)
 */

(() => {
  'use strict';

  // ========================================================================
  // OptionsAPI: sendMessage の Promise ラッパー
  // ========================================================================
  const OptionsAPI = {
    send(type, payload) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type, payload }, (resp) => {
          const _ = chrome.runtime.lastError; // 警告抑制
          resolve(resp);
        });
      });
    },
    getSettings() {
      return this.send('GET_SETTINGS', {});
    },
    addSite(site) {
      return this.send('ADD_SITE', site);
    },
    updateSite(payload) {
      return this.send('UPDATE_SITE', payload);
    },
    deleteSite(domain) {
      return this.send('DELETE_SITE', { domain });
    },
    reorderSites(orderedDomains) {
      return this.send('REORDER_SITES', { orderedDomains });
    },
    setThresholdSec(thresholdSec) {
      return this.send('SET_THRESHOLD', { thresholdSec });
    },
  };

  // ========================================================================
  // バリデーション (BR-01, 02, 04)
  // ========================================================================
  const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function normalizeDomain(s) {
    return (s || '').trim().toLowerCase().replace(/^www\./, '');
  }

  function validateDomain(input) {
    const d = normalizeDomain(input);
    if (d.length === 0 || d.length > 255 || !DOMAIN_REGEX.test(d)) {
      return { ok: false, reason: 'ドメイン名の形式が正しくありません (例: youtube.com)' };
    }
    return { ok: true, value: d };
  }

  function validateUrl(input) {
    const s = (input || '').trim();
    if (s.length === 0 || s.length > 2048) {
      return { ok: false, reason: 'URL を入力してください' };
    }
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { ok: false, reason: 'URL は http:// または https:// で始めてください' };
      }
      return { ok: true, value: s };
    } catch (_e) {
      return { ok: false, reason: 'URL の形式が正しくありません' };
    }
  }

  function validateThreshold(input) {
    const n = Number(input);
    if (!Number.isInteger(n)) {
      return { ok: false, reason: 'しきい値は整数で入力してください' };
    }
    if (n < 1 || n > 60) {
      return { ok: false, reason: 'しきい値は 1 〜 60 の範囲で入力してください' };
    }
    return { ok: true, value: n };
  }

  function reasonToMessage(reason) {
    switch (reason) {
      case 'invalid_domain': return 'ドメイン名の形式が正しくありません';
      case 'invalid_url': return 'URL の形式が正しくありません';
      case 'duplicate_domain': return 'このドメインは既に登録されています';
      case 'invalid_threshold': return 'しきい値は 1 〜 60 の整数で入力してください';
      case 'not_found': return '対象のサイトが見つかりませんでした';
      case 'storage_error': return 'ストレージへの保存に失敗しました';
      default: return '保存に失敗しました';
    }
  }

  // ========================================================================
  // OptionsApp: UI 制御
  // ========================================================================
  const App = {
    settings: { sites: [], thresholdSec: 5 },
    editingDomain: null,

    async init() {
      this.settings = await OptionsAPI.getSettings();
      this.bindEvents();
      this.render();
    },

    bindEvents() {
      document.getElementById('threshold-save').addEventListener('click', () => this.onSaveThreshold());

      document.getElementById('add-site-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        this.onSubmitAddSite();
      });
    },

    render() {
      this.renderThreshold();
      this.renderSites();
    },

    renderThreshold() {
      const input = document.getElementById('threshold-input');
      input.value = this.settings.thresholdSec;
      this.clearMessage('threshold-message');
    },

    renderSites() {
      const empty = document.getElementById('empty-state');
      const table = document.getElementById('sites-table');
      const tbody = document.getElementById('sites-tbody');
      tbody.innerHTML = '';

      if (this.settings.sites.length === 0) {
        empty.hidden = false;
        table.hidden = true;
        return;
      }

      empty.hidden = true;
      table.hidden = false;

      this.settings.sites.forEach((site, index) => {
        const tr = document.createElement('tr');
        tr.dataset.domain = site.domain;
        tr.dataset.testid = `site-row-${site.domain}`;

        if (this.editingDomain === site.domain) {
          tr.appendChild(this.cell(`${site.priority}`, 'col-priority'));
          tr.appendChild(this.editCellInput('text', `edit-domain-${site.domain}`, site.domain, 'col-domain'));
          tr.appendChild(this.editCellInput('url', `edit-url-${site.domain}`, site.url, 'col-url'));
          tr.appendChild(this.editActionsCell(site));
        } else {
          tr.appendChild(this.cell(`${site.priority}`, 'col-priority'));
          tr.appendChild(this.cell(site.domain, 'col-domain'));
          tr.appendChild(this.cell(site.url, 'col-url'));
          tr.appendChild(this.actionsCell(site, index));
        }

        tbody.appendChild(tr);
      });
    },

    cell(text, cls) {
      const td = document.createElement('td');
      td.className = cls;
      td.textContent = text;
      return td;
    },

    editCellInput(type, id, value, cls) {
      const td = document.createElement('td');
      td.className = cls;
      const input = document.createElement('input');
      input.type = type;
      input.id = id;
      input.value = value;
      td.appendChild(input);
      return td;
    },

    actionsCell(site, index) {
      const td = document.createElement('td');
      td.className = 'col-actions';
      const group = document.createElement('div');
      group.className = 'actions-group';

      const editBtn = this.btn('編集', 'icon secondary', `edit-${site.domain}`);
      editBtn.addEventListener('click', () => {
        this.editingDomain = site.domain;
        this.render();
      });

      const upBtn = this.btn('▲', 'icon secondary', `up-${site.domain}`);
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => this.onMove(index, index - 1));

      const downBtn = this.btn('▼', 'icon secondary', `down-${site.domain}`);
      downBtn.disabled = index === this.settings.sites.length - 1;
      downBtn.addEventListener('click', () => this.onMove(index, index + 1));

      const delBtn = this.btn('🗑', 'icon danger', `delete-${site.domain}`);
      delBtn.addEventListener('click', () => this.onDelete(site.domain));

      group.appendChild(editBtn);
      group.appendChild(upBtn);
      group.appendChild(downBtn);
      group.appendChild(delBtn);
      td.appendChild(group);
      return td;
    },

    editActionsCell(site) {
      const td = document.createElement('td');
      td.className = 'col-actions';
      const group = document.createElement('div');
      group.className = 'actions-group';

      const saveBtn = this.btn('保存', 'icon', `save-edit-${site.domain}`);
      saveBtn.addEventListener('click', () => this.onSaveEdit(site.domain));

      const cancelBtn = this.btn('キャンセル', 'icon secondary', `cancel-edit-${site.domain}`);
      cancelBtn.addEventListener('click', () => {
        this.editingDomain = null;
        this.render();
      });

      group.appendChild(saveBtn);
      group.appendChild(cancelBtn);
      td.appendChild(group);
      return td;
    },

    btn(text, cls, testId) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = cls;
      if (testId) b.dataset.testid = testId;
      return b;
    },

    setMessage(id, text, type) {
      const el = document.getElementById(id);
      el.textContent = text;
      el.className = `message ${type || ''}`;
    },

    clearMessage(id) {
      this.setMessage(id, '', '');
    },

    flashSuccess(id, text) {
      this.setMessage(id, text, 'success');
      setTimeout(() => this.clearMessage(id), 3000);
    },

    // ----------------------------------------------------------------------
    // Threshold
    // ----------------------------------------------------------------------
    async onSaveThreshold() {
      const raw = document.getElementById('threshold-input').value;
      const v = validateThreshold(raw);
      if (!v.ok) {
        this.setMessage('threshold-message', v.reason, 'error');
        return;
      }
      const r = await OptionsAPI.setThresholdSec(v.value);
      if (r && r.ok) {
        this.settings.thresholdSec = v.value;
        this.flashSuccess('threshold-message', '保存しました');
      } else {
        this.setMessage('threshold-message', reasonToMessage(r && r.reason), 'error');
      }
    },

    // ----------------------------------------------------------------------
    // Add site
    // ----------------------------------------------------------------------
    async onSubmitAddSite() {
      const domainInput = document.getElementById('add-domain').value;
      const urlInput = document.getElementById('add-url').value;

      const dv = validateDomain(domainInput);
      const uv = validateUrl(urlInput);

      if (!dv.ok || !uv.ok) {
        const errors = [];
        if (!dv.ok) errors.push(dv.reason);
        if (!uv.ok) errors.push(uv.reason);
        this.setMessage('add-site-message', errors.join(' / '), 'error');
        return;
      }

      const r = await OptionsAPI.addSite({ domain: dv.value, url: uv.value });
      if (r && r.ok) {
        document.getElementById('add-domain').value = '';
        document.getElementById('add-url').value = '';
        await this.refresh();
        this.flashSuccess('add-site-message', '追加しました');
      } else {
        this.setMessage('add-site-message', reasonToMessage(r && r.reason), 'error');
      }
    },

    // ----------------------------------------------------------------------
    // Inline edit
    // ----------------------------------------------------------------------
    async onSaveEdit(originalDomain) {
      const newDomain = document.getElementById(`edit-domain-${originalDomain}`).value;
      const newUrl = document.getElementById(`edit-url-${originalDomain}`).value;

      const dv = validateDomain(newDomain);
      const uv = validateUrl(newUrl);

      if (!dv.ok || !uv.ok) {
        const errors = [];
        if (!dv.ok) errors.push(dv.reason);
        if (!uv.ok) errors.push(uv.reason);
        // インライン編集中はテーブル下に表示する場所がないのでアラート利用
        alert(`入力エラー: ${errors.join(' / ')}`);
        return;
      }

      const r = await OptionsAPI.updateSite({
        originalDomain,
        domain: dv.value,
        url: uv.value,
      });
      if (r && r.ok) {
        this.editingDomain = null;
        await this.refresh();
      } else {
        alert(`保存に失敗: ${reasonToMessage(r && r.reason)}`);
      }
    },

    // ----------------------------------------------------------------------
    // Delete / Reorder
    // ----------------------------------------------------------------------
    async onDelete(domain) {
      const ok = confirm(`${domain} を削除しますか?`);
      if (!ok) return;
      const r = await OptionsAPI.deleteSite(domain);
      if (r && r.ok) {
        await this.refresh();
      } else {
        alert(`削除に失敗: ${reasonToMessage(r && r.reason)}`);
      }
    },

    async onMove(fromIdx, toIdx) {
      const next = [...this.settings.sites];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const r = await OptionsAPI.reorderSites(next.map((s) => s.domain));
      if (r && r.ok) {
        await this.refresh();
      } else {
        alert(`並び替えに失敗: ${reasonToMessage(r && r.reason)}`);
      }
    },

    async refresh() {
      this.settings = await OptionsAPI.getSettings();
      this.render();
    },
  };

  // ========================================================================
  // Bootstrap
  // ========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
