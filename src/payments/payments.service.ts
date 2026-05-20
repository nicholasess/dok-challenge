import { Injectable } from '@nestjs/common';
import { roundHalfUp } from '../common/money/money.util';

export interface PixResult {
  total_com_desconto: string;
}

export interface CartaoParcela {
  quantidade: number;
  valor_parcela: string;
}

export interface CartaoResult {
  parcelas: CartaoParcela[];
}

export interface DebtSummary {
  tipo: string;
  valor_atualizado: number;
}

export interface OpcaoPagamento {
  tipo: string;
  valor_base: string;
}

@Injectable()
export class PaymentsService {
  calcularPix(valor_base: number): PixResult {
    return {
      total_com_desconto: roundHalfUp(valor_base * 0.95),
    };
  }

  calcularCartao(valor_base: number): CartaoResult {
    const i = 0.025;

    const pmt = (n: number): string => {
      if (n === 1) return roundHalfUp(valor_base);
      const factor = Math.pow(1 + i, n);
      return roundHalfUp((valor_base * i * factor) / (factor - 1));
    };

    return {
      parcelas: [
        { quantidade: 1, valor_parcela: pmt(1) },
        { quantidade: 6, valor_parcela: pmt(6) },
        { quantidade: 12, valor_parcela: pmt(12) },
      ],
    };
  }

  montarOpcoes(debts: DebtSummary[]): OpcaoPagamento[] {
    const total = debts.reduce((sum, d) => sum + d.valor_atualizado, 0);
    const opcoes: OpcaoPagamento[] = [
      { tipo: 'TOTAL', valor_base: roundHalfUp(total) },
    ];

    const tipos_vistos = new Set<string>();
    for (const debt of debts) {
      if (tipos_vistos.has(debt.tipo)) continue;
      tipos_vistos.add(debt.tipo);

      const valor_tipo = debts
        .filter((d) => d.tipo === debt.tipo)
        .reduce((sum, d) => sum + d.valor_atualizado, 0);

      opcoes.push({
        tipo: `SOMENTE_${debt.tipo}`,
        valor_base: roundHalfUp(valor_tipo),
      });
    }

    return opcoes;
  }
}
