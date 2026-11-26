import Icon from '../Icons.jsx';

/**
 * Shared Button component matching Login's MSWDO/ECCD design system.
 * Includes press feedback, focus-visible ring, loading spinner, and text-overflow safety.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-nunito font-bold rounded-ui-btn transition-all duration-150 cursor-pointer select-none active:scale-[0.985] disabled:opacity-55 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus focus-visible:ring-offset-1 min-w-0 max-w-full';

  const variants = {
    primary:
      'bg-brand-leaf-deep hover:bg-brand-leaf-hover text-white border border-transparent shadow-xs hover:shadow-sm',
    secondary:
      'bg-ui-surface hover:bg-ui-surface-subtle text-ui-ink border border-ui-border hover:border-ui-border-strong shadow-2xs',
    accent:
      'bg-brand-yellow hover:bg-[#F5C533] text-ui-ink border border-brand-yellow-deep/20 shadow-xs',
    coral:
      'bg-brand-coral-deep hover:bg-[#AE2D32] text-white border border-transparent shadow-xs',
    danger:
      'bg-status-error hover:bg-[#911C13] text-white border border-transparent shadow-xs',
    dangerSoft:
      'bg-status-error-bg hover:bg-[#FEE4E2] text-status-error border border-status-error-border',
    ghost:
      'bg-transparent hover:bg-ui-surface-warm text-ui-ink-secondary hover:text-ui-ink border border-transparent',
    playful:
      'bg-brand-leaf-deep hover:bg-brand-leaf-hover text-white border border-transparent rounded-play-btn shadow-bump active:shadow-bump-active active:translate-y-0.5 font-baloo tracking-wide',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs min-h-[30px]',
    sm: 'px-3 py-1.5 text-xs min-h-[34px]',
    md: 'px-4 py-2 text-xs sm:text-sm min-h-[38px]',
    lg: 'px-5 py-2.5 text-sm sm:text-base min-h-[44px]',
  };

  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Icon name="loader" size={iconSize} className="animate-spin shrink-0" />
      ) : icon ? (
        typeof icon === 'string' ? (
          <Icon name={icon} size={iconSize} className="shrink-0" />
        ) : (
          <span className="shrink-0 inline-flex">{icon}</span>
        )
      ) : null}
      <span className="truncate">{children}</span>
      {!loading &&
        iconRight &&
        (typeof iconRight === 'string' ? (
          <Icon name={iconRight} size={iconSize} className="shrink-0" />
        ) : (
          <span className="shrink-0 inline-flex">{iconRight}</span>
        ))}
    </button>
  );
}
