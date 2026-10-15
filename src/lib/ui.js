// Shared className strings for MSWD Admin & Teacher dashboards:
// Clean, professional, human-designed government portal styling (non-AI generic look).

export const cardBox = 'bg-white rounded-xl p-5 sm:p-6 border border-[#E2E8F0] shadow-xs mb-5';

export const cardBoxTitle = 'm-0 mb-4 text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2';

export const table = 'w-full border-collapse text-left text-sm';

export const th =
  'text-left text-xs font-semibold text-slate-700 bg-slate-50 uppercase tracking-wider px-4 py-3 border-b border-slate-200 whitespace-nowrap';

export const td = 'px-4 py-3 text-sm border-b border-slate-100 text-slate-800 align-middle';

export function pillClass(kind) {
  const map = {
    superadmin: 'bg-purple-50 text-purple-800 border border-purple-200',
    admin: 'bg-amber-50 text-amber-800 border border-amber-200',
    teacher: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    cdt: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    student: 'bg-sky-50 text-sky-800 border border-sky-200',
    aide: 'bg-blue-50 text-blue-800 border border-blue-200',
    submitted: 'bg-amber-50 text-amber-800 border border-amber-200',
    pending: 'bg-amber-50 text-amber-800 border border-amber-200',
    checked: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    approved: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border border-rose-200',
  };
  return `inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium tracking-normal ${
    map[kind] || 'bg-slate-100 text-slate-700 border border-slate-200'
  }`;
}

export const msgOk = 'text-xs sm:text-sm mt-2 font-medium text-emerald-700 flex items-center gap-1.5';
export const msgError = 'text-xs sm:text-sm mt-2 font-medium text-red-600 flex items-center gap-1.5';

export const input =
  'px-3.5 py-2 rounded-lg border border-slate-300 font-nunito text-sm text-slate-900 bg-white w-full outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 placeholder:text-slate-400';

export const label = 'block text-xs font-semibold text-slate-700 mt-3 mb-1.5';

export const btnAdd =
  'px-4 py-2 border-none rounded-lg bg-slate-900 text-white font-medium cursor-pointer text-xs sm:text-sm hover:bg-slate-800 transition-colors disabled:opacity-60 shadow-xs inline-flex items-center gap-1.5';

export const btnPrimary =
  'mt-4 px-5 py-2.5 border-none rounded-lg bg-slate-900 text-white font-medium cursor-pointer text-sm hover:bg-slate-800 transition-colors disabled:opacity-60 shadow-xs inline-flex items-center justify-center gap-1.5';

export const btnSmall =
  'px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 font-medium cursor-pointer text-xs hover:bg-slate-50 transition-colors shadow-2xs';

export const delBtn = 'border-none bg-transparent text-slate-400 cursor-pointer text-xs hover:text-red-600 transition-colors p-1';

export const ageTag =
  'inline-flex items-center text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold ml-1.5';
