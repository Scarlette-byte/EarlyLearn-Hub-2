/**
 * Shared Skeleton placeholder for loading cards, metrics, and table rows.
 * Respects prefers-reduced-motion via .animate-skeleton in index.css.
 */
export default function Skeleton({ className = 'h-4 w-full', rounded = 'rounded-lg' }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-ui-surface-warm border border-ui-border/60 animate-skeleton ${rounded} ${className}`}
    />
  );
}

export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-ui-surface rounded-ui-card p-4 sm:p-5 border border-ui-border shadow-card space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-8 w-8" rounded="rounded-xl" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
