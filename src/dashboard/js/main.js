import * as api from './api.js';
import { $, confirmClick, el, showError, toast } from './dom.js';
import { initEditor, openEditor } from './editor.js';
import { watchTable } from './live.js';
import { renderConnection, renderMetrics } from './metrics.js';
import { initRecordControls, loadRecords } from './records.js';
import { resetGridState, state } from './state.js';
import { initNewTableForm, renderTableList } from './tables.js';

const METRICS_INTERVAL_MS = 5000;

let stopWatching = () => {};

function selectTable(name) {
  deselectTable();
  state.current = name;
  resetGridState();
  $('filter-input').value = '';
  renderTableList({ onSelect: selectTable });

  $('no-table').hidden = !!name;
  $('table-view').hidden = !name;

  // Remember the table in the URL so a reload returns to it.
  history.replaceState(null, '', name ? `#${encodeURIComponent(name)}` : location.pathname);
  if (!name) return;

  $('table-name').textContent = name;
  stopWatching = watchTable(name, async changedIds => {
    await Promise.all([loadRecords(changedIds), refresh()]);
  });
  loadRecords();
}

// The next refresh() picks a table to show again.
function deselectTable() {
  stopWatching();
  stopWatching = () => {};
  state.current = null;
}

function tableToShow() {
  const fromUrl = decodeURIComponent(location.hash.slice(1));
  if (state.tables.includes(state.current)) return state.current;
  if (state.tables.includes(fromUrl)) return fromUrl;
  return state.tables[0] ?? null;
}

async function refresh() {
  let metrics;
  try {
    metrics = await api.getMetrics();
  } catch {
    renderConnection(false);
    return;
  }

  renderConnection(true);
  renderMetrics(metrics);
  state.tables = metrics.database.tables;
  state.counts = metrics.database.recordCounts;
  renderTableList({ onSelect: selectTable });

  const wanted = tableToShow();
  const tableViewShowing = !$('table-view').hidden;
  if (wanted !== state.current || (wanted === null && tableViewShowing)) {
    selectTable(wanted);
  }
}

// Reset and restore replace the server's table objects, so the live stream must reconnect.
async function reloadAfterBulkChange() {
  deselectTable();
  await refresh();
}

function initTableActions() {
  $('add-record-btn').addEventListener('click', () => openEditor());

  confirmClick($('drop-table-btn'), 'Click again to drop', async () => {
    const name = state.current;
    try {
      await api.dropTable(name);
      toast(`Dropped ${name}`);
      deselectTable();
      await refresh();
    } catch (error) {
      showError(error);
    }
  });
}

function initDatabaseActions() {
  $('snapshot-btn').addEventListener('click', async () => {
    try {
      downloadJson(await api.getSnapshot(), `sproutdb-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    } catch (error) {
      showError(error);
    }
  });

  $('restore-btn').addEventListener('click', () => $('restore-file').click());
  $('restore-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = ''; // so choosing the same file again still triggers "change"
    if (!file) return;
    try {
      await api.restoreSnapshot(JSON.parse(await file.text()));
      toast(`Restored ${file.name}`);
      await reloadAfterBulkChange();
    } catch (error) {
      showError(error);
    }
  });

  confirmClick($('reset-btn'), 'Click again to reset', async () => {
    try {
      await api.resetDatabase();
      toast('Database reset to seed');
      await reloadAfterBulkChange();
    } catch (error) {
      showError(error);
    }
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = el('a', { href: URL.createObjectURL(blob), download: filename });
  link.click();
  URL.revokeObjectURL(link.href);
}

initEditor({ onSaved: () => loadRecords() });
initRecordControls();
initNewTableForm({
  onCreated: async name => {
    await refresh();
    selectTable(name);
  },
});
initTableActions();
initDatabaseActions();

refresh();
setInterval(refresh, METRICS_INTERVAL_MS);
