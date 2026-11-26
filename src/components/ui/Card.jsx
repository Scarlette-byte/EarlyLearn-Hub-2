import Icon from '../Icons.jsx';

/**
 * Shared Card surface matching Login's warm cream & crisp border system.
 * Includes min-w-0 and break-words overflow safety.
 */
export default function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  footer,
  variant = 'default', // 'default' | 'subtle' | 'warm' | 'playful'
  padding = 'md', // 'none' | 'sm' | 'md' | 'lg'
  accentBar = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  ...props
}) {
  const variants = {
    default: 'bg-ui-surface border border-ui-border rounded-ui-card shadow-card',
    subtle: 'bg-ui-surface-subtle border border-ui-border rounded-ui-card',
    warm: 'bg-ui-surface-warm/70 border border-ui-border rounded-ui-card',
    playful: 'bg-ui-surface border-2 border-ui-border rounded-play-card shadow-play-card',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <section
      className={`relative overflow-hidden min-w-0 break-words ${variants[variant] || variants.default} ${
        paddings[padding] ?? paddings.md
      } ${className}`}
      {...props}
    >
      {accentBar && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-leaf-deep via-brand-yellow to-brand-coral"
        />
      )}

      {(title || subtitle || action) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 min-w-0 ${
            padding === 'none' ? 'px-5 pt-5 sm:px-6 sm:pt-6' : ''
          } ${headerClassName}`}
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {icon && (
              <span className="w-8 h-8 rounded-xl bg-brand-leaf-tint border border-brand-leaf/25 text-brand-leaf-deep flex items-center justify-center shrink-0 mt-0.5">
                {typeof icon === 'string' ? <Icon name={icon} size={17} /> : icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="font-baloo text-base sm:text-lg font-extrabold text-ui-ink m-0 leading-snug break-words">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-ui-ink-muted m-0 mt-0.5 leading-relaxed break-words">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0 flex items-center gap-2 flex-wrap">{action}</div>}
        </div>
      )}

      <div className={`min-w-0 break-words ${bodyClassName}`}>{children}</div>

      {footer && (
        <div
          className={`mt-4 pt-3.5 border-t border-ui-border flex items-center justify-between gap-3 flex-wrap min-w-0 ${
            padding === 'none' ? 'px-5 pb-4 sm:px-6' : ''
          }`}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
