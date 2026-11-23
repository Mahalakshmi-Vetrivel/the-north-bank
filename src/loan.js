// Loan helpers for display only; the bank's server recalculates and stores the real figures.
export const LOAN_RATE_PERCENT = 10; // demo rate, same as the server
export function emiMinor(principalMinor, months, ratePercent = LOAN_RATE_PERCENT) {
  const r = ratePercent / 12 / 100;
  const factor = (1 + r) ** months;
  return Math.round((principalMinor * r * factor) / (factor - 1));
}
