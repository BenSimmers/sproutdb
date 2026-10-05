import * as api from './api.js';
import { $, confirmClick, el, showError, toast } from './dom.js';
import { openEditor } from './editor.js';
import { formatNumber } from './format.js';
import { state } from './state.js';

// Rows whose ids are in `highlightIds` flash briefly, to show live changes.
export async function loadRecords(highlightIds = []) {
  const table = state.current;
  if (!table) return;

  try {
    const { rows, total } = await api.listRecords(table, state);
    if (table !== state.current) return; // the user switched tables while this was loading

    // If the page we were on no longer exists (e.g. records were deleted), step back to the last page.
    if (state.offset > 0 && state.offset >= total) {
      state.offset = Math.max(0, Math.floor((total - 1) / state.limit) * state.limit);
      return loadRecords(highlightIds);
    }

    state.rows = rows;
    state.total = total;
    render(new Set(highlightIds.map(String)));
  } catch (error) {
    showError(error);
  }
}

export function initRecordControls() {
  $('filter-form').addEventListener('submit', event => {
    event.preventDefault();
    applyFilter($('filter-input').value.trim());
  });

  $('clear-filter-btn').addEventListener('click', () => {
    $('filter-input').value = '';
    applyFilter('');
  });

  $('page-size').addEventListener('change', event => {
    state.limit = Number(event.target.value);
    goToOffset(0);
  });

  $('prev-btn').addEventListener('click', () => goToOffset(Math.max(0, state.offset - state.limit)));
  $('next-btn').addEventListener('click', () => goToOffset(state.offset + state.limit));
}

function applyFilter(filter) {
  state.filter = filter;
  goToOffset(0);
}

function goToOffset(offset) {
  state.offset = offset;
  loadRecords();
}

function cycleSort(field) {
  if (state.sort?.field !== field) state.sort = { field, dir: 'asc' };
  else if (state.sort.dir === 'asc') state.sort = { field, dir: 'desc' };
  else state.sort = null;
  goToOffset(0);
}

const isRecord = row => row !== null && typeof row === 'object';
const hasId = row => isRecord(row) && row.id !== undefined;

function render(highlight) {
  const columns = columnsFor(state.rows);
  $('grid-head').replaceChildren(renderHeader(columns));
  $('grid-body').replaceChildren(...state.rows.map(row => renderRow(row, columns, highlight)));
  renderEmptyState();
  renderPager();
}

function columnsFor(rows) {
  const columns = new Set();
  if (rows.some(row => isRecord(row) && 'id' in row)) columns.add('id');
  rows.filter(isRecord).forEach(row => Object.keys(row).forEach(key => columns.add(key)));
  return [...columns];
}

function renderHeader(columns) {
  const headings = columns.map(field => {
    const dir = state.sort?.field === field ? state.sort.dir : null;
    return el('th', { 'aria-sort': dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined },
      el('button', { type: 'button', onclick: () => cycleSort(field) },
        field,
        dir ? el('span', { class: 'arrow', 'aria-hidden': 'true' }, dir === 'asc' ? '▲' : '▼') : null,
      ),
    );
  });
  return el('tr', {}, headings, el('th', {}, el('span', { class: 'sr-only' }, 'Actions')));
}

function renderRow(row, columns, highlight) {
  const flash = hasId(row) && highlight.has(String(row.id));
  return el('tr', { class: flash ? 'flash' : undefined },
    columns.map(field => renderCell(isRecord(row) ? row[field] : row)),
    el('td', { class: 'row-actions' }, editButton(row), ' ', deleteButton(row)),
  );
}

function renderCell(value) {
  if (value === undefined) return el('td', { class: 'null' }, '');
  if (value === null) return el('td', { class: 'null' }, 'null');
  if (typeof value === 'object') {
    return el('td', { class: 'json', title: JSON.stringify(value, null, 2) }, JSON.stringify(value));
  }
  if (typeof value === 'number') return el('td', { class: 'num' }, String(value));

  const text = String(value);
  return el('td', { title: text.length > 40 ? text : undefined }, text);
}

function editButton(row) {
  return el('button', {
    class: 'btn small',
    type: 'button',
    disabled: !hasId(row),
    title: hasId(row) ? 'Edit record' : 'Records need an id to be edited',
    onclick: () => openEditor(row),
  }, 'Edit');
}

function deleteButton(row) {
  const button = el('button', {
    class: 'btn small danger',
    type: 'button',
    disabled: !hasId(row),
    title: hasId(row) ? 'Delete record' : 'Records need an id to be deleted',
  }, 'Delete');

  if (hasId(row)) {
    confirmClick(button, 'Confirm', async () => {
      try {
        await api.deleteRecord(state.current, row.id);
        toast('Record deleted');
        await loadRecords();
      } catch (error) {
        showError(error);
      }
    });
  }
  return button;
}

function renderEmptyState() {
  const empty = state.rows.length === 0;
  $('no-rows').hidden = !empty;
  $('no-rows').textContent = state.filter ? 'No records match this filter.' : 'This table is empty.';
  $('grid-wrap').hidden = empty;
}

function renderPager() {
  const from = state.total === 0 ? 0 : state.offset + 1;
  const to = Math.min(state.offset + state.limit, state.total);
  $('page-info').textContent = `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(state.total)}`;
  $('prev-btn').disabled = state.offset === 0;
  $('next-btn').disabled = state.offset + state.limit >= state.total;
}
