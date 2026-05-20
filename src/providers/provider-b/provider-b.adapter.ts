import { XMLParser } from 'fast-xml-parser';
import { Injectable } from '@nestjs/common';
import { IProvider, ProviderDebt } from '../provider.port';

interface ProviderBRawDebt {
  category: string;
  value: number;
  expiration: string;
}

@Injectable()
export class ProviderBAdapter implements IProvider {
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  // fetchDebts is a stub — real HTTP integration is out of scope for this version
  async fetchDebts(_placa: string): Promise<ProviderDebt[]> {
    throw new Error('ProviderBAdapter.fetchDebts not implemented');
  }

  normalize(xml: string): ProviderDebt[] {
    const parsed = this.parser.parse(xml) as {
      response?: { debts?: { debt?: ProviderBRawDebt | ProviderBRawDebt[] } };
    };

    const debts = parsed.response?.debts;
    if (!debts || !debts.debt) {
      return [];
    }

    const list = Array.isArray(debts.debt) ? debts.debt : [debts.debt];

    return list.map((d) => ({
      tipo: String(d.category),
      valor_original: Number(d.value),
      vencimento: String(d.expiration),
    }));
  }
}
