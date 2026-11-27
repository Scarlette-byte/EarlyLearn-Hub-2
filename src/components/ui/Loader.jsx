import { lazy, Suspense, useEffect, useState } from 'react';

const Lottie = lazy(() => import('lottie-react'));

const SIZE_MAP = {
  sm: 'w-8 h-5',
  md: 'w-14 h-9',
  lg: 'w-20 h-12',
};

function StaticDotsFallback({ size = 'md' }) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className={`${dotSize} rounded-full bg-[#78BD58]`} />
      <span className={`${dotSize} rounded-full bg-[#D96B3B]`} />
      <span className={`${dotSize} rounded-full bg-[#1E3F2B]`} />
    </span>
  );
}

/**
 * Shared three-bouncing-dots Lottie Loader.
 * Lazy-loads lottie-react + local JSON; respects prefers-reduced-motion.
 */
export default function Loader({ size = 'md', label, className = '' }) {
  const [animationData, setAnimationData] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    let mounted = true;
    import('../../assets/lottie/loader-dots.json')
      .then((mod) => {
        if (mounted) setAnimationData(mod.default || mod);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <div className={`relative overflow-hidden flex items-center justify-center ${SIZE_MAP[size] || SIZE_MAP.md}`}>
        {reducedMotion || !animationData ? (
          <StaticDotsFallback size={size} />
        ) : (
          <Suspense fallback={<StaticDotsFallback size={size} />}>
            <Lottie
              animationData={animationData}
              loop
              autoplay
              className="w-[180%] h-[180%] shrink-0"
            />
          </Suspense>
        )}
      </div>
      {label && (
        <span className="text-xs font-semibold text-ui-ink-muted">{label}</span>
      )}
    </div>
  );
}
