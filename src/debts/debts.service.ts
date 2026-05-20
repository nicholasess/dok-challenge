import { Injectable, Inject, Logger } from '@nestjs/common';
import { BusinessError } from '../common/errors/business.errors';
import { IProvider, ProviderDebt, PROVIDERS_TOKEN } from '../providers/provider.port';
import { InterestService } from './entities/interest.service';
import { PaymentsService } from '../payments/payments.service';
import { getCurrentDate } from '../common/date/date.util';
import { roundHalfUp } from '../common/money/money.util';
import { maskPlate } from '../common/log/mask.util';
import { retryWithBackoff } from '../common/resilience/retry.util';
import { CircuitBreaker } from '../common/resilience/circuit-breaker.util';
import { SimulateResponseDto } from './dto/simulate.dto';

const VALID_TYPES = new Set(['IPVA', 'MULTA']);

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    @Inject(PROVIDERS_TOKEN) private readonly providers: IProvider[],
    private readonly interestService: InterestService,
    private readonly paymentsService: PaymentsService,
  ) {}

  validateDebtTypes(debts: ProviderDebt[]): void {
    for (const debt of debts) {
      if (!VALID_TYPES.has(debt.tipo)) {
        throw new BusinessError('unknown_debt_type', debt.tipo);
      }
    }
  }

  async simulate(placa: string): Promise<SimulateResponseDto> {
    const masked = maskPlate(placa);
    this.logger.log({ event: 'simulate.start', placa: masked });

    let raw_debts: ProviderDebt[] | null = null;
    let providerIndex = -1;

    for (let i = 0; i < this.providers.length; i++) {
      const key = `provider-${i}`;

      if (this.circuitBreaker.isOpen(key)) {
        this.logger.warn({ event: 'provider.circuit_open', placa: masked, providerIndex: i });
        continue;
      }

      const start = Date.now();
      try {
        raw_debts = await retryWithBackoff(() => this.providers[i].fetchDebts(placa));
        this.circuitBreaker.recordSuccess(key);
        providerIndex = i;
        this.logger.log({
          event: 'provider.success',
          placa: masked,
          providerIndex: i,
          durationMs: Date.now() - start,
          debtCount: raw_debts.length,
        });
        break;
      } catch (err) {
        this.circuitBreaker.recordFailure(key);
        this.logger.warn({
          event: 'provider.failure',
          placa: masked,
          providerIndex: i,
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (raw_debts === null) {
      this.logger.error({ event: 'simulate.all_providers_unavailable', placa: masked });
      throw new BusinessError('all_providers_unavailable');
    }

    this.validateDebtTypes(raw_debts);

    const now = getCurrentDate();
    const debitos = raw_debts.map((debt) => {
      const due = new Date(debt.vencimento + 'T00:00:00Z');
      const dias_atraso = Math.floor(
        (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
      );
      const result = this.interestService.calculate(
        debt.tipo,
        debt.valor_original,
        dias_atraso,
      );
      return {
        tipo: debt.tipo,
        valor_original: roundHalfUp(debt.valor_original),
        valor_atualizado: result.valor_atualizado,
        vencimento: debt.vencimento,
        dias_atraso,
      };
    });

    const total_original = raw_debts.reduce(
      (sum, d) => sum + d.valor_original,
      0,
    );
    const total_atualizado = debitos.reduce(
      (sum, d) => sum + parseFloat(d.valor_atualizado),
      0,
    );

    const debt_summaries = debitos.map((d) => ({
      tipo: d.tipo,
      valor_atualizado: parseFloat(d.valor_atualizado),
    }));

    const raw_opcoes = this.paymentsService.montarOpcoes(debt_summaries);
    const opcoes = raw_opcoes.map((o) => {
      const valor_base_num = parseFloat(o.valor_base);
      return {
        tipo: o.tipo,
        valor_base: o.valor_base,
        pix: this.paymentsService.calcularPix(valor_base_num),
        cartao_credito: this.paymentsService.calcularCartao(valor_base_num),
      };
    });

    const tipos = [...new Set(debitos.map((d) => d.tipo))];
    this.logger.log({
      event: 'simulate.complete',
      placa: masked,
      providerIndex,
      debtCount: debitos.length,
      tipos,
    });

    return {
      placa,
      debitos,
      resumo: {
        total_original: roundHalfUp(total_original),
        total_atualizado: roundHalfUp(total_atualizado),
      },
      pagamentos: { opcoes },
    };
  }
}

