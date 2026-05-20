import { ProviderAAdapter } from './provider-a.adapter';

describe('ProviderAAdapter — Normalização Provedor A JSON (1.8)', () => {
  let adapter: ProviderAAdapter;

  beforeEach(() => {
    adapter = new ProviderAAdapter();
  });

  it('payload JSON válido com IPVA e MULTA → ProviderDebt[] com tipo, valor_original, vencimento corretos', () => {
    const raw = {
      vehicle: 'ABC1234',
      debts: [
        { type: 'IPVA', amount: 1500.0, due_date: '2024-01-10' },
        { type: 'MULTA', amount: 300.5, due_date: '2024-02-15' },
      ],
    };

    const result = adapter.normalize(raw);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      tipo: 'IPVA',
      valor_original: 1500.0,
      vencimento: '2024-01-10',
    });
    expect(result[1]).toEqual({
      tipo: 'MULTA',
      valor_original: 300.5,
      vencimento: '2024-02-15',
    });
  });

  it('lista vazia [] → ProviderDebt[] vazio', () => {
    const raw = { vehicle: 'ABC1234', debts: [] };
    const result = adapter.normalize(raw);
    expect(result).toEqual([]);
  });

  it('tipo desconhecido no payload → propagar o tipo desconhecido; não silenciar', () => {
    const raw = {
      vehicle: 'ABC1234',
      debts: [{ type: 'FOOBAR', amount: 500.0, due_date: '2024-03-01' }],
    };

    const result = adapter.normalize(raw);

    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('FOOBAR');
  });
});
