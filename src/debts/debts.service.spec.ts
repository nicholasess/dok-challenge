import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { InterestService } from './entities/interest.service';
import { PaymentsService } from '../payments/payments.service';
import { PROVIDERS_TOKEN, IProvider, ProviderDebt } from '../providers/provider.port';
import { BusinessError } from '../common/errors/business.errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDebt(tipo: string): ProviderDebt {
  return { tipo, valor_original: 100, vencimento: '2024-01-10' };
}

function buildModule(providers: IProvider[]): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [DebtsController],
    providers: [
      DebtsService,
      InterestService,
      PaymentsService,
      { provide: PROVIDERS_TOKEN, useValue: providers },
    ],
  }).compile();
}

// ─── 1.10 — Tipo Desconhecido ──────────────────────────────────────────────────

describe('DebtsService — Tipo Desconhecido (1.10)', () => {
  let service: DebtsService;

  beforeEach(async () => {
    const stub: IProvider = { fetchDebts: jest.fn() };
    const module = await buildModule([stub]);
    service = module.get(DebtsService);
  });

  it('tipo desconhecido entre tipos válidos: [IPVA, FOOBAR] → lança unknown_debt_type com type="FOOBAR"', () => {
    const debts = [makeDebt('IPVA'), makeDebt('FOOBAR')];
    let caught!: BusinessError;
    try {
      service.validateDebtTypes(debts);
    } catch (e) {
      caught = e as BusinessError;
    }
    expect(caught).toBeInstanceOf(BusinessError);
    expect(caught.code).toBe('unknown_debt_type');
    expect(caught.type).toBe('FOOBAR');
  });

  it('todos os débitos com tipo desconhecido: [FOOBAR, BARZZ] → lança unknown_debt_type', () => {
    const debts = [makeDebt('FOOBAR'), makeDebt('BARZZ')];
    let caught!: BusinessError;
    try {
      service.validateDebtTypes(debts);
    } catch (e) {
      caught = e as BusinessError;
    }
    expect(caught).toBeInstanceOf(BusinessError);
    expect(caught.code).toBe('unknown_debt_type');
    expect(caught.type).toBe('FOOBAR');
  });

  it('nenhum tipo desconhecido: [IPVA, MULTA] → prossegue sem erro', () => {
    const debts = [makeDebt('IPVA'), makeDebt('MULTA')];
    expect(() => service.validateDebtTypes(debts)).not.toThrow();
  });
});

// ─── 2.x — Integração via HTTP (TestingModule + Supertest) ────────────────────

