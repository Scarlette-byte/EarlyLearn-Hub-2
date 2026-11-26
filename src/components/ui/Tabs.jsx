import Icon from '../Icons.jsx';

/**
 * Shared Tabs switcher (pill or underline style) with keyboard focus rings,
 * optional count badges, icons, and horizontal scroll safety on mobile (360px).
 */
export default function Tabs({
  tabs = [], // [{ key, label, icon, count, badgeVariant }]
  activeKey,
  onChange,
  variant = 'pills', // 'pills' | 'underline' | 'playful'
  className = '',
  ariaLabel = 'Section tabs',
}) {
  const isUnderline = variant === 'underline';
  const isPlayful = variant === 'playful';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1.5 overflow-x-auto max-w-full min-w-0 ${
        isUnderline
          ? 'border-b border-ui-border pb-px'
          : isPlayful
            ? 'p-1.5 rounded-full bg-ui-surface-warm border border-ui-border'
            : 'p-1 rounded-2xl bg-ui-surface-warm border border-ui-border w-fit'
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center justify-center gap-1.5 font-nunito font-extrabold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus ${
              isUnderline
                ? `px-3.5 py-2.5 border-b-2 -mb-px rounded-t-lg ${
                    isActive
                      ? 'border-brand-leaf-deep text-brand-leaf-deep bg-brand-leaf-tint/40'
                      : 'border-transparent text-ui-ink-muted hover:text-ui-ink hover:bg-ui-surface-subtle'
                  }`
                : isPlayful
                  ? `flex-1 px-4 py-2 rounded-full text-xs sm:text-sm font-baloo ${
                      isActive
                        ? 'bg-brand-leaf-deep text-white shadow-xs'
                        : 'text-ui-ink-secondary hover:text-ui-ink hover:bg-ui-surface/70'
                    }`
                  : `px-3.5 py-2 rounded-xl ${
                      isActive
                        ? 'bg-ui-surface text-brand-leaf-deep shadow-xs border border-ui-border/80'
                        : 'bg-transparent text-ui-ink-secondary hover:text-ui-ink hover:bg-ui-surface/50 border border-transparent'
                    }`
            }`}
          >
            {tab.icon &&
              (typeof tab.icon === 'string' ? (
                <Icon name={tab.icon} size={15} className="shrink-0" />
              ) : (
                <span className="shrink-0 inline-flex">{tab.icon}</span>
              ))}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-extrabold leading-none ${
                  isActive
                    ? isPlayful
                      ? 'bg-white/20 text-white'
                      : 'bg-brand-leaf-tint text-brand-leaf-deep'
                    : 'bg-ui-surface text-ui-ink-muted border border-ui-border'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
