import { useEffect } from 'react';
import Icon from '../Icons.jsx';

/**
 * Shared Modal dialog with Escape key close, backdrop click, brand accent bar,
 * scrollable body, and text-overflow safety.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  children,
  footer,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ui-panel-deep/60 backdrop-blur-[2px] p-4 overflow-y-auto animate-ui-fade-up"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Modal dialog'}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        className={`relative w-full ${maxWidth} bg-ui-surface rounded-auth-card border border-ui-border shadow-auth-card overflow-hidden min-w-0 my-auto`}
      >
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-gradient-to-r from-brand-leaf-deep via-brand-yellow to-brand-coral"
        />

        {(title || onClose || badge) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6 border-b border-ui-border min-w-0">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {icon && (
                <div className="w-9 h-9 rounded-xl bg-brand-leaf-tint border border-brand-leaf/30 text-brand-leaf-deep flex items-center justify-center shrink-0 mt-0.5">
                  {typeof icon === 'string' ? <Icon name={icon} size={18} /> : icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {badge && <div className="mb-1">{badge}</div>}
                {title && (
                  <h3 className="font-baloo text-lg sm:text-xl font-extrabold text-ui-ink m-0 leading-snug break-words">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-ui-ink-muted mt-0.5 m-0 leading-relaxed break-words">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-ui-ink-muted hover:text-ui-ink hover:bg-ui-surface-warm transition-colors cursor-pointer bg-transparent border border-transparent"
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
        )}

        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto min-w-0 break-words">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 sm:px-6 bg-ui-surface-subtle border-t border-ui-border flex items-center justify-end gap-2.5 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
