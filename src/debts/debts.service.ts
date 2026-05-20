import { Injectable, Inject } from '@nestjs/common';
import { BusinessError } from '../common/errors/business.errors';
import { IProvider, ProviderDebt, PROVIDERS_TOKEN } from '../providers/provider.port';
import { InterestService } from './entities/interest.service';
import { PaymentsService } from '../payments/payments.service';
import { getCurrentDate } from '../common/date/date.util';
import { roundHalfUp } from '../common/money/money.util';
import { SimulateResponseDto } from './dto/simulate.dto';

const VALID_TYPES = new Set(['IPVA', 'MULTA']);

@Injectable()
export class DebtsService {
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
    let raw_debts: ProviderDebt[] | null = null;
    for (const provider of this.providers) {
      try {
        raw_debts = await provider.fetchDebts(placa);
        break;
      } catch {
        // try next provider
      }
    }
    if (raw_debts === null) {
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

