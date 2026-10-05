import * as api from './api.js';
import { $ } from './dom.js';

const CHANGE_EVENTS = ['insert', 'update', 'delete', 'replace'];

// Coalesces bursts of changes (e.g. a bulk load) into one callback.
const DEBOUNCE_MS = 100;

// `onChange` receives the ids of records touched since its last call. Returns a function that stops listening.
export function watchTable(table, onChange) {
  const source = api.openTableEvents(table);
  let timer = null;
  let changedIds = [];

  const handleEvent = event => {
    changedIds.push(...idsIn(event.data));
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ids = changedIds;
      changedIds = [];
      onChange(ids);
    }, DEBOUNCE_MS);
  };

  CHANGE_EVENTS.forEach(type => source.addEventListener(type, handleEvent));
  source.onopen = () => renderLive(true);
  source.onerror = () => renderLive(false); // EventSource reconnects on its own

  return () => {
    clearTimeout(timer);
    source.close();
  };
}

function idsIn(data) {
  try {
    return JSON.parse(data).map(record => record?.id).filter(id => id !== undefined);
  } catch {
    return [];
  }
}

function renderLive(connected) {
  const badge = $('live');
  badge.querySelector('.dot').className = `dot ${connected ? 'ok' : 'down'}`;
  badge.lastChild.textContent = connected ? 'Live' : 'Reconnecting';
}
