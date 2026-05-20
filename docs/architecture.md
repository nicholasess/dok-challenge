# Arquitetura Tecnica

Este documento descreve a arquitetura tecnica prevista para o servico NestJS de consulta e simulacao de pagamento de debitos veiculares.

Use `docs/business-rules.md` como fonte canonica das regras de negocio. Este arquivo explica onde cada responsabilidade deve viver no codigo e como as partes devem se conectar.

## 1. Overview

O sistema e um backend NestJS que:

- Recebe uma placa de veiculo.
- Consulta provedores externos simulados.
- Normaliza respostas diferentes para um modelo canonico.
- Calcula valores atualizados de debitos.
- Simula formas de pagamento por PIX e cartao de credito.
- Permite pagamento total ou parcial por tipo de debito.

Fora do escopo do projeto:

- Banco de dados.
- Autenticacao.
- Interface grafica.
- Pagamento real.

## 2. Architectural Style

A arquitetura recomendada e **Ports & Adapters** com modulos NestJS organizados por responsabilidade.

Padroes usados:

- **Ports & Adapters**: separa dominio e casos de uso das integracoes externas.
- **Adapter**: traduz respostas dos provedores A e B para o modelo canonico.
- **Strategy**: isola regras de juros por tipo de debito.
- **Application Service**: orquestra validacao, consulta de provedores, fallback, calculos e montagem da resposta.

Camadas (logicas, nao pastas raiz):

- **API**: recebe a requisicao HTTP, valida formato basico e traduz erros para HTTP. Vive nos controllers e DTOs de cada feature.
- **Application**: executa o caso de uso principal de simulacao. Vive nos services de feature (`debts.service.ts`).
- **Domain**: contem regras puras de debitos, juros, arredondamento e pagamentos. Vive em `entities/` dentro de cada feature e em `payments/`.
- **Providers**: integra e adapta provedores externos simulados. Vive em `providers/` com porta explicita e adapters isolados.
- **Common**: concentra utilitarios compartilhados sem dependencia de NestJS. Vive em `common/` organizado por responsabilidade.

## 3. Module Structure

Estrutura recomendada para a evolucao do projeto:

```text
src/
  debts/
    dto/                        <- API layer: request/response shapes
    entities/                   <- Domain layer: modelos canonicos
    debts.controller.ts         <- API layer: routing, parsing, HTTP errors
    debts.service.ts            <- Application layer: orquestracao do caso de uso
    debts.module.ts
  payments/
    payments.service.ts         <- Domain layer: calculo PIX e Price/PMT
    payments.module.ts
  providers/
    provider.port.ts            <- Porta explicita: interface IProvider
    provider-a/
      provider-a.adapter.ts     <- Adapter: JSON -> modelo canonico
    provider-b/
      provider-b.adapter.ts     <- Adapter: XML -> modelo canonico
    providers.module.ts
  common/
    money/
      money.util.ts             <- HALF_UP, serializacao decimal
    date/
      date.util.ts              <- data fixa, calculo de dias em UTC
    errors/
      business.errors.ts        <- erros de dominio sem dependencia de NestJS
    validation/
      plate.validator.ts        <- regex placa antiga e Mercosul
```

Responsabilidades por pasta:

- `debts/`: unico modulo com controller. Contem API, Application e Domain de debitos. A fronteira entre camadas e comunicada pelas subpastas e pelo nome dos arquivos.
- `payments/`: servico de dominio puro para calculo de pagamentos. Sem controller proprio. Exportado como dependencia de `debts/`.
- `providers/`: porta mais adapters. `provider.port.ts` define a interface `IProvider` que os adapters implementam. Nenhum adapter depende de HTTP ou de NestJS diretamente.
- `common/`: utilitarios sem estado e sem dependencia de NestJS, organizados por responsabilidade. Nao e um modulo NestJS — seus arquivos sao importados diretamente.

O `AppModule` deve registrar `DebtsModule`, `PaymentsModule` e `ProvidersModule`. Evite concentrar comportamento real em `app.controller.ts`, `app.service.ts` ou `app.module.ts`.

## 4. Request Flow

Endpoint previsto para a primeira versao:

```http
POST /debts/simulate
```

Entrada:

```json
{
  "placa": "ABC1234"
}
```

Fluxo:

