// Modules read and update this directly; only main.js changes `current`.
export const state = {
  tables: [],
  counts: {},
  current: null,

  filter: '', // raw query string, e.g. "age[$gte]=18"
  sort: null, // { field, dir: 'asc' | 'desc' }
  limit: 25,
  offset: 0,
  rows: [],
  total: 0, // matching records across all pages
};

export function resetGridState() {
  state.filter = '';
  state.sort = null;
  state.offset = 0;
}
