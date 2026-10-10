// Shared className strings so the Admin & Teacher dashboards render
// the same "card / table / pill" look the original CSS defined once.

export const cardBox = 'bg-white rounded-2xl p-6 shadow-card mb-5';

export const cardBoxTitle = 'm-0 mb-4 font-fraunces text-[17px] font-bold text-dash-ink';

export const table = 'w-full border-collapse';

export const th =
  'text-left text-[11.5px] font-bold text-[#8C7F63] uppercase tracking-wider px-4 py-3 border-b border-card-border whitespace-nowrap';

export const td = 'px-4 py-3 text-[15px] border-b border-[#F6F1E7] text-[#3B3324]';

export function pillClass(kind) {
  const map = {
    superadmin: 'bg-[#EDE4FF] text-[#5A2E9E] border border-[#D5C2F8]',
    admin: 'bg-[#F6E4C2] text-[#8A6420]',
    teacher: 'bg-[#DCEBDD] text-[#3D7048]',
    student: 'bg-[#DCE8F2] text-[#386B93]',
    submitted: 'bg-[#F6E4C2] text-[#8A6420]',
    checked: 'bg-[#DCEBDD] text-[#3D7048]',
  };
  return `inline-block px-3 py-[3px] rounded-full text-[10.5px] font-extrabold tracking-wide ${
    map[kind] || 'bg-[#DCEBDD] text-[#3D7048]'
  }`;
}

export const msgOk = 'text-[13px] mt-2.5 font-semibold text-[#3D7048]';
export const msgError = 'text-[13px] mt-2.5 font-semibold text-danger';

export const input =
  'px-3 py-2.5 rounded-[10px] border-[1.5px] border-[#E5DCC9] font-nunito text-[13px] text-dash-ink bg-[#FFFDF8] w-full outline-none focus:border-accent';

export const label = 'block text-[12.5px] font-bold text-dash-ink mt-3 mb-1.5';

export const btnAdd =
  'px-5 py-2.5 border-none rounded-[10px] bg-accent text-white font-bold cursor-pointer text-[13px] hover:opacity-90 disabled:opacity-60';

export const btnPrimary =
  'mt-4 px-[22px] py-[11px] border-none rounded-[10px] bg-accent text-white font-bold cursor-pointer text-sm hover:opacity-90 disabled:opacity-60';

export const btnSmall =
  'px-3 py-[5px] border-none rounded-lg bg-[#DCEBDD] text-[#3D7048] font-bold cursor-pointer text-[11.5px] hover:opacity-85';

export const delBtn = 'border-none bg-transparent text-[#ccc] cursor-pointer text-[13px] hover:text-danger';

export const ageTag =
  'inline-block text-[10px] bg-[#EEF2F6] text-[#445] px-[9px] py-0.5 rounded-lg ml-1.5 font-bold';
