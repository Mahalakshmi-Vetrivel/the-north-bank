// Display helpers. Money is always integer paise; these only format it.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export const money = minor => inr.format((Number(minor) || 0) / 100);

const ist = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
export const time = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : ist.format(date);
};

// Same labels the original portal used for Worker statuses and rejection codes.
export const statusNames = {
  PENDING: 'Pending', PROCESSING: 'Processing', COMPLETED: 'Completed', REJECTED: 'Rejected', MANUAL_REVIEW: 'Manual review',
};
export const statusColors = {
  PENDING: 'warning', PROCESSING: 'warning', COMPLETED: 'success', REJECTED: 'error', MANUAL_REVIEW: 'error',
};
export const rejectionNames = {
  INSUFFICIENT_FUNDS: 'Insufficient available balance',
  LIMIT_EXCEEDED: 'Transfer limit exceeded',
  DESTINATION_ACCOUNT_UNAVAILABLE: 'The destination is unavailable',
};
export const reasonText = code => code ? (rejectionNames[code] || code.toLowerCase().replaceAll('_', ' ')) : '';

export const bankName = (directory, id) => directory.find(bank => bank.bankId === id)?.bankName || id || '—';

// How a transfer row from the Worker should be described to this customer.
export function routeLabel(row) {
  if (row.type === 'INTERNAL') return 'Same bank';
  return row.direction === 'CREDIT' ? 'Incoming' : 'Outgoing';
}
export const isIncoming = row => row.direction === 'CREDIT';
