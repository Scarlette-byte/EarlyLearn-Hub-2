import Icon from '../Icons.jsx';

/**
 * Shared PageHeader / SectionHeader with optional badge, icon, subtitle, and right-side actions.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  badge,
  actions,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-ui-border min-w-0 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <div className="w-10 h-10 rounded-2xl bg-brand-leaf-tint border border-brand-leaf/30 text-brand-leaf-deep flex items-center justify-center shrink-0 mt-0.5">
            {typeof icon === 'string' ? <Icon name={icon} size={20} /> : icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-brand-leaf-deep mb-0.5 truncate">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="font-baloo text-xl sm:text-2xl font-extrabold text-ui-ink m-0 leading-tight break-words">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-ui-ink-secondary m-0 mt-1 leading-relaxed break-words">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  );
}
