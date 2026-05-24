import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PROVIDERS_TOKEN, IProvider, ProviderDebt } from '../providers/provider.port';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockProvider(debts?: ProviderDebt[] | Error): IProvider {
  return {
    fetchDebts: jest.fn().mockImplementation(() => {
      if (debts instanceof Error) return Promise.reject(debts);
      return Promise.resolve(debts ?? []);
    }),
  };
}

function buildApp(providers: IProvider[]): Promise<{ app: INestApplication; module: TestingModule }> {
  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PROVIDERS_TOKEN)
    .useValue(providers)
    .compile()
    .then(async (module) => {
      const app = module.createNestApplication();
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
      return { app, module };
    });
}

// ─── 3.1 POST /debts/simulate ─────────────────────────────────────────────────

describe('POST /debts/simulate (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    jest.useRealTimers();
  });

  it('placa válida ABC1234 com IPVA e MULTA → HTTP 200 com debitos, resumo e pagamentos', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-05-10T00:00:00Z'));

    const debts: ProviderDebt[] = [
      { tipo: 'IPVA', valor_original: 1500.00, vencimento: '2024-01-10' },
      { tipo: 'MULTA', valor_original: 300.50, vencimento: '2024-02-15' },
    ];
    ({ app } = await buildApp([mockProvider(debts)]));

    const res = await request(app.getHttpServer())
      .post('/debts/simulate')
      .send({ placa: 'ABC1234' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.debitos)).toBe(true);
    expect(res.body.debitos).toHaveLength(2);
    const ipva = res.body.debitos.find((d: { tipo: string }) => d.tipo === 'IPVA');
    expect(ipva.vencimento).toBe('2024-01-10');
    const multa = res.body.debitos.find((d: { tipo: string }) => d.tipo === 'MULTA');
    expect(multa.vencimento).toBe('2024-02-15');
    expect(res.body.resumo).toBeDefined();
    expect(res.body.resumo.total_original).toBe('1800.50');
    expect(res.body.resumo.total_atualizado).toBe('2355.93');
    expect(res.body.pagamentos).toBeDefined();
    expect(Array.isArray(res.body.pagamentos.opcoes)).toBe(true);
  });

  it('placa inválida ABC123 → HTTP 400 com { error: "invalid_plate" }', async () => {
    ({ app } = await buildApp([mockProvider([])]));

    const res = await request(app.getHttpServer())
      .post('/debts/simulate')
      .send({ placa: 'ABC123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_plate');
  });

  it('zero débitos → HTTP 200 com debitos: [], resumo zeros e opção TOTAL com valor_base "0.00"', async () => {
    ({ app } = await buildApp([mockProvider([])]));

    const res = await request(app.getHttpServer())
      .post('/debts/simulate')
      .send({ placa: 'ABC1234' });

    expect(res.status).toBe(200);
    expect(res.body.debitos).toEqual([]);
    expect(res.body.resumo.total_original).toBe('0.00');
    expect(res.body.resumo.total_atualizado).toBe('0.00');
    const total = res.body.pagamentos.opcoes.find((o: { tipo: string }) => o.tipo === 'TOTAL');
    expect(total).toBeDefined();
    expect(total.valor_base).toBe('0.00');
    const parciais = res.body.pagamentos.opcoes.filter((o: { tipo: string }) => o.tipo.startsWith('SOMENTE_'));
    expect(parciais).toHaveLength(0);
  });

  it('Provider A falha; Provider B disponível → HTTP 200 usando dados do Provider B', async () => {
    // Fake only Date (not timers) so retry's setTimeout still runs
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2024-05-10T00:00:00Z'));

    const debts: ProviderDebt[] = [
      { tipo: 'IPVA', valor_original: 1500.00, vencimento: '2024-01-10' },
    ];
    const providerA = mockProvider(new Error('timeout'));
    const providerB = mockProvider(debts);
    ({ app } = await buildApp([providerA, providerB]));

    const res = await request(app.getHttpServer())
      .post('/debts/simulate')
      .send({ placa: 'ABC1234' });

    expect(res.status).toBe(200);
    expect(res.body.debitos).toHaveLength(1);
    expect(res.body.debitos[0].tipo).toBe('IPVA');
  });

  it('todos os providers indisponíveis → HTTP 503 com { error: "all_providers_unavailable" }', async () => {
    const providerA = mockProvider(new Error('down'));
    const providerB = mockProvider(new Error('down'));
    ({ app } = await buildApp([providerA, providerB]));

    const res = await request(app.getHttpServer())
      .post('/debts/simulate')
      .send({ placa: 'ABC1234' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('all_providers_unavailable');
  });
});
