import { Injectable } from '@nestjs/common';
import { IProvider, ProviderDebt } from '../provider.port';

interface ProviderADebt {
  type: string;
  amount: number;
  due_date: string;
}

interface ProviderAPayload {
  vehicle: string;
  debts: ProviderADebt[];
}

@Injectable()
export class ProviderAAdapter implements IProvider {
  // fetchDebts is a stub — real HTTP integration is out of scope for this version
  async fetchDebts(_placa: string): Promise<ProviderDebt[]> {
    throw new Error('ProviderAAdapter.fetchDebts not implemented');
  }

  normalize(raw: ProviderAPayload): ProviderDebt[] {
    return raw.debts.map((d) => ({
      tipo: d.type,
      valor_original: d.amount,
      vencimento: d.due_date,
    }));
  }
}
