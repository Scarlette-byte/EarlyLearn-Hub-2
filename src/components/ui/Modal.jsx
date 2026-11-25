/**
 * Shared Modal dialog with backdrop, header, scrollable body, and text-overflow safety.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidth} bg-white rounded-2xl border border-[#ece6da] shadow-xl overflow-hidden min-w-0`}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#ece6da] min-w-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-base font-bold text-[#2b261c] m-0 break-words">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-[#7c725e] mt-0.5 m-0 break-words">{subtitle}</p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#7c725e] hover:bg-[#f5f0e6] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="p-5 max-h-[75vh] overflow-y-auto min-w-0 break-words">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 bg-[#faf8f4] border-t border-[#ece6da] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
