import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from './Icons';

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'success', duration = 4000) => {
      const id = ++seq;
      setToasts((list) => [...list, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d),
      info: (m, d) => push(m, 'info', d),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'error' ? (
                <Icon.Alert size={19} />
              ) : t.type === 'info' ? (
                <Icon.Info size={19} />
              ) : (
                <Icon.CheckCircle size={19} />
              )}
            </span>
            <p className="toast-msg">{t.message}</p>
            <button
              className="toast-x"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon.X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
