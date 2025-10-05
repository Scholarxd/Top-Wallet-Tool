(function() {
  const STORAGE_KEY = 'gmgnTopHolderOriginals';
  const TAG_ATTR = 'data-gmgn-tracker-tag';

  function getTopHolderNameNodes() {
    // Heuristic: Look for common holder tables/lists within the Top holders tab
    const candidateRoots = [];
    // GMGN often renders with data-reactroot or within content area
    candidateRoots.push(...document.querySelectorAll('[data-reactroot], main, .ant-table, .ant-list, .holder-list'));

    const nameNodes = new Set();

    const holderRowSelectors = [
      'tr',
      '.ant-table-row',
      '.holder-row',
      'li',
      '.list-item'
    ];

    const nameCellSelectors = [
      // common selectors that may contain wallet name/address
      '.address',
      '.name',
      '.holder',
      '.ant-typography',
      'a[href*="etherscan"], a[href*="basescan"], a[href*="solscan"], a[href*="arbiscan"], a[href*="bscscan"], a[href*="snowtrace"]',
      'a[href*="/address/"]',
      'span',
      'div'
    ];

    function looksLikeAddress(text) {
      if (!text) return false;
      const t = text.trim();
      // hex evm
      if (/^0x[0-9a-fA-F]{4,}$/.test(t)) return true;
      // short labeled addrs or ENS-like
      if (t.endsWith('.eth') || t.includes(':') || t.includes('...')) return true;
      // base/sol generic: contains dots or is long
      if (t.length >= 35) return true;
      return false;
    }

    function likelyNameNode(node) {
      const txt = (node.textContent || '').trim();
      if (!txt) return false;
      // exclude cells that are clearly numeric (balances, percent)
      if (/^[\d,.%\s]+$/.test(txt)) return false;
      if (looksLikeAddress(txt)) return true;
      // include generic label-like texts
      if (/holder|wallet|address|ens/i.test(txt)) return true;
      // avoid buttons/controls
      if (node.closest('button, [role="button"], input, select, textarea')) return false;
      return true;
    }

    for (const root of candidateRoots) {
      for (const rowSel of holderRowSelectors) {
        const rows = root.querySelectorAll(rowSel);
        rows.forEach((row) => {
          for (const cellSel of nameCellSelectors) {
            const cells = row.querySelectorAll(cellSel);
            cells.forEach((cell) => {
              if (likelyNameNode(cell)) nameNodes.add(cell);
            });
          }
        });
      }
    }

    // De-duplicate by element
    return Array.from(nameNodes);
  }

  function loadOriginals() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveOriginals(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function labelNode(node, label) {
    if (!node) return;
    if (!node.hasAttribute(TAG_ATTR)) {
      node.setAttribute(TAG_ATTR, '1');
      node.dataset.originalText = node.textContent || '';
    }
    node.textContent = label;
  }

  function restoreNode(node) {
    if (!node) return;
    if (node.hasAttribute(TAG_ATTR)) {
      const original = node.dataset.originalText || '';
      node.textContent = original;
      node.removeAttribute(TAG_ATTR);
      delete node.dataset.originalText;
    }
  }

  function trackTopHolders(count) {
    const nodes = getTopHolderNameNodes();
    if (!nodes.length) return { ok: false, message: 'No holder names found on this page.' };

    // stable order by DOM position
    const ordered = nodes.sort((a,b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

    const originals = loadOriginals();
    let applied = 0;

    for (let i = 0; i < ordered.length && applied < count; i++) {
      const node = ordered[i];
      const key = node.dataset.gmgnKey || node.outerHTML.slice(0, 100);
      if (!originals[key]) {
        originals[key] = node.textContent || '';
      }
      labelNode(node, `Top Holder ${applied + 1}`);
      applied++;
    }

    saveOriginals(originals);
    return { ok: true, message: `Tracking ${applied} holder(s).` };
  }

  function untrackAll() {
    const nodes = getTopHolderNameNodes();
    const originals = loadOriginals();

    let reverted = 0;
    nodes.forEach((node) => {
      if (node.hasAttribute(TAG_ATTR)) {
        restoreNode(node);
        reverted++;
      } else {
        // try map by key
        const key = node.dataset.gmgnKey || node.outerHTML.slice(0, 100);
        if (originals[key]) {
          node.textContent = originals[key];
          reverted++;
        }
      }
    });

    // Clear tag attributes as well
    Object.keys(originals).forEach((k) => delete originals[k]);
    saveOriginals(originals);

    return { ok: true, message: `Untracked ${reverted} holder(s).` };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg && msg.type === 'GMGN_TRACK') {
        const n = Math.max(1, Math.min(100, Number(msg.count) || 1));
        const res = trackTopHolders(n);
        sendResponse(res);
        return true;
      }
      if (msg && msg.type === 'GMGN_UNTRACK') {
        const res = untrackAll();
        sendResponse(res);
        return true;
      }
    } catch (e) {
      sendResponse({ ok: false, message: String(e?.message || e) });
      return true;
    }
  });
})();
