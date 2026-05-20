import { retryWithBackoff } from './retry.util';

const noSleep = () => Promise.resolve();

describe('retryWithBackoff', () => {
  it('resolve na primeira tentativa sem retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 3, 0, noSleep);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('falha nas 2 primeiras, resolve na 3ª', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 3, 0, noSleep);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('esgota todas as tentativas e lança o último erro', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));
    await expect(retryWithBackoff(fn, 3, 0, noSleep)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respeita maxAttempts=1 sem nenhuma espera', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const sleepSpy = jest.fn().mockResolvedValue(undefined);
    await expect(retryWithBackoff(fn, 1, 50, sleepSpy)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('aplica backoff exponencial: delays 50ms, 100ms para 3 tentativas', async () => {
    const delays: number[] = [];
    const sleep = (ms: number) => { delays.push(ms); return Promise.resolve(); };
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(retryWithBackoff(fn, 3, 50, sleep)).rejects.toThrow();
    expect(delays).toEqual([50, 100]);
  });
});
