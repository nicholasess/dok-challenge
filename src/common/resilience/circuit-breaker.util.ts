export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerEntry {
  state: CircuitState;
  failures: number;
  openedAt: number;
}

/**
 * Circuit breaker in-memory por chave (ex: índice do provedor).
 *
 * Transições de estado:
 *   CLOSED  → OPEN      após `failureThreshold` falhas consecutivas
 *   OPEN    → HALF_OPEN após `recoveryTimeoutMs` sem tentativas
 *   HALF_OPEN → CLOSED  na primeira tentativa bem-sucedida
 *   HALF_OPEN → OPEN    se a tentativa em HALF_OPEN falhar
 *
 * ⚠️ Estado em memória: cada réplica possui estado independente.
 * Para uso em Kubernetes com múltiplas réplicas, prefira circuit breaker
 * no service mesh (Istio/Linkerd) ou com estado compartilhado (Redis).
 */
export class CircuitBreaker {
  private readonly entries = new Map<string, BreakerEntry>();

  constructor(
    private readonly failureThreshold = 3,
    private readonly recoveryTimeoutMs = 30_000,
  ) {}

  isOpen(key: string): boolean {
    const entry = this.getOrCreate(key);
    if (entry.state === 'CLOSED' || entry.state === 'HALF_OPEN') return false;
    if (Date.now() - entry.openedAt >= this.recoveryTimeoutMs) {
      entry.state = 'HALF_OPEN';
      return false;
    }
    return true;
  }

  recordSuccess(key: string): void {
    const entry = this.getOrCreate(key);
    entry.state = 'CLOSED';
    entry.failures = 0;
    entry.openedAt = 0;
  }

  recordFailure(key: string): void {
    const entry = this.getOrCreate(key);
    entry.failures += 1;
    if (entry.state === 'HALF_OPEN' || entry.failures >= this.failureThreshold) {
      entry.state = 'OPEN';
      entry.openedAt = Date.now();
    }
  }

  getState(key: string): CircuitState {
    return this.getOrCreate(key).state;
  }

  private getOrCreate(key: string): BreakerEntry {
    if (!this.entries.has(key)) {
      this.entries.set(key, { state: 'CLOSED', failures: 0, openedAt: 0 });
    }
    return this.entries.get(key)!;
  }
}
