const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const trackBtn = document.getElementById('track');
const untrackBtn = document.getElementById('untrack');

function setStatus(text) {
  statusEl.textContent = text || '';
}

function sendToActiveTab(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) {
          reject(new Error('No active tab'));
          return;
        }
        chrome.tabs.sendMessage(tab.id, message, resolve);
      });
    } catch (e) {
      reject(e);
    }
  });
}

trackBtn.addEventListener('click', async () => {
  const n = Math.max(1, Math.min(100, Number(countEl.value) || 1));
  trackBtn.disabled = true; untrackBtn.disabled = true; setStatus('Tracking...');
  try {
    const res = await sendToActiveTab({ type: 'GMGN_TRACK', count: n });
    setStatus(res && res.message ? res.message : 'Done');
  } catch (e) {
    setStatus('Failed: ' + (e.message || e));
  } finally {
    trackBtn.disabled = false; untrackBtn.disabled = false;
  }
});

untrackBtn.addEventListener('click', async () => {
  trackBtn.disabled = true; untrackBtn.disabled = true; setStatus('Untracking...');
  try {
    const res = await sendToActiveTab({ type: 'GMGN_UNTRACK' });
    setStatus(res && res.message ? res.message : 'Reverted');
  } catch (e) {
    setStatus('Failed: ' + (e.message || e));
  } finally {
    trackBtn.disabled = false; untrackBtn.disabled = false;
  }
});
