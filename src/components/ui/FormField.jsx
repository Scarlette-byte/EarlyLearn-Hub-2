import Icon from '../Icons.jsx';

/**
 * Shared FormField wrapper with accessible label, helper text, error alert, and min-w-0 safety.
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  error = '',
  helper = '',
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <label
            htmlFor={htmlFor}
            className="text-xs sm:text-[13px] font-bold text-ui-ink break-words min-w-0"
          >
            {label}
            {required && <span className="text-status-error ml-0.5">*</span>}
          </label>
          {optional && (
            <span className="text-[11px] font-semibold text-ui-ink-muted shrink-0">Optional</span>
          )}
        </div>
      )}
      <div className="min-w-0">{children}</div>
      {error ? (
        <p
          role="alert"
          className="m-0 text-xs text-status-error font-bold flex items-start gap-1.5 break-words min-w-0"
        >
          <Icon name="alert-circle" size={13} className="shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      ) : helper ? (
        <p className="m-0 text-[11.5px] text-ui-ink-muted leading-snug break-words min-w-0">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
