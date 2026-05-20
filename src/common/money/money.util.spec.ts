import { roundHalfUp } from './money.util';

describe('roundHalfUp (1.3)', () => {
  it('1.005 → "1.01"', () => {
    expect(roundHalfUp(1.005)).toBe('1.01');
  });

  it('1.004 → "1.00"', () => {
    expect(roundHalfUp(1.004)).toBe('1.00');
  });

  it('2.555 → "2.56"', () => {
    expect(roundHalfUp(2.555)).toBe('2.56');
  });

  it('2.554 → "2.55"', () => {
    expect(roundHalfUp(2.554)).toBe('2.55');
  });

  it('0.005 → "0.01"', () => {
    expect(roundHalfUp(0.005)).toBe('0.01');
  });

  it('100 (inteiro) → "100.00"', () => {
    expect(roundHalfUp(100)).toBe('100.00');
  });
});
