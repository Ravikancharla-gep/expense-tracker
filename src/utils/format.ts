const enInOptsWhole: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
const enInOptsDecimal: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};
const enUsOptsWhole: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
const enUsOptsDecimal: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

let activeCurrency: 'INR' | 'USD' = 'INR';

export function setActiveCurrency(currency: 'INR' | 'USD'): void {
  activeCurrency = currency;
}

export function getCurrencySymbol(): string {
  return activeCurrency === 'USD' ? '$' : '₹';
}

/** Full Indian-locale rupees for accounting (e.g. ₹1,09,455 or ₹44,879.50) */
export function formatRupeesFull(value: number): string {
  if (!Number.isFinite(value)) return `${getCurrencySymbol()}0`;
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9;
  const opts = activeCurrency === 'USD'
    ? (isWhole ? enUsOptsWhole : enUsOptsDecimal)
    : (isWhole ? enInOptsWhole : enInOptsDecimal);
  const locale = activeCurrency === 'USD' ? 'en-US' : 'en-IN';
  return `${getCurrencySymbol()}${value.toLocaleString(locale, opts)}`;
}

/**
 * Same digit grouping as `formatRupeesFull` but without the ₹ prefix.
 * Use when showing amounts inside inputs (after commit / on blur).
 * Negative values use an ASCII `-` so `parseAmountInput` round-trips reliably (locale can emit U+2212).
 */
export function formatPlainAmountForInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  const neg = value < 0;
  const abs = Math.abs(value);
  const isWhole = Math.abs(abs - Math.round(abs)) < 1e-9;
  const opts = activeCurrency === 'USD'
    ? (isWhole ? enUsOptsWhole : enUsOptsDecimal)
    : (isWhole ? enInOptsWhole : enInOptsDecimal);
  const locale = activeCurrency === 'USD' ? 'en-US' : 'en-IN';
  const formatted = abs.toLocaleString(locale, opts);
  return neg ? `-${formatted}` : formatted;
}

/**
 * Parse a typed or pasted amount (commas, unicode minus/dashes, NBSP).
 */
export function parseAmountInput(raw: string): number | null {
  const s = raw
    .replace(/\u00a0/g, ' ')
    .replace(/,/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .trim();
  if (s === '' || s === '-' || s === '+') return null;
  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}
