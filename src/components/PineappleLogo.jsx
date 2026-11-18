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
    <svg
      viewBox="0 0 80 88"
      width={size}
      height={Math.round((size * 88) / 80)}
      className={`shrink-0 overflow-visible ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="EarlyLearn Hub Pineapple Icon"
    >
      <defs>
        <clipPath id="bodyClipInner">
          <rect x="18" y="30" width="44" height="48" rx="20" ry="22" />
        </clipPath>
      </defs>

      {/* Red Accent Vibe Arcs (top right of crown) */}
      <path
        d="M 58 13 C 62 16 64 20 64 25"
        stroke="#F46D70"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M 66 10 C 70 14 72 20 72 27"
        stroke="#F46D70"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Crown Leaves (Leaf Green #78BD58) */}
      {/* Back leaves for depth */}
      <path
        d="M 33 30 C 23 20 20 10 27 6 C 33 9 37 20 38 30 Z"
        fill="#66A548"
      />
      <path
        d="M 47 30 C 57 20 60 10 53 6 C 47 9 43 20 42 30 Z"
        fill="#66A548"
      />

      {/* Main Center Tall Leaf */}
      <path
        d="M 32 32 C 29 17 34 3 40 2 C 46 3 51 17 48 32 Z"
        fill="#78BD58"
      />
      <path
        d="M 40 5 Q 40 18 40 32"
        stroke="#95D875"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Left Flaring Leaf */}
      <path
        d="M 35 32 C 23 26 13 15 17 9 C 23 8 30 19 37 30 Z"
        fill="#78BD58"
      />
      {/* Right Flaring Leaf */}
      <path
        d="M 45 32 C 57 26 67 15 63 9 C 57 8 50 19 43 30 Z"
        fill="#78BD58"
      />

      {/* Pineapple Yellow Body (#FFD34E) */}
      <rect x="18" y="30" width="44" height="48" rx="20" ry="22" fill="#FFD34E" />

      {/* Diamond Lattice Texture (#DEA71E) clipped inside body */}
      <g clipPath="url(#bodyClipInner)" stroke="#DEA71E" strokeWidth="2.2" strokeLinecap="round" opacity="0.95">
        {/* Diagonals \ */}
        <line x1="6" y1="18" x2="62" y2="66" />
        <line x1="6" y1="32" x2="62" y2="80" />
        <line x1="20" y1="18" x2="76" y2="66" />
        <line x1="-8" y1="18" x2="48" y2="66" />
        <line x1="34" y1="18" x2="90" y2="66" />

        {/* Diagonals / */}
        <line x1="74" y1="18" x2="18" y2="66" />
        <line x1="88" y1="32" x2="32" y2="80" />
        <line x1="60" y1="18" x2="4" y2="66" />
        <line x1="46" y1="18" x2="-10" y2="66" />
        <line x1="102" y1="18" x2="46" y2="66" />
      </g>

      {/* Upper-left Shine Highlight */}
      <ellipse cx="29" cy="42" rx="4" ry="2.5" fill="#FFFBEA" opacity="0.65" />
    </svg>
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
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-2.5 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      >
        <div className="shrink-0 transition-transform group-hover:scale-105">
          <PineappleIcon size={resolvedIconSize} />
        </div>
        <div className="text-left leading-none min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={`font-baloo font-extrabold tracking-tight ${
                theme === 'dark' ? 'text-white' : 'text-[#F46D70]'
              }`}
              style={{
                fontSize:
                  resolvedIconSize <= 36 ? '16px' : resolvedIconSize <= 48 ? '19px' : '23px',
              }}
            >
              EarlyLearn
            </span>
            <span
              className={`font-baloo font-black tracking-wider uppercase ${
                theme === 'dark' ? 'text-[#FFD34E]' : 'text-[#78BD58]'
              }`}
              style={{
                fontSize:
                  resolvedIconSize <= 36 ? '13px' : resolvedIconSize <= 48 ? '15px' : '17px',
              }}
            >
              &gt;Hub&lt;
            </span>
          </div>
          {subtitle && (
            <div
              className={`font-bold uppercase tracking-wider text-[10px] mt-0.5 truncate ${
                theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
              }`}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vertical variant (e.g. Login, SignUp, Card headers)
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center text-center ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      <div className="mb-2 shrink-0 transition-transform group-hover:scale-105">
        <PineappleIcon size={resolvedIconSize} />
      </div>
      <div className="leading-tight">
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
        <span
          className={`text-xs font-semibold mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-[#7A748A]'
          }`}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

