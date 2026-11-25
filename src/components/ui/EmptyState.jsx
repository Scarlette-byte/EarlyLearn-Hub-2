/**
 * Shared EmptyState component for tables, lists, and dashboard sections.
 */
export default function EmptyState({ icon = '📭', title = 'Nothing here yet', description = '', action = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-[#dfd7c8] bg-[#faf8f4]/60 min-w-0">
      <div className="text-3xl mb-2 select-none">{icon}</div>
      <div className="text-sm font-bold text-[#2b261c] break-words">{title}</div>
      {description && (
        <p className="text-xs text-[#7c725e] mt-1 max-w-md break-words m-0">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
