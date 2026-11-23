import { describe, expect, it } from 'vitest';
import { toPaise } from '../src/amount';
import { money, reasonText, routeLabel } from '../src/format';
import { toCsv } from '../src/csv';

describe('toPaise (amount entry → integer paise)', () => {
  it('converts rupees to paise', () => {
    expect(toPaise('1000')).toBe(100000);
    expect(toPaise('250.5')).toBe(25050);
    expect(toPaise(' 0.01 ')).toBe(1);
  });
  it('rejects zero, negatives, 3 decimals and text', () => {
    for (const bad of ['0', '-5', '1.234', 'abc', '', '1e3']) expect(toPaise(bad)).toBeNull();
  });
});

describe('money (Indian formatting)', () => {
  it('formats paise as ₹ with lakh grouping', () => {
    expect(money(10000000)).toBe('₹1,00,000.00');
    expect(money(80000)).toBe('₹800.00');
  });
});

describe('labels', () => {
  it('describes routes and reasons', () => {
    expect(routeLabel({ type: 'INTERNAL' })).toBe('Same bank');
    expect(routeLabel({ type: 'INTERBANK', direction: 'CREDIT' })).toBe('Incoming');
    expect(reasonText('LIMIT_EXCEEDED')).toBe('Transfer limit exceeded');
    expect(reasonText('SOME_NEW_CODE')).toBe('some new code');
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralises formulas', () => {
    expect(toCsv(['a', 'b'], [['x"y', '=SUM(A1)']])).toBe('"a","b"\r\n"x""y","\'=SUM(A1)"');
  });
});
