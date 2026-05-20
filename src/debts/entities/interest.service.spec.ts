import { InterestService } from './interest.service';

describe('InterestService — IPVA (1.1)', () => {
  let service: InterestService;

  beforeEach(() => {
    service = new InterestService();
  });

  it('juros dentro do teto: valor=1500.00, dias=30 → juros=148.50, atualizado=1648.50', () => {
    const result = service.calculate('IPVA', 1500.0, 30);
    expect(result.valor_atualizado).toBe('1648.50');
  });

  it('juros atinge o teto: valor=1500.00, dias=121 → juros calculado 598.95 > teto 300.00; atualizado=1800.00', () => {
    const result = service.calculate('IPVA', 1500.0, 121);
    expect(result.valor_atualizado).toBe('1800.00');
  });

  it('exatamente no teto: valor=1000.00, dias=60 → juros=198.00 < teto=200.00; atualizado=1198.00', () => {
    const result = service.calculate('IPVA', 1000.0, 60);
    expect(result.valor_atualizado).toBe('1198.00');
  });

  it('débito não vencido (dias_atraso < 0): juros=0; atualizado=valor_original', () => {
    const result = service.calculate('IPVA', 1500.0, -5);
    expect(result.juros).toBe(0);
    expect(result.valor_atualizado).toBe('1500.00');
  });

  it('vencimento exatamente hoje (dias_atraso = 0): juros=0; atualizado=valor_original', () => {
    const result = service.calculate('IPVA', 1500.0, 0);
    expect(result.juros).toBe(0);
    expect(result.valor_atualizado).toBe('1500.00');
  });
});

describe('InterestService — MULTA (1.2)', () => {
  let service: InterestService;

  beforeEach(() => {
    service = new InterestService();
  });

  it('juros normal: valor=300.50, dias=85 → juros=255.43, atualizado=555.93', () => {
    const result = service.calculate('MULTA', 300.5, 85);
    expect(result.valor_atualizado).toBe('555.93');
  });

  it('sem teto: valor=100.00, dias=500 → juros=500.00, atualizado=600.00', () => {
    const result = service.calculate('MULTA', 100.0, 500);
    expect(result.valor_atualizado).toBe('600.00');
  });

  it('débito não vencido (dias=0): juros=0; atualizado=valor_original', () => {
    const result = service.calculate('MULTA', 300.5, 0);
    expect(result.juros).toBe(0);
    expect(result.valor_atualizado).toBe('300.50');
  });
});
