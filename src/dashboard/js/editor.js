import * as api from './api.js';
import { $, toast } from './dom.js';
import { state } from './state.js';

// null when adding a new record.
let editingId = null;
let afterSave = () => {};

export function initEditor({ onSaved }) {
  afterSave = onSaved;
  $('record-form').addEventListener('submit', handleSubmit);

  $('record-json').addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) $('record-save').click();
  });
}

export function openEditor(record = null) {
  editingId = record ? record.id : null;
  $('record-title').textContent = record
    ? `Edit record ${JSON.stringify(record.id)}`
    : `Add record to ${state.current}`;
  $('record-json').value = JSON.stringify(record ?? newRecordTemplate(), null, 2);
  setError('');
  $('record-dialog').showModal();
  $('record-json').focus();
}

// A blank record shaped like the first one on screen, without an id (the server assigns one).
function newRecordTemplate() {
  const sample = state.rows.find(row => row && typeof row === 'object');
  if (!sample) return {};

  const blank = value => {
    if (typeof value === 'number') return 0;
    if (typeof value === 'boolean') return false;
    if (typeof value === 'string') return '';
    return value;
  };
  return Object.fromEntries(Object.entries(sample).filter(([key]) => key !== 'id').map(([key, value]) => [key, blank(value)]));
}

async function handleSubmit(event) {
  // The Cancel button closes the <dialog method="dialog"> natively.
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();

  const record = parseRecord($('record-json').value);
  if (!record) return;

  const saveButton = $('record-save');
  saveButton.disabled = true;
  try {
    if (editingId === null) {
      await api.createRecord(state.current, record);
      toast('Record added');
    } else {
      await api.replaceRecord(state.current, editingId, record);
      toast('Record saved');
    }
    $('record-dialog').close();
    await afterSave();
  } catch (error) {
    setError(error.message);
  } finally {
    saveButton.disabled = false;
  }
}

function parseRecord(text) {
  let record;
  try {
    record = JSON.parse(text);
  } catch (error) {
    setError(`Invalid JSON: ${error.message}`);
    return null;
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    setError('A record must be a JSON object.');
    return null;
  }
  return record;
}

function setError(message) {
  $('record-error').textContent = message;
}