1. API recebe a requisicao.
2. API valida se a placa segue o padrao brasileiro antigo ou Mercosul. Placa invalida retorna HTTP 400 imediatamente.
3. Application Service consulta os provedores na ordem configurada.
4. Se um provedor falhar, tenta o proximo.
5. Se todos falharem, retorna HTTP 503 com `all_providers_unavailable`.
6. O primeiro provedor disponivel fornece os dados usados na simulacao.
7. Adapter do provedor normaliza a resposta para `ProviderDebt[]`.
8. Application Service valida os tipos de debito normalizados. Tipo desconhecido retorna HTTP 422 com `unknown_debt_type`. Tipos nao devem ser silenciados nem convertidos para `OUTROS`.
9. Domain calcula dias de atraso, juros e valores atualizados por tipo.
10. Payment monta opcoes `TOTAL` e `SOMENTE_<TIPO>` com PIX e cartao.
11. API serializa o resultado: valores monetarios como strings decimais com 2 casas, `dias_atraso` e `quantidade` como inteiros, `vencimento` como string `YYYY-MM-DD`.

## 5. Naming Conventions

O projeto usa `snake_case` de forma consistente em todo o codigo TypeScript interno.

### Justificativa

O contrato da API ja e `snake_case` (conforme `docs/business-rules.md`). Adotar `camelCase` internamente exigiria uma camada de transformacao nos DTOs que nao agrega valor: seria retrabalho puro para converter de volta ao mesmo formato.

### Regra geral

Variaveis locais, parametros de funcao e propriedades de interface e classe usam `snake_case`:

```typescript
// parametros
function calcularJuros(valor_original: number, dias_atraso: number): InterestResult

// variaveis locais
const valor_atualizado = valor_original + juros;
const total_com_desconto = roundHalfUp(valor_base * 0.95);

// propriedades de interface
interface ProviderDebt {
  tipo: string;
  valor_original: number;
  vencimento: string;
}

interface CartaoParcela {
  quantidade: number;
  valor_parcela: string;
}
```

### Excecao: fronteiras externas nao controladas

Transformacao de nomenclatura ocorre apenas nos adapters de provedores externos, onde o formato de entrada nao e controlado pelo projeto:

- `provider-a.adapter.ts`: normaliza os campos do JSON do Provedor A para `ProviderDebt` em `snake_case`.
- `provider-b.adapter.ts`: normaliza os campos do XML do Provedor B para `ProviderDebt` em `snake_case`.

### Nomes de classes, metodos e arquivos

- Classes: `PascalCase` (ex: `DebtsService`, `InterestService`).
- Metodos e funcoes: `camelCase` (ex: `calcularJuros`, `montarOpcoes`).
- Arquivos: `kebab-case` com sufixo de papel (ex: `debts.service.ts`, `provider-a.adapter.ts`).

---

## 6. Domain Model

Objetos principais:

- `Debt`: debito canonico original, com tipo, valor original e vencimento.
- `UpdatedDebt`: debito com dias de atraso e valor atualizado.
- `ProviderDebt`: debito normalizado vindo de um provider adapter antes do calculo de dominio.
- `PaymentOption`: opcao de pagamento total ou parcial, com PIX e parcelas de cartao.
- `SimulationResult`: resposta final da simulacao para a placa consultada.

Regras de modelagem:

- Valores monetarios devem usar uma biblioteca de precisao decimal (ex: `decimal.js`) para evitar perda de float. Arredondamento deve ser `HALF_UP` com 2 casas. A logica centralizada vive em `common/money/money.util.ts`.
- Valores monetarios internos sao `number`. Na serializacao JSON tornam-se strings decimais com 2 casas, nunca `number`.
- `dias_atraso` e serializado como inteiro (`number`) no JSON; nunca como string.
- `quantidade` de parcelas e sempre inteiro (`number`), nunca string.
- `vencimento` trafega como string `YYYY-MM-DD` em todo o ciclo (provider, dominio e JSON); nunca como objeto Date.
- Datas de vencimento devem ser comparadas em UTC. A data atual fixa `2024-05-10T00:00:00Z` deve ser lida de `common/date/date.util.ts`, nunca hardcoded em services ou adapters.
- Tipos de debito suportados inicialmente: `IPVA` e `MULTA`. Tipos desconhecidos devem ser rejeitados com HTTP 422 na camada de Application, antes do calculo de dominio.

## 7. Provider Integration

A integracao com provedores deve depender de uma porta comum definida em `providers/provider.port.ts`.

Contrato da interface `IProvider`:

- Recebe uma placa.
- Retorna debitos normalizados para o dominio (`ProviderDebt[]`).
- Pode falhar por timeout, indisponibilidade ou erro de formato.
- Nao decide status HTTP.

Adapters:

