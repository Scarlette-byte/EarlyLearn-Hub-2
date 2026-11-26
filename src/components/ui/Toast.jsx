import Icon from '../Icons.jsx';

/**
 * Shared accessible Toast / Inline Alert banner matching Login's semantic tokens.
 * Supports floating toast (`floating={true}`, default) or inline banner (`floating={false}`).
 */
export default function Toast({
  message,
  type = 'info', // 'info' | 'success' | 'ok' | 'warning' | 'error'
  floating = true,
  onClose,
  className = '',
}) {
  if (!message) return null;

  const normalized = type === 'ok' ? 'success' : type;

  const styles = {
    info: 'bg-status-info-bg border-status-info-border text-status-info',
    success: 'bg-status-ok-bg border-status-ok-border text-status-ok',
    warning: 'bg-status-warn-bg border-status-warn-border text-status-warn',
    error: 'bg-status-error-bg border-status-error-border text-status-error',
  };

  const iconNames = {
    info: 'info',
    success: 'check-circle',
    warning: 'warning',
    error: 'alert-circle',
  };

  const layoutClass = floating
    ? 'fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100%-2.5rem)] shadow-auth-card'
    : 'w-full';

  return (
    <div
      role={normalized === 'error' ? 'alert' : 'status'}
      aria-live={normalized === 'error' ? 'assertive' : 'polite'}
      className={`${layoutClass} px-4 py-3 rounded-ui-input border flex items-start justify-between gap-2.5 min-w-0 animate-ui-fade-up ${
        styles[normalized] || styles.info
      } ${className}`}
    >
      <Icon name={iconNames[normalized] || 'info'} size={17} className="mt-0.5 shrink-0" />
      <p className="text-xs sm:text-[13px] font-bold m-0 leading-snug break-words min-w-0 flex-1">
        {message}
      </p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer bg-transparent border-none text-current"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
