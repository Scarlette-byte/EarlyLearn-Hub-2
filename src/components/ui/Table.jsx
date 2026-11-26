import EmptyState from './EmptyState.jsx';
import Skeleton from './Skeleton.jsx';

/**
 * Shared responsive Table wrapper with consistent MSWDO header/row styling,
 * loading skeleton support, empty state, and overflow protection.
 */
export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found.',
  emptyIcon = 'inbox',
  keyField = 'id',
  onRowClick,
  className = '',
}) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-ui-card border border-ui-border bg-ui-surface shadow-2xs min-w-0 ${className}`}
    >
      <table className="w-full text-left border-collapse min-w-0">
        <thead>
          <tr className="bg-ui-surface-subtle border-b border-ui-border">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-ui-ink-secondary whitespace-nowrap ${
                  col.className || ''
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border/70 text-xs sm:text-sm text-ui-ink">
          {loading ? (
            [0, 1, 2, 3].map((rowIdx) => (
              <tr key={rowIdx}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1} className="p-6">
                <EmptyState icon={emptyIcon} title={emptyMessage} />
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row[keyField] ?? idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-brand-leaf-tint/40 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-middle break-words min-w-0 ${
                      col.cellClassName || ''
                    }`}
                  >
                    {col.render ? col.render(row, idx) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
