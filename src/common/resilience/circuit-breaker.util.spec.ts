import { CircuitBreaker } from './circuit-breaker.util';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;
  const KEY = 'provider-0';

  beforeEach(() => {
    cb = new CircuitBreaker(3, 30_000);
  });

  it('inicia CLOSED e não bloqueia', () => {
    expect(cb.getState(KEY)).toBe('CLOSED');
    expect(cb.isOpen(KEY)).toBe(false);
  });

  it('permanece CLOSED abaixo do threshold de falhas', () => {
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    expect(cb.getState(KEY)).toBe('CLOSED');
    expect(cb.isOpen(KEY)).toBe(false);
  });

  it('abre após atingir o threshold de falhas', () => {
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    expect(cb.getState(KEY)).toBe('OPEN');
    expect(cb.isOpen(KEY)).toBe(true);
  });

  it('sucesso reseta para CLOSED e zera as falhas', () => {
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    cb.recordSuccess(KEY);
    cb.recordFailure(KEY);
    expect(cb.getState(KEY)).toBe('CLOSED');
  });

  it('transiciona para HALF_OPEN após o timeout de recuperação', () => {
    jest.useFakeTimers();
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    expect(cb.isOpen(KEY)).toBe(true);

    jest.advanceTimersByTime(30_000);
    expect(cb.isOpen(KEY)).toBe(false);
    expect(cb.getState(KEY)).toBe('HALF_OPEN');
    jest.useRealTimers();
  });

  it('HALF_OPEN → CLOSED após sucesso', () => {
    jest.useFakeTimers();
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    jest.advanceTimersByTime(30_000);
    cb.isOpen(KEY); // dispara transição para HALF_OPEN
    cb.recordSuccess(KEY);
    expect(cb.getState(KEY)).toBe('CLOSED');
    jest.useRealTimers();
  });

  it('HALF_OPEN → OPEN se a tentativa de recuperação falhar', () => {
    jest.useFakeTimers();
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    cb.recordFailure(KEY);
    jest.advanceTimersByTime(30_000);
    cb.isOpen(KEY); // dispara transição para HALF_OPEN
    cb.recordFailure(KEY);
    expect(cb.getState(KEY)).toBe('OPEN');
    jest.useRealTimers();
  });

  it('gerencia estados independentes por chave', () => {
    cb.recordFailure('provider-0');
    cb.recordFailure('provider-0');
    cb.recordFailure('provider-0');
    expect(cb.isOpen('provider-0')).toBe(true);
    expect(cb.isOpen('provider-1')).toBe(false);
  });
});