describe('POST /debts/simulate — Integração (2.x)', () => {
  let app: INestApplication;
  let mock_provider_a: jest.Mocked<IProvider>;
  let mock_provider_b: jest.Mocked<IProvider>;
  let module_ref: Awaited<ReturnType<typeof buildModule>>;

  beforeEach(async () => {
    mock_provider_a = { fetchDebts: jest.fn() };
    mock_provider_b = { fetchDebts: jest.fn() };

    module_ref = await buildModule([mock_provider_a, mock_provider_b]);
    app = module_ref.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) => {
          const constraint = Object.keys(errors[0]?.constraints ?? {})[0] ?? 'validation_error';
          return new HttpException({ error: constraint }, HttpStatus.BAD_REQUEST);
        },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── 2.1 — Fallback ────────────────────────────────────────────────────────

  describe('2.1 — Fallback entre provedores', () => {
    it('Provider A falha; Provider B retorna débitos → HTTP 200 usando dados do B', async () => {
      // Fake only Date (not timers) so retry's setTimeout still runs
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask'] });
      jest.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      // mockRejectedValue (permanent) so all retry attempts fail and service falls back to B
      mock_provider_a.fetchDebts.mockRejectedValue(new Error('timeout'));
      mock_provider_b.fetchDebts.mockResolvedValueOnce([
        { tipo: 'MULTA', valor_original: 300.5, vencimento: '2024-02-15' },
      ]);

      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      expect(res.status).toBe(200);
      expect(res.body.debitos).toHaveLength(1);
      expect(res.body.debitos[0].tipo).toBe('MULTA');
      expect(mock_provider_a.fetchDebts).toHaveBeenCalledWith('ABC1234');
      expect(mock_provider_b.fetchDebts).toHaveBeenCalledWith('ABC1234');

      jest.useRealTimers();
    });

    it('Ambos os provedores falham → HTTP 503 all_providers_unavailable', async () => {
      // mockRejectedValue (permanent) so all retry attempts fail for both providers
      mock_provider_a.fetchDebts.mockRejectedValue(new Error('timeout'));
      mock_provider_b.fetchDebts.mockRejectedValue(new Error('timeout'));

      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'all_providers_unavailable' });
    });

    it('Provider A retorna [] válido → HTTP 200 com lista vazia; não tenta Provider B', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      expect(res.status).toBe(200);
      expect(res.body.debitos).toEqual([]);
      expect(mock_provider_b.fetchDebts).not.toHaveBeenCalled();
    });

    it('Provider A com circuito aberto é pulado; Provider B é chamado diretamente', async () => {
      // Pre-open the circuit for provider-0 by recording failures directly on the
      // private CircuitBreaker instance, avoiding real HTTP round-trips and not
      // affecting provider-1's circuit state.
      const service = module_ref.get(DebtsService);
      const cb: { recordFailure: (key: string) => void } = (service as unknown as { circuitBreaker: { recordFailure: (key: string) => void } }).circuitBreaker;
      cb.recordFailure('provider-0');
      cb.recordFailure('provider-0');
      cb.recordFailure('provider-0'); // threshold=3 → circuit OPENS

      mock_provider_b.fetchDebts.mockResolvedValueOnce([
        { tipo: 'IPVA', valor_original: 1500, vencimento: '2026-12-01' },
      ]);

      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      expect(res.status).toBe(200);
      expect(mock_provider_a.fetchDebts).not.toHaveBeenCalled();
      expect(mock_provider_b.fetchDebts).toHaveBeenCalledWith('ABC1234');
    });
  });

  // ── 2.2 — Zero débitos ────────────────────────────────────────────────────

  describe('2.2 — Zero débitos — estrutura da resposta', () => {
    beforeEach(() => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);
    });

    it('debitos → []', async () => {
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      expect(res.status).toBe(200);
      expect(res.body.debitos).toEqual([]);
    });

    it('resumo.total_original → "0.00"', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });
      expect(res.body.resumo.total_original).toBe('0.00');
    });

    it('resumo.total_atualizado → "0.00"', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });
      expect(res.body.resumo.total_atualizado).toBe('0.00');
    });

    it('pagamentos.opcoes contém opção TOTAL com valor_base = "0.00"', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });
      const total = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'TOTAL',
      );
      expect(total).toBeDefined();
      expect(total.valor_base).toBe('0.00');
    });

    it('pagamentos.opcoes não contém opções parciais (SOMENTE_*)', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });
      const parciais = res.body.pagamentos.opcoes.filter((o: { tipo: string }) =>
        o.tipo.startsWith('SOMENTE_'),
      );
      expect(parciais).toHaveLength(0);
    });
  });

  // ── 2.3 — Cálculo completo ABC1234 ────────────────────────────────────────

  describe('2.3 — Cálculo completo — placa ABC1234 (data 2024-05-10)', () => {
    let res: request.Response;

    beforeEach(async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      mock_provider_a.fetchDebts.mockResolvedValueOnce([
        { tipo: 'IPVA', valor_original: 1500.0, vencimento: '2024-01-10' },
        { tipo: 'MULTA', valor_original: 300.5, vencimento: '2024-02-15' },
      ]);

      res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });

      jest.useRealTimers();
    });

    it('HTTP 200', () => {
      expect(res.status).toBe(200);
    });

    it('IPVA: valor_original="1500.00", valor_atualizado="1800.00", dias_atraso=121, vencimento="2024-01-10"', () => {
      const ipva = res.body.debitos.find((d: { tipo: string }) => d.tipo === 'IPVA');
      expect(ipva.valor_original).toBe('1500.00');
      expect(ipva.valor_atualizado).toBe('1800.00');
      expect(ipva.dias_atraso).toBe(121);
      expect(ipva.vencimento).toBe('2024-01-10');
    });

    it('MULTA: valor_original="300.50", valor_atualizado="555.93", dias_atraso=85, vencimento="2024-02-15"', () => {
      const multa = res.body.debitos.find((d: { tipo: string }) => d.tipo === 'MULTA');
      expect(multa.valor_original).toBe('300.50');
      expect(multa.valor_atualizado).toBe('555.93');
      expect(multa.dias_atraso).toBe(85);
      expect(multa.vencimento).toBe('2024-02-15');
    });

    it('resumo.total_original → "1800.50"', () => {
      expect(res.body.resumo.total_original).toBe('1800.50');
    });

    it('resumo.total_atualizado → "2355.93"', () => {
      expect(res.body.resumo.total_atualizado).toBe('2355.93');
    });

    it('opção TOTAL → PIX total_com_desconto="2238.13"', () => {
      const total = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'TOTAL',
      );
      expect(total.pix.total_com_desconto).toBe('2238.13');
    });

    it('opção TOTAL → Cartão 1x="2355.93", 6x="427.72", 12x="229.67"', () => {
      const total = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'TOTAL',
      );
      const parcelas = total.cartao_credito.parcelas;
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 1).valor_parcela).toBe('2355.93');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 6).valor_parcela).toBe('427.72');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 12).valor_parcela).toBe('229.67');
    });

    it('opção SOMENTE_IPVA → valor_base="1800.00", PIX="1710.00"', () => {
      const opt = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'SOMENTE_IPVA',
      );
      expect(opt.valor_base).toBe('1800.00');
      expect(opt.pix.total_com_desconto).toBe('1710.00');
    });

    it('opção SOMENTE_IPVA → Cartão 1x="1800.00", 6x="326.79", 12x="175.48"', () => {
      const opt = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'SOMENTE_IPVA',
      );
      const parcelas = opt.cartao_credito.parcelas;
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 1).valor_parcela).toBe('1800.00');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 6).valor_parcela).toBe('326.79');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 12).valor_parcela).toBe('175.48');
    });

    it('opção SOMENTE_MULTA → valor_base="555.93", PIX="528.13"', () => {
      const opt = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'SOMENTE_MULTA',
      );
      expect(opt.valor_base).toBe('555.93');
      expect(opt.pix.total_com_desconto).toBe('528.13');
    });

    it('opção SOMENTE_MULTA → Cartão 1x="555.93", 6x="100.93", 12x="54.20"', () => {
      const opt = res.body.pagamentos.opcoes.find(
        (o: { tipo: string }) => o.tipo === 'SOMENTE_MULTA',
      );
      const parcelas = opt.cartao_credito.parcelas;
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 1).valor_parcela).toBe('555.93');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 6).valor_parcela).toBe('100.93');
      expect(parcelas.find((p: { quantidade: number }) => p.quantidade === 12).valor_parcela).toBe('54.20');
    });
  });

  // ── Validação de placa na camada HTTP ──────────────────────────────────────

  describe('Validação de placa via controller', () => {
    it('placa inválida → HTTP 400 { error: "invalid_plate" }', async () => {
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC123' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'invalid_plate' });
    });

    it('tipo desconhecido nos débitos → HTTP 422 unknown_debt_type', async () => {
      mock_provider_a.fetchDebts.mockResolvedValueOnce([
        { tipo: 'FOOBAR', valor_original: 100, vencimento: '2024-01-01' },
      ]);
      const res = await request(app.getHttpServer())
        .post('/debts/simulate')
        .send({ placa: 'ABC1234' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('unknown_debt_type');
      expect(res.body.type).toBe('FOOBAR');
    });
  });
});

