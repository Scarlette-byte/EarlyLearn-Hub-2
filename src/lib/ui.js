// Shared className tokens for MSWDO Admin & Teacher dashboards,
// aligned directly with Login.jsx's Civic Forest + Warm Cream + Pineapple palette.

export const cardBox =
  'bg-ui-surface rounded-ui-card p-5 sm:p-6 border border-ui-border shadow-card mb-5 min-w-0 break-words';

export const cardBoxTitle =
  'm-0 mb-4 font-baloo text-base sm:text-lg font-extrabold text-ui-ink tracking-tight flex items-center gap-2 min-w-0 break-words';

export const table = 'w-full border-collapse text-left text-sm min-w-0';

export const th =
  'text-left text-[11px] font-extrabold text-ui-ink-secondary bg-ui-surface-subtle uppercase tracking-wider px-4 py-3 border-b border-ui-border whitespace-nowrap';

export const td =
  'px-4 py-3 text-xs sm:text-sm border-b border-ui-border/70 text-ui-ink align-middle break-words min-w-0';

export function pillClass(kind) {
  const map = {
    superadmin: 'bg-brand-yellow-tint text-brand-yellow-deep border border-brand-yellow/60',
    admin: 'bg-brand-yellow-tint text-brand-yellow-deep border border-brand-yellow/60',
    teacher: 'bg-brand-leaf-tint text-brand-leaf-deep border border-brand-leaf/35',
    cdt: 'bg-brand-leaf-tint text-brand-leaf-deep border border-brand-leaf/35',
    student: 'bg-status-info-bg text-status-info border border-status-info-border',
    aide: 'bg-status-info-bg text-status-info border border-status-info-border',
    submitted: 'bg-status-warn-bg text-status-warn border border-status-warn-border',
    pending: 'bg-status-warn-bg text-status-warn border border-status-warn-border',
    checked: 'bg-status-ok-bg text-status-ok border border-status-ok-border',
    approved: 'bg-status-ok-bg text-status-ok border border-status-ok-border',
    rejected: 'bg-status-error-bg text-status-error border border-status-error-border',
  };
  return `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-normal truncate max-w-full ${
    map[kind] || 'bg-ui-surface-warm text-ui-ink-secondary border border-ui-border'
  }`;
}

export const msgOk =
  'text-xs sm:text-sm mt-2.5 font-bold text-status-ok bg-status-ok-bg border border-status-ok-border px-3.5 py-2.5 rounded-ui-input flex items-center gap-2 break-words';

export const msgError =
  'text-xs sm:text-sm mt-2.5 font-bold text-status-error bg-status-error-bg border border-status-error-border px-3.5 py-2.5 rounded-ui-input flex items-center gap-2 break-words';

export const input =
  'px-3.5 py-2.5 rounded-ui-input border border-ui-border hover:border-ui-border-strong font-nunito text-sm text-ui-ink bg-ui-surface-subtle focus:bg-ui-surface w-full min-w-0 outline-none transition-all focus-visible:border-ui-focus focus-visible:shadow-focus-ring placeholder:text-ui-ink-muted/75';

export const label = 'block text-xs sm:text-[13px] font-bold text-ui-ink mt-3 mb-1.5 break-words';

export const btnAdd =
  'px-4 py-2.5 border border-transparent rounded-ui-btn bg-brand-leaf-deep text-white font-nunito font-bold cursor-pointer text-xs sm:text-sm hover:bg-brand-leaf-hover active:scale-[0.985] transition-all disabled:opacity-55 shadow-xs inline-flex items-center justify-center gap-1.5 min-w-0';

export const btnPrimary =
  'mt-4 px-5 py-2.5 border border-transparent rounded-ui-btn bg-brand-leaf-deep text-white font-nunito font-bold cursor-pointer text-sm hover:bg-brand-leaf-hover active:scale-[0.985] transition-all disabled:opacity-55 shadow-xs inline-flex items-center justify-center gap-1.5 min-w-0';

export const btnSmall =
  'px-3 py-1.5 border border-ui-border hover:border-ui-border-strong rounded-ui-btn bg-ui-surface text-ui-ink font-nunito font-bold cursor-pointer text-xs hover:bg-ui-surface-subtle transition-all shadow-2xs inline-flex items-center gap-1 min-w-0';

export const delBtn =
  'border border-transparent bg-transparent text-ui-ink-muted cursor-pointer text-xs hover:text-status-error hover:bg-status-error-bg rounded-lg transition-colors p-1.5';

export const ageTag =
  'inline-flex items-center text-[11px] bg-ui-surface-warm text-ui-ink-secondary border border-ui-border px-2 py-0.5 rounded-full font-bold ml-1.5';
