export function currentAppPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

export function redirectToSignup(navigate, from) {
  const next = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : currentAppPath();

  if (typeof navigate === 'function') {
    navigate('/signup', { state: { from: next } });
    return;
  }

  window.location.assign('/signup');
}

export function isLoginRequiredError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('must be logged in')
    || message.includes('please log in')
    || message.includes('log in first')
    || message.includes('log in before')
    || message.includes('log in to ')
  );
}

export function alertUnlessLoginRequired(error, navigate, from) {
  if (isLoginRequiredError(error)) {
    redirectToSignup(navigate, from);
    return true;
  }

  alert(error?.message || String(error || 'Something went wrong.'));
  return false;
}
