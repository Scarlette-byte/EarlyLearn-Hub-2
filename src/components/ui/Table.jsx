/**
 * Shared responsive Table wrapper with consistent header/row styling and overflow protection.
 */
export default function Table({ columns = [], data = [], emptyMessage = 'No records found.', keyField = 'id' }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#ece6da] bg-white">
      <table className="w-full text-left border-collapse min-w-0">
        <thead>
          <tr className="bg-[#faf8f4] border-b border-[#ece6da]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#6e6450] ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2ede3] text-sm text-[#2b261c]">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1} className="px-4 py-8 text-center text-xs text-[#8a7f66]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row[keyField] ?? idx} className="hover:bg-[#fcfaf6] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-3.5 py-2.5 align-top break-words min-w-0 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
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
