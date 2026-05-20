import { ProviderBAdapter } from './provider-b.adapter';

describe('ProviderBAdapter — Normalização Provedor B XML (1.9)', () => {
  let adapter: ProviderBAdapter;

  beforeEach(() => {
    adapter = new ProviderBAdapter();
  });

  it('XML com débitos normais → ProviderDebt[] populado com campos corretos', () => {
    const xml = `
      <response>
        <plate>ABC1234</plate>
        <debts>
          <debt><category>IPVA</category><value>1500.00</value><expiration>2024-01-10</expiration></debt>
          <debt><category>MULTA</category><value>300.50</value><expiration>2024-02-15</expiration></debt>
        </debts>
      </response>
    `;

    const result = adapter.normalize(xml);

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

  it('XML com lista vazia autofechada (<debts/>) → ProviderDebt[] vazio', () => {
    const result = adapter.normalize('<response><plate>ABC1234</plate><debts/></response>');
    expect(result).toEqual([]);
  });

  it('XML com lista vazia alternativa (<debts></debts>) → ProviderDebt[] vazio', () => {
    const result = adapter.normalize('<response><plate>ABC1234</plate><debts></debts></response>');
    expect(result).toEqual([]);
  });

  it('tipo desconhecido no XML → propagar tipo; não silenciar', () => {
    const xml = `
      <response>
        <plate>ABC1234</plate>
        <debts>
          <debt><category>FOOBAR</category><value>500.00</value><expiration>2024-03-01</expiration></debt>
        </debts>
      </response>
    `;

    const result = adapter.normalize(xml);

    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('FOOBAR');
  });
});
