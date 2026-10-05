export const $ = id => document.getElementById(id);

// Children are appended as nodes or text, never parsed as HTML.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

export function toast(message, type = 'info') {
  const node = el('div', { class: `toast ${type}` }, message);
  $('toasts').append(node);
  setTimeout(() => node.remove(), type === 'error' ? 6000 : 2500);
}

export const showError = error => toast(error.message || String(error), 'error');

// Destructive buttons ask for a second click rather than opening a blocking confirm() dialog.
export function confirmClick(button, confirmLabel, action) {
  const original = button.textContent;
  let timer = null;

  const disarm = () => {
    clearTimeout(timer);
    button.classList.remove('confirming');
    button.textContent = original;
  };

  button.addEventListener('click', async () => {
    if (!button.classList.contains('confirming')) {
      button.classList.add('confirming');
      button.textContent = confirmLabel;
      timer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    await action();
  });
}
