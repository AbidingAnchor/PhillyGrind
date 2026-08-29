const listeners = new Set();

export function showToast(message) {
  const text = String(message || '').trim();
  if (!text) return;
  listeners.forEach((listener) => listener(text));
}

export function subscribeToToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
