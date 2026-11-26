import Icon from '../Icons.jsx';

/**
 * Shared EmptyState component for tables, lists, and dashboard sections.
 */
export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  description = '',
  action = null,
  variant = 'default', // 'default' | 'playful'
  className = '',
}) {
  const isPlayful = variant === 'playful';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-7 sm:p-9 border border-dashed min-w-0 ${
        isPlayful
          ? 'rounded-play-card border-play-mint-border bg-play-mint/40'
          : 'rounded-ui-card border-ui-border-strong/70 bg-ui-surface-subtle'
      } ${className}`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 select-none shrink-0 ${
          isPlayful
            ? 'bg-ui-surface border-2 border-play-mint-border text-brand-leaf-deep shadow-xs'
            : 'bg-brand-leaf-tint border border-brand-leaf/25 text-brand-leaf-deep'
        }`}
      >
        {typeof icon === 'string' ? <Icon name={icon} size={22} /> : icon}
      </div>
      <div className="font-baloo text-base font-extrabold text-ui-ink break-words max-w-full">
        {title}
      </div>
      {description && (
        <p className="text-xs sm:text-[13px] text-ui-ink-muted mt-1 max-w-md leading-relaxed break-words m-0">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex items-center justify-center flex-wrap gap-2">{action}</div>}
    </div>
  );
}
