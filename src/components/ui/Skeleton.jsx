/**
 * Shared Skeleton primitives using sage/cream theme tokens.
 * Hidden from screen readers (aria-hidden="true") and respects prefers-reduced-motion via .animate-skeleton.
 */
const VARIANT_CLASSES = {
  text: 'h-3.5 w-full rounded-full',
  heading: 'h-6 w-48 rounded-full',
  avatar: 'w-10 h-10 rounded-full shrink-0',
  badge: 'h-6 w-20 rounded-full',
  button: 'h-10 w-32 rounded-full',
  card: 'h-36 w-full rounded-3xl',
  tile: 'h-24 w-full rounded-2xl',
  'list-item': 'h-14 w-full rounded-2xl',
  chart: 'h-56 w-full rounded-3xl',
};

export default function Skeleton({ variant = 'text', className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-skeleton bg-dash-sage/75 border border-ui-border/50 ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.text} ${className}`}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-ui-surface rounded-3xl p-5 border border-ui-border shadow-ui-card space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton variant="text" className="w-24 h-3" />
        <Skeleton variant="avatar" className="w-9 h-9" />
      </div>
      <Skeleton variant="heading" className="w-20 h-7" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }) {
  return (
    <tr aria-hidden="true" className="border-b border-ui-border/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <Skeleton variant="text" className={i === 0 ? 'w-36' : 'w-24'} />
        </td>
      ))}
    </tr>
  );
}

export function DashboardTabSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard content"
      className="space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto"
    >
      <Skeleton variant="card" className="h-40 rounded-[28px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton variant="chart" />
        <Skeleton variant="chart" />
      </div>
    </div>
  );
}
