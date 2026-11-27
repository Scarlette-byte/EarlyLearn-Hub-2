import Icon from '../Icons.jsx';

/**
 * Shared Peach-to-Terracotta Hero Banner Card for all dashboards.
 */
export default function HeroBanner({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  icon = 'sparkles',
  className = '',
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#F4A27E] via-[#E8845C] to-[#D66A43] text-white p-6 sm:p-8 shadow-[0_14px_34px_rgba(214,106,67,0.22)] ${className}`}
    >
      {/* Subtle organic blob & leaf decorations behind content */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-[#1E3F2B]/15 blur-2xl" aria-hidden="true" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 min-w-0">
        <div className="space-y-2 max-w-2xl min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-extrabold uppercase tracking-wider text-white">
              <Icon name={icon} size={14} />
              <span>{eyebrow}</span>
            </div>
          )}
          <h2 className="font-baloo text-2xl sm:text-3xl font-extrabold leading-tight text-white m-0 break-words">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-white/90 leading-relaxed m-0 max-w-xl">
              {subtitle}
            </p>
          )}
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="px-5 py-2.5 rounded-full bg-[#1E3F2B] hover:bg-[#163020] text-white font-baloo font-bold text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer inline-flex items-center gap-2"
              >
                {primaryAction.icon && <Icon name={primaryAction.icon} size={16} />}
                <span>{primaryAction.label}</span>
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/35 font-baloo font-bold text-sm backdrop-blur-xs transition-all active:scale-[0.98] cursor-pointer inline-flex items-center gap-2"
              >
                {secondaryAction.icon && <Icon name={secondaryAction.icon} size={16} />}
                <span>{secondaryAction.label}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
