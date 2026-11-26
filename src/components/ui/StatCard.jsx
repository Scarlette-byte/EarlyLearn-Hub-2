import Icon from '../Icons.jsx';

/**
 * Shared StatCard for KPI metrics across Admin, Teacher, and Student views.
 * Includes overflow safety and optional click action.
 */
export default function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'leaf', // 'leaf' | 'gold' | 'coral' | 'info' | 'panel'
  onClick,
  className = '',
}) {
  const tones = {
    leaf: {
      iconWrap: 'bg-brand-leaf-tint text-brand-leaf-deep border-brand-leaf/30',
      bar: 'bg-brand-leaf-deep',
    },
    gold: {
      iconWrap: 'bg-brand-yellow-tint text-brand-yellow-deep border-brand-yellow/50',
      bar: 'bg-brand-yellow',
    },
    coral: {
      iconWrap: 'bg-brand-coral-tint text-brand-coral-deep border-brand-coral/35',
      bar: 'bg-brand-coral',
    },
    info: {
      iconWrap: 'bg-status-info-bg text-status-info border-status-info-border',
      bar: 'bg-status-info',
    },
    panel: {
      iconWrap: 'bg-ui-surface-warm text-ui-panel border-ui-border-strong',
      bar: 'bg-ui-panel',
    },
  };

  const t = tones[tone] || tones.leaf;
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative text-left bg-ui-surface rounded-ui-card p-4 sm:p-5 border border-ui-border shadow-card min-w-0 overflow-hidden transition-all ${
        onClick
          ? 'cursor-pointer hover:border-brand-leaf/60 hover:shadow-card-hover active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      <div aria-hidden="true" className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${t.bar}`} />
      <div className="flex items-start justify-between gap-3 min-w-0 pl-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-ui-ink-muted leading-snug break-words">
            {label}
          </div>
          <div className="font-baloo text-2xl sm:text-[28px] font-extrabold text-ui-ink leading-tight mt-1 truncate">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] font-semibold text-ui-ink-secondary mt-1 break-words">
              {sublabel}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${t.iconWrap}`}
          >
            {typeof icon === 'string' ? <Icon name={icon} size={19} /> : icon}
          </div>
        )}
      </div>
    </Comp>
  );
}
