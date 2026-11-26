import Icon from '../Icons.jsx';

/**
 * Shared WCAG AA status & role Badge with overflow truncation.
 */
export default function Badge({
  children,
  variant = 'neutral',
  icon,
  size = 'sm', // 'xs' | 'sm' | 'md'
  className = '',
}) {
  const variants = {
    neutral: 'bg-ui-surface-warm text-ui-ink-secondary border-ui-border',
    primary: 'bg-brand-leaf-tint text-brand-leaf-deep border-brand-leaf/35',
    success: 'bg-status-ok-bg text-status-ok border-status-ok-border',
    warning: 'bg-status-warn-bg text-status-warn border-status-warn-border',
    danger: 'bg-status-error-bg text-status-error border-status-error-border',
    info: 'bg-status-info-bg text-status-info border-status-info-border',
    gold: 'bg-brand-yellow-tint text-brand-yellow-deep border-brand-yellow/60',
    coral: 'bg-brand-coral-tint text-brand-coral-deep border-brand-coral/40',
    dark: 'bg-ui-panel text-white border-ui-panel-deep',
  };

  const sizes = {
    xs: 'px-2 py-0.5 text-[10.5px]',
    sm: 'px-2.5 py-0.5 text-[11px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold border leading-tight min-w-0 max-w-full ${
        variants[variant] || variants.neutral
      } ${sizes[size] || sizes.sm} ${className}`}
    >
      {icon &&
        (typeof icon === 'string' ? (
          <Icon name={icon} size={12} className="shrink-0" />
        ) : (
          <span className="shrink-0 inline-flex">{icon}</span>
        ))}
      <span className="truncate">{children}</span>
    </span>
  );
}
