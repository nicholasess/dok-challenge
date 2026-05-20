export const PROVIDERS_TOKEN = 'PROVIDERS';

export interface ProviderDebt {
  tipo: string;
  valor_original: number;
  vencimento: string;
}

export interface IProvider {
  fetchDebts(placa: string): Promise<ProviderDebt[]>;
}
