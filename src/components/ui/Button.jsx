/**
 * Shared Button component with consistent variants, sizes, and focus/disabled states.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-400/60 min-w-0';

  const variants = {
    primary: 'bg-[#f4b41a] hover:bg-[#e0a210] text-[#2b261c] border border-transparent shadow-xs',
    secondary: 'bg-white hover:bg-[#faf8f4] text-[#4a4233] border border-[#ddd5c5]',
    danger: 'bg-red-600 hover:bg-red-700 text-white border border-transparent',
    ghost: 'bg-transparent hover:bg-[#f5f0e6] text-[#5c5342] border border-transparent',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
