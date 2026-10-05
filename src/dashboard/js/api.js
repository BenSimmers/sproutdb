const enc = encodeURIComponent;

// The page is served at <server>/dashboard/, so resolving API paths one level up
// keeps the dashboard working when the server is mounted under a prefix.
const endpoint = path => `..${path}`;

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(endpoint(path), {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = data?.error ?? `${res.status} ${res.statusText}`;
    const issues = Array.isArray(data?.issues) ? data.issues.map(i => i.message).filter(Boolean) : [];
    throw new Error([message, ...issues].join('\n'));
  }
  return { data, res };
}

export const getMetrics = async () => (await request('/metrics')).data;

export const getSnapshot = async () => (await request('/snapshot')).data;

export const restoreSnapshot = snapshot => request('/restore', { method: 'POST', body: snapshot });

export const resetDatabase = () => request('/reset', { method: 'POST' });

export const createTable = name => request('/tables', { method: 'POST', body: { name } });

export const dropTable = name => request(`/tables/${enc(name)}`, { method: 'DELETE' });

export async function listRecords(table, { filter, sort, limit, offset }) {
  const params = new URLSearchParams(filter.replace(/^\?/, ''));
  if (sort) params.set('_sort', (sort.dir === 'desc' ? '-' : '') + sort.field);
  params.set('_limit', limit);
  params.set('_offset', offset);

  const { data, res } = await request(`/tables/${enc(table)}?${params}`);
  return { rows: data, total: Number(res.headers.get('X-Total-Count') ?? data.length) };
}

export const openTableEvents = table => new EventSource(endpoint(`/tables/${enc(table)}/events`));

export const createRecord = (table, record) => request(`/tables/${enc(table)}`, { method: 'POST', body: record });

export const replaceRecord = (table, id, record) =>
  request(`/tables/${enc(table)}/${enc(id)}`, { method: 'PUT', body: record });

export const deleteRecord = (table, id) => request(`/tables/${enc(table)}/${enc(id)}`, { method: 'DELETE' });
