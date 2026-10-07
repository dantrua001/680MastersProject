import { useEffect } from 'react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="panel w-full max-w-md shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="text-ink-300 hover:text-white">✕</button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
