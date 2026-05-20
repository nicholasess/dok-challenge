import { Injectable } from '@nestjs/common';
import { roundHalfUp } from '../../common/money/money.util';

export interface InterestResult {
  juros: number;
  valor_atualizado: string;
}

function calcIpva(valor: number, dias: number): InterestResult {
  if (dias <= 0) {
    return { juros: 0, valor_atualizado: roundHalfUp(valor) };
  }
  const juros_calculado = valor * 0.0033 * dias;
  const teto = valor * 0.2;
  const juros = Math.min(juros_calculado, teto);
  return { juros, valor_atualizado: roundHalfUp(valor + juros) };
}

function calcMulta(valor: number, dias: number): InterestResult {
  if (dias <= 0) {
    return { juros: 0, valor_atualizado: roundHalfUp(valor) };
  }
  const juros = valor * 0.01 * dias;
  return { juros, valor_atualizado: roundHalfUp(valor + juros) };
}

const strategies: Record<string, (valor: number, dias: number) => InterestResult> = {
  IPVA: calcIpva,
  MULTA: calcMulta,
};

@Injectable()
export class InterestService {
  calculate(tipo: string, valor: number, dias: number): InterestResult {
    const strategy = strategies[tipo];
    if (!strategy) {
      throw new Error(`unknown_debt_type: ${tipo}`);
    }
    return strategy(valor, dias);
  }
}
