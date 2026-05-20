/**
 * Executa `fn` com até `maxAttempts` tentativas usando backoff exponencial.
 *
 * Delays entre tentativas: baseDelayMs * 2^attempt
 * Exemplo com baseDelayMs=50: 50ms → 100ms (máx 2 esperas para 3 tentativas).
 *
 * O parâmetro `sleep` pode ser substituído em testes por uma função no-op.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 50,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((res) => setTimeout(res, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
