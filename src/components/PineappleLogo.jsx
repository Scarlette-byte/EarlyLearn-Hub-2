import React from 'react';

/**
 * Official EarlyLearn Hub Brand Pineapple Logo Component
 *
 * Official Brand Colors:
 * - Leaf Green:       #78BD58
 * - Pineapple Yellow: #FFD34E
 * - Coral Red:        #F46D70
 * - Cream:            #FFFBEA
 * - White:            #FFFFFF
 */

export function PineappleIcon({ size = 44, className = '' }) {
  return (
    <img
      src="/earlylearn-hub-logo.png"
      alt="EarlyLearn Hub Pineapple Icon"
      width={size}
      height={size}
      className={`shrink-0 object-contain rounded-xl ${className}`}
    />
  );
}

export default function PineappleLogo({
  variant = 'vertical', // 'vertical' | 'horizontal' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl' | number
  theme = 'light', // 'light' | 'dark'
  subtitle = '',
  className = '',
  showText = true,
  onClick,
}) {
  // Resolve numeric size for the pineapple icon
  const iconSizes = {
    sm: 32,
    md: 44,
    lg: 60,
    xl: 76,
  };
  const resolvedIconSize = typeof size === 'number' ? size : iconSizes[size] || 44;

  if (variant === 'icon' || !showText) {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <PineappleIcon size={resolvedIconSize} />
      </div>
    );
  }

  // Horizontal variant (e.g. Sidebars, Navbars)
  if (variant === 'horizontal') {
    const isTwoPartString = typeof subtitle === 'string' && subtitle.includes('•');
    const subtitlePart1 = isTwoPartString ? subtitle.split('•')[0].trim() : '';
    const subtitlePart2 = isTwoPartString ? subtitle.split('•').slice(1).join('•').trim() : '';

    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-2.5 min-w-0 max-w-full overflow-hidden ${
          onClick ? 'cursor-pointer group' : ''
        } ${className}`}
      >
        <div className="shrink-0 transition-transform group-hover:scale-105">
          <PineappleIcon size={resolvedIconSize} />
        </div>
        <div className="text-left leading-tight min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={`font-baloo font-extrabold tracking-tight whitespace-nowrap ${
                theme === 'dark' ? 'text-white' : 'text-[#F46D70]'
              }`}
              style={{
                fontSize:
                  resolvedIconSize <= 32 ? '15px' : resolvedIconSize <= 36 ? '16px' : resolvedIconSize <= 48 ? '19px' : '23px',
              }}
            >
              EarlyLearn
            </span>
            <span
              className={`font-baloo font-black tracking-wider uppercase whitespace-nowrap ${
                theme === 'dark' ? 'text-[#FFD34E]' : 'text-[#78BD58]'
              }`}
              style={{
                fontSize:
                  resolvedIconSize <= 32 ? '12px' : resolvedIconSize <= 36 ? '13px' : resolvedIconSize <= 48 ? '15px' : '17px',
              }}
            >
              &gt;Hub&lt;
            </span>
          </div>
          {subtitle && (
            <div
              title={typeof subtitle === 'string' ? subtitle : undefined}
              className="min-w-0 max-w-full overflow-hidden"
            >
              {isTwoPartString ? (
                <div className="leading-tight mt-0.5 min-w-0">
                  <div
                    className={`font-bold uppercase tracking-wider text-[10px] truncate ${
                      theme === 'dark' ? 'text-amber-400/90' : 'text-[#F46D70]'
                    }`}
                  >
                    {subtitlePart1}
                  </div>
                  <div
                    className={`font-bold uppercase tracking-wider text-[9px] truncate ${
                      theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
                    }`}
                  >
                    {subtitlePart2}
                  </div>
                </div>
              ) : typeof subtitle === 'string' ? (
                <div
                  className={`font-bold uppercase tracking-wider text-[10px] mt-0.5 truncate ${
                    theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
                  }`}
                >
                  {subtitle}
                </div>
              ) : (
                subtitle
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vertical variant (e.g. Login, SignUp, Card headers, Parent Dashboard sidebar)
  const isTwoPartString = typeof subtitle === 'string' && subtitle.includes('•');
  const subtitlePart1 = isTwoPartString ? subtitle.split('•')[0].trim() : '';
  const subtitlePart2 = isTwoPartString ? subtitle.split('•').slice(1).join('•').trim() : '';

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center text-center w-full max-w-full overflow-hidden ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      <div className="mb-2 shrink-0 transition-transform group-hover:scale-105">
        <PineappleIcon size={resolvedIconSize} />
      </div>
      <div className="leading-tight min-w-0">
        <span
          className={`block font-baloo font-extrabold tracking-tight ${
            theme === 'dark' ? 'text-white' : 'text-[#F46D70]'
          }`}
          style={{
            fontSize:
              resolvedIconSize <= 44 ? '20px' : resolvedIconSize <= 64 ? '24px' : '28px',
          }}
        >
          EarlyLearn
        </span>
        <span
          className={`block font-baloo font-black tracking-wider uppercase -mt-0.5 ${
            theme === 'dark' ? 'text-[#FFD34E]' : 'text-[#78BD58]'
          }`}
          style={{
            fontSize:
              resolvedIconSize <= 44 ? '14px' : resolvedIconSize <= 64 ? '17px' : '20px',
          }}
        >
          &gt;Hub&lt;
        </span>
      </div>
      {subtitle && (
        <div
          title={typeof subtitle === 'string' ? subtitle : undefined}
          className="mt-1 leading-tight min-w-0 max-w-full px-2"
        >
          {isTwoPartString ? (
            <>
              <div
                className={`font-bold uppercase tracking-wider text-[11px] truncate ${
                  theme === 'dark' ? 'text-amber-400/90' : 'text-[#F46D70]'
                }`}
              >
                {subtitlePart1}
              </div>
              <div
                className={`font-bold uppercase tracking-wider text-[10px] mt-0.5 truncate ${
                  theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
                }`}
              >
                {subtitlePart2}
              </div>
            </>
          ) : typeof subtitle === 'string' ? (
            <span
              className={`text-xs font-semibold block truncate ${
                theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
              }`}
            >
              {subtitle}
            </span>
          ) : (
            subtitle
          )}
        </div>
      )}
    </div>
  );
}

