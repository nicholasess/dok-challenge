import { PaymentsService } from './payments.service';

describe('PaymentsService — PIX (1.4)', () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
  });

  it('opção TOTAL: valor_base=2355.93 → PIX 2238.13', () => {
    const result = service.calcularPix(2355.93);
    expect(result.total_com_desconto).toBe('2238.13');
  });

  it('opção SOMENTE_IPVA: valor_base=1800.00 → PIX 1710.00', () => {
    const result = service.calcularPix(1800.0);
    expect(result.total_com_desconto).toBe('1710.00');
  });

  it('opção SOMENTE_MULTA: valor_base=555.93 → PIX 528.13', () => {
    const result = service.calcularPix(555.93);
    expect(result.total_com_desconto).toBe('528.13');
  });

  it('arredondamento: valor_base=100.01 → PIX 95.01', () => {
    const result = service.calcularPix(100.01);
    expect(result.total_com_desconto).toBe('95.01');
  });
});

describe('PaymentsService — Cartão de Crédito (1.5)', () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
  });

  describe('parcelas geradas', () => {
    it('valor_base=2355.93 → gera exatamente [1x, 6x, 12x] e nenhuma outra', () => {
      const result = service.calcularCartao(2355.93);
      expect(result.parcelas).toHaveLength(3);
      expect(result.parcelas.map((p) => p.quantidade)).toEqual([1, 6, 12]);
    });
  });

  describe('1x — sem juros', () => {
    it('valor_base=2355.93 → parcela "2355.93"', () => {
      const result = service.calcularCartao(2355.93);
      const parcela1x = result.parcelas.find((p) => p.quantidade === 1);
      expect(parcela1x?.valor_parcela).toBe('2355.93');
    });

    it('valor_base=100.00 → parcela "100.00"', () => {
      const result = service.calcularCartao(100.0);
      const parcela1x = result.parcelas.find((p) => p.quantidade === 1);
      expect(parcela1x?.valor_parcela).toBe('100.00');
    });
  });

  describe('6x — Price/PMT, i = 0.025', () => {
    it('valor_base=2355.93 → parcela "427.72"', () => {
      const result = service.calcularCartao(2355.93);
      const parcela6x = result.parcelas.find((p) => p.quantidade === 6);
      expect(parcela6x?.valor_parcela).toBe('427.72');
    });

    it('valor_base=1000.00 → parcela "181.55"', () => {
      const result = service.calcularCartao(1000.0);
      const parcela6x = result.parcelas.find((p) => p.quantidade === 6);
      expect(parcela6x?.valor_parcela).toBe('181.55');
    });
  });

  describe('12x — Price/PMT, i = 0.025', () => {
    it('valor_base=2355.93 → parcela "229.67"', () => {
      const result = service.calcularCartao(2355.93);
      const parcela12x = result.parcelas.find((p) => p.quantidade === 12);
      expect(parcela12x?.valor_parcela).toBe('229.67');
    });

    it('valor_base=1000.00 → parcela "97.49"', () => {
      const result = service.calcularCartao(1000.0);
      const parcela12x = result.parcelas.find((p) => p.quantidade === 12);
      expect(parcela12x?.valor_parcela).toBe('97.49');
    });
  });
});

describe('PaymentsService — Opções de Pagamento (1.7)', () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
  });

  it('IPVA e MULTA presentes → opções [TOTAL, SOMENTE_IPVA, SOMENTE_MULTA]', () => {
    const result = service.montarOpcoes([
      { tipo: 'IPVA', valor_atualizado: 1800.0 },
      { tipo: 'MULTA', valor_atualizado: 555.93 },
    ]);
    expect(result.map((o) => o.tipo)).toEqual([
      'TOTAL',
      'SOMENTE_IPVA',
      'SOMENTE_MULTA',
    ]);
  });

  it('somente IPVA → opções [TOTAL, SOMENTE_IPVA]', () => {
    const result = service.montarOpcoes([
      { tipo: 'IPVA', valor_atualizado: 1800.0 },
    ]);
    expect(result.map((o) => o.tipo)).toEqual(['TOTAL', 'SOMENTE_IPVA']);
  });

  it('somente MULTA → opções [TOTAL, SOMENTE_MULTA]', () => {
    const result = service.montarOpcoes([
      { tipo: 'MULTA', valor_atualizado: 555.93 },
    ]);
    expect(result.map((o) => o.tipo)).toEqual(['TOTAL', 'SOMENTE_MULTA']);
  });

  it('múltiplos IPVA (2 débitos) → opções [TOTAL, SOMENTE_IPVA] (única opção parcial por tipo)', () => {
    const result = service.montarOpcoes([
      { tipo: 'IPVA', valor_atualizado: 1200.0 },
      { tipo: 'IPVA', valor_atualizado: 600.0 },
    ]);
    expect(result.map((o) => o.tipo)).toEqual(['TOTAL', 'SOMENTE_IPVA']);
    expect(result.find((o) => o.tipo === 'TOTAL')?.valor_base).toBe('1800.00');
    expect(result.find((o) => o.tipo === 'SOMENTE_IPVA')?.valor_base).toBe(
      '1800.00',
    );
  });

  it('zero débitos → apenas [TOTAL] com valor_base = "0.00"', () => {
    const result = service.montarOpcoes([]);
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('TOTAL');
    expect(result[0].valor_base).toBe('0.00');
  });
});
