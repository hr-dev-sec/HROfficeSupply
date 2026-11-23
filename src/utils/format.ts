import type { UserRole, WorkflowStage } from '../types';

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTHS_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatNumber(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('id-ID');
}

export function formatDateIndo(isoOrDate: string, lang: 'id' | 'en' = 'id'): string {
  if (!isoOrDate) return '-';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = (lang === 'en' ? MONTHS_EN : MONTHS_ID)[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTimeIndo(iso: string, lang: 'id' | 'en' = 'id'): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = (lang === 'en' ? MONTHS_SHORT_EN : MONTHS_SHORT_ID)[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

export function formatPeriodShort(period: string, lang: 'id' | 'en' = 'id'): string {
  // '2026-09' -> 'Sep-26'
  const [y, m] = period.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11 || !y) return period;
  return `${(lang === 'en' ? MONTHS_SHORT_EN : MONTHS_SHORT_ID)[idx]}-${y.slice(-2)}`;
}

export function formatPeriodLong(period: string, lang: 'id' | 'en' = 'id'): string {
  // '2026-09' -> 'September 2026'
  const [y, m] = period.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11 || !y) return period;
  return `${(lang === 'en' ? MONTHS_EN : MONTHS_ID)[idx]} ${y}`;
}

export function getNextPeriod(period: string): string {
  const [yStr, mStr] = period.split('-');
  let y = Number(yStr);
  let m = Number(mStr) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getPrevPeriod(period: string): string {
  const [yStr, mStr] = period.split('-');
  let y = Number(yStr);
  let m = Number(mStr) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'STAFF':
      return 'Staff / PIC';
    case 'SECTION_MANAGER':
      return 'Section Manager';
    case 'DEPT_MANAGER':
      return 'Department Manager';
  }
}

export function getStageLabel(stage: WorkflowStage, lang: 'id' | 'en' = 'id'): string {
  switch (stage) {
    case 'DRAFT':
      return 'Draft';
    case 'DILAPORKAN':
      return lang === 'en' ? 'Reported' : 'Dilaporkan';
    case 'DICHECK':
      return lang === 'en' ? 'Checked' : 'Dicheck';
    case 'MENGETAHUI':
      return lang === 'en' ? 'Acknowledged' : 'Mengetahui';
    case 'FINAL':
      return 'Final';
  }
}

export function computeDocHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `SHA256-${hex1}-${hex2}`;
}

export function createDemoSignatureSvg(name: string, color = '#111827'): string {
  const safeName = name.replace(/[<>&'"]/g, '');
  const initials = safeName
    .split(' ')
    .map((p) => p[0] || '')
    .join('')
    .slice(0, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="90" viewBox="0 0 240 90">
    <path d="M24 62 C36 24, 52 16, 48 58 C46 72, 68 30, 82 34 C94 38, 78 66, 98 56 C116 48, 128 28, 138 48 C144 60, 158 34, 174 44 C188 52, 202 38, 218 46" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M36 69 Q120 61 206 66" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.72"/>
    <text x="172" y="25" font-family="Georgia, serif" font-style="italic" font-size="11" fill="${color}" opacity="0.65">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
