import { $, el } from './dom.js';
import { formatDuration, formatNumber } from './format.js';

// The dashboard polls these itself, so they'd always top "Busiest endpoints".
const DASHBOARD_ENDPOINTS = ['GET /', 'GET /metrics'];
const MAX_ENDPOINTS = 8;

export function renderConnection(connected) {
  $('status-dot').className = `dot ${connected ? 'ok' : 'down'}`;
  $('status-text').textContent = connected ? 'Connected' : 'Server unreachable';
}

export function renderMetrics(metrics) {
  const totalRecords = Object.values(metrics.database.recordCounts).reduce((a, b) => a + b, 0);

  $('stat-records').textContent = formatNumber(totalRecords);
  $('stat-requests').textContent = formatNumber(metrics.requests.total);
  $('stat-errors').textContent = formatNumber(metrics.requests.errors);
  $('stat-latency').textContent = `${metrics.performance.avgResponseTime.toFixed(1)} ms`;
  $('stat-uptime').textContent = formatDuration(metrics.uptime);

  renderEndpoints(metrics.requests.byEndpoint);
}

function renderEndpoints(byEndpoint) {
  const busiest = Object.entries(byEndpoint)
    .filter(([name]) => !DASHBOARD_ENDPOINTS.includes(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENDPOINTS);

  const items = busiest.length
    ? busiest.map(([name, count]) => el('li', {}, el('code', { title: name }, name), el('span', {}, formatNumber(count))))
    : [el('li', { class: 'hint' }, 'No requests yet')];

  $('endpoints').replaceChildren(...items);
}
