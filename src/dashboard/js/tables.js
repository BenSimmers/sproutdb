import * as api from './api.js';
import { $, el, showError, toast } from './dom.js';
import { formatNumber } from './format.js';
import { state } from './state.js';

export function renderTableList({ onSelect }) {
  const items = state.tables.map(name => {
    const active = name === state.current;
    return el('li', {},
      el('button', {
        class: `table-link${active ? ' active' : ''}`,
        type: 'button',
        'aria-current': active ? 'true' : undefined,
        onclick: () => onSelect(name),
      },
        el('span', {}, name),
        el('span', { class: 'count' }, formatNumber(state.counts[name] ?? 0)),
      ),
    );
  });
  $('table-list').replaceChildren(...items);
}

export function initNewTableForm({ onCreated }) {
  $('new-table-form').addEventListener('submit', async event => {
    event.preventDefault();
    const input = $('new-table-name');
    const name = input.value.trim();
    if (!name) return;

    try {
      await api.createTable(name);
      input.value = '';
      toast(`Created ${name}`);
      await onCreated(name);
    } catch (error) {
      showError(error);
    }
  });
}
