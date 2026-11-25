/**
 * Shared FormField wrapper with label, helper/error text, and min-w-0 safety.
 */
export default function FormField({ label, htmlFor, required = false, error = '', helper = '', children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-bold text-[#4a4233] break-words">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-[11px] text-red-600 font-medium break-words">{error}</span>
      ) : helper ? (
        <span className="text-[11px] text-[#8a7f66] break-words">{helper}</span>
      ) : null}
    </div>
  );
}
