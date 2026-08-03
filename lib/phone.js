// Collapses different formatting of the same Brazilian number (with/without
// dashes, spaces, leading 0, country code) into one canonical digit string,
// so records that reference "the same phone" (e.g. across duplicate/
// reimported contacts) can be matched reliably.
export function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return '55' + digits;
}
