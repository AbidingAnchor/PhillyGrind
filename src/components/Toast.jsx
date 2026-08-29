import { useEffect } from 'react';

function Toast({ message, duration = 5000, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="toast-notification" role="status">
      {message}
    </div>
  );
}

export default Toast;