- `provider-a/provider-a.adapter.ts`: implementa `IProvider`, adapta resposta JSON. Campos de entrada: `type`, `amount`, `due_date`. Mapeados para `tipo`, `valor_original`, `vencimento`.
- `provider-b/provider-b.adapter.ts`: implementa `IProvider`, adapta resposta XML. Estrutura: `<response><plate>…</plate><debts><debt><category>…</category><value>…</value><expiration>…</expiration></debt></debts></response>`. Campos de entrada: `category`, `value`, `expiration`. Mapeados para `tipo`, `valor_original`, `vencimento`. Deve tratar `<debts/>` (elemento autofechado) como lista vazia.

Fallback:

- Os provedores sao chamados na ordem configurada.
- A primeira resposta disponivel e valida deve ser usada.
- Se um provedor falhar, a aplicacao tenta o proximo.
- Se todos falharem, a aplicacao retorna HTTP 503 com `{ "error": "all_providers_unavailable" }`.

Divergencia entre provedores:

- A primeira versao usa o primeiro provedor disponivel.
- Nao combina respostas de provedores diferentes.
- Nao escolhe automaticamente maior ou menor valor.
- Comparacao e conciliacao entre provedores ficam como melhoria futura.

## 8. Business Rules Ownership

As regras detalhadas de negocio vivem em `docs/business-rules.md`.

Este documento de arquitetura define onde as responsabilidades devem ficar no codigo, mas nao deve substituir as regras de negocio.

Em caso de conflito:

- `docs/business-rules.md` vence para comportamento de dominio.
- `docs/architecture.md` vence apenas para organizacao tecnica, se nao contrariar as regras de negocio.
- Se o conflito afetar implementacao, pare e confirme qual fonte deve prevalecer.

## 9. Error Handling

Erros devem ser estruturados e previsiveis.

Mapeamento esperado:

- `invalid_plate` -> HTTP 400 com `{ "error": "invalid_plate" }`.
- `unknown_debt_type` -> HTTP 422 com `{ "error": "unknown_debt_type" }`.
- `unknown_debt_type` com tipo especifico -> HTTP 422 com `{ "error": "unknown_debt_type", "type": "<tipo>" }`.
- `all_providers_unavailable` -> HTTP 503 com `{ "error": "all_providers_unavailable" }`.

Diretrizes:

- Erros de dominio e aplicacao devem ser convertidos para HTTP na camada de API.
- Providers nao devem decidir status HTTP.
- Domain nao deve depender de classes HTTP do NestJS.

## 10. Testing Strategy

Testes unitarios:

- Calculo de juros por tipo de debito (IPVA com teto, MULTA sem teto).
- Debito nao vencido nao recebe juros (`valor_atualizado = valor_original`).
- Arredondamento `HALF_UP` com 2 casas decimais.
- Simulacao PIX aplica desconto de 5% na opcao `TOTAL` e em cada opcao `SOMENTE_<TIPO>`.
- Simulacao de cartao gera somente `1x`, `6x` e `12x` (nenhuma outra parcela).
- Simulacao de cartao `1x` sem juros; `6x` e `12x` com Price/PMT a `2,5% a.m.`.
- Validacao de placa: formato antigo e Mercosul validos; formatos invalidos rejeitados.
- Normalizacao do Provedor A (JSON) para modelo canonico.
- Normalizacao do Provedor B (XML) para modelo canonico, incluindo lista vazia com elemento autofechado.
- Tratamento de tipo de debito desconhecido retorna erro sem silenciar ou converter.

Testes de integracao:

- Fallback usa o proximo provedor quando o primeiro falha.
- Erro `all_providers_unavailable` quando todos os provedores falham.
- Zero debitos retorna listas vazias e totais coerentes (JSON e XML).

Testes e2e:

- `POST /debts/simulate` com placa valida e debitos retorna valores esperados (IPVA + MULTA).
- `POST /debts/simulate` com placa invalida retorna HTTP 400.
- `POST /debts/simulate` com zero debitos retorna estrutura valida.
- `POST /debts/simulate` com fallback entre provedores usa o segundo quando o primeiro falha.
- `POST /debts/simulate` com todos os provedores indisponiveis retorna HTTP 503.

## 11. Operational Notes

Logs:

- Usar logs estruturados quando possivel.
- Mascarar placa em logs para reduzir exposicao de dados pessoais.
- Nao registrar payloads sensiveis completos.

Melhorias futuras:

- Retry com backoff para provedores instaveis.
- Circuit breaker para provedores indisponiveis.
- Limite de corpo de requisicao em 1 MiB.
- Rejeicao de JSON com campos desconhecidos.
- Observabilidade basica para falhas de provedores.
