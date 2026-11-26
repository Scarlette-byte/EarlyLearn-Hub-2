import Icon from '../Icons.jsx';

/**
 * Shared Toast notification banner.
 */
export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-900',
  };

  const iconNames = {
    info: 'info',
    success: 'check-circle',
    warning: 'warning',
    error: 'alert-circle',
  };

  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-50 max-w-sm w-full px-4 py-3 rounded-xl border shadow-lg flex items-start justify-between gap-2.5 ${
        styles[type] || styles.info
      }`}
    >
      <Icon name={iconNames[type] || 'info'} size={16} className="mt-0.5 shrink-0" />
      <p className="text-xs font-semibold m-0 break-words min-w-0 flex-1">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 cursor-pointer"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
