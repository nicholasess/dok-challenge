# Regras De Negocio

Este documento e a fonte canonica operacional das regras de negocio do projeto. Antes de implementar dominio, provedores, pagamentos, validacoes ou tratamento de erros, leia este arquivo e mantenha codigo, testes e README alinhados com ele.

O `PRD.md` permanece como documento original do desafio. Se houver conflito entre o PRD e este arquivo, pare e confirme qual fonte deve prevalecer antes de implementar.

## 1. Visao Geral

O sistema e um servico de consulta e simulacao de pagamento de debitos veiculares.

Ele deve:

- Consultar multiplos provedores externos.
- Normalizar respostas diferentes em um modelo canonico.
- Calcular valores atualizados com juros.
- Simular pagamentos via PIX e cartao de credito.
- Permitir pagamento total ou parcial por tipo de debito.
- Ser extensivel para novos provedores e novos tipos de debito.
- Ser resiliente a falhas com fallback entre provedores.

## 2. Politicas Globais

- A data atual fixa para o teste e `2024-05-10T00:00:00Z`.
- Todas as comparacoes de data devem usar UTC.
- A politica de juros para debitos em atraso e simples.
- A excecao e o cartao de credito em `6x` e `12x`, que usa Price/PMT com juros compostos.
- A politica de arredondamento monetario e `HALF_UP`, com 2 casas decimais.
- Valores monetarios no JSON de saida devem ser strings decimais, por exemplo `"1800.00"`.
- `dias_atraso` e serializado como numero inteiro (ex: `121`), nunca como string.
- `quantidade` de parcelas e serializado como numero inteiro (ex: `6`), nunca como string.
- `vencimento` e serializado como string no formato `YYYY-MM-DD` (ex: `"2024-01-10"`).
- Exemplos aceitam tolerancia de `+- R$ 0,02` por diferencas de arredondamento intermediario.

## 3. Entrada E Validacao

A entrada principal e:

```json
{
  "placa": "ABC1234"
}
```

Regras:

- `placa` deve seguir o padrao brasileiro antigo ou Mercosul.
- Placa invalida deve retornar HTTP 400.
- Payload de placa invalida: `{ "error": "invalid_plate" }`.

Melhorias desejaveis:

- Rejeitar corpo maior que 1 MiB.
- Rejeitar JSON com campos desconhecidos.

## 4. Provedores

O sistema deve suportar multiplos provedores externos.

Provedores simulados do desafio:

- Provedor A retorna JSON.
- Provedor B retorna XML.

Regras:

- Os provedores podem retornar os mesmos dados em formatos diferentes.
- A aplicacao deve normalizar as respostas para um modelo canonico unico.
- Se um provedor falhar, a aplicacao deve tentar o proximo provedor na ordem configurada.
- Se todos os provedores falharem, retornar HTTP 503 com `{ "error": "all_providers_unavailable" }`.
- Para zero debitos, um provedor pode responder com lista vazia.
- Quando o Provedor B nao tiver debitos para a placa, o XML deve usar elemento autofechado.

## 5. Modelo Canonico De Debito

Campos esperados depois da normalizacao e do calculo:

| Campo | Tipo no JSON | Exemplo |
|---|---|---|
| `tipo` | string | `"IPVA"` |
| `valor_original` | string decimal | `"1500.00"` |
| `valor_atualizado` | string decimal | `"1800.00"` |
| `vencimento` | string `YYYY-MM-DD` | `"2024-01-10"` |
| `dias_atraso` | integer | `121` |

Tipos de debito suportados na primeira versao:

- `IPVA`
- `MULTA`

Tipos desconhecidos:

- Devem gerar erro HTTP 422.
- Nao devem ser silenciados.
- Nao devem ser convertidos para `OUTROS`.

## 6. Calculo De Atraso

- `dias_atraso` deve ser calculado entre a data de vencimento do debito e a data atual fixa `2024-05-10T00:00:00Z`.
- O calculo deve usar UTC.
- Se `dias_atraso <= 0`, o debito nao esta vencido.
- Debito nao vencido tem juros igual a `0`.
- Debito nao vencido mantem `valor_atualizado = valor_original`.

## 7. Regras De Juros

### IPVA

- Taxa diaria: `0,33%`.
- Teto de juros: `20%` do valor original.
- O teto se aplica ao valor dos juros, nao ao total.
- Formula: `juros = min(valor * 0.0033 * dias_atraso, valor * 0.20)`.
- Valor atualizado: `valor_original + juros`, arredondado com `HALF_UP` para 2 casas.

Exemplo:

- Valor original: `1500.00`.
- Dias de atraso: `121`.
- Juros calculado: `1500.00 * 0.0033 * 121 = 598.95`.
- Teto: `1500.00 * 0.20 = 300.00`.
- Juros aplicado: `300.00`.
- Valor atualizado: `1800.00`.

### MULTA

- Taxa diaria: `1,00%`.
- Sem teto de juros.
- Formula: `juros = valor * 0.01 * dias_atraso`.
- Valor atualizado: `valor_original + juros`, arredondado com `HALF_UP` para 2 casas.

Exemplo:

- Valor original: `300.50`.
- Dias de atraso: `85`.
- Juros: `300.50 * 0.01 * 85 = 255.425`.
- Juros arredondado: `255.43`.
- Valor atualizado: `555.93`.

## 8. Estrutura Da Resposta

Estrutura JSON completa da resposta:

```json
{
  "placa": "ABC1234",
  "debitos": [
    {
      "tipo": "IPVA",
      "valor_original": "1500.00",
      "valor_atualizado": "1800.00",
      "vencimento": "2024-01-10",
      "dias_atraso": 121
    }
  ],
  "resumo": {
    "total_original": "1800.50",
    "total_atualizado": "2355.93"
  },
  "pagamentos": {
    "opcoes": [
      {
        "tipo": "TOTAL",
        "valor_base": "2355.93",
        "pix": { "total_com_desconto": "2238.13" },
        "cartao_credito": {
          "parcelas": [
            { "quantidade": 1, "valor_parcela": "2355.93" },
            { "quantidade": 6, "valor_parcela": "427.72" },
            { "quantidade": 12, "valor_parcela": "229.67" }
          ]
        }
      }
    ]
  }
}
```

## 9. Resumo Dos Debitos

O resumo deve conter:

- `total_original`: soma dos valores originais.
- `total_atualizado`: soma dos valores atualizados.

Regras:

- Ambos devem ser strings decimais com 2 casas.
- O total atualizado deve considerar os juros aplicados por tipo de debito.

## 10. Opcoes De Pagamento

A resposta deve gerar opcoes de pagamento a partir dos debitos atualizados.

Regras:

- Sempre gerar a opcao `TOTAL`.
- Gerar uma opcao parcial por tipo de debito existente.
- Opcoes parciais devem usar o prefixo singular `SOMENTE_`.
- Exemplos: `SOMENTE_IPVA`, `SOMENTE_MULTA`, `SOMENTE_LICENCIAMENTO`.
- Mesmo que existam multiplos debitos do mesmo tipo, a opcao parcial continua singular.
- Cada opcao deve ter um `valor_base`.

## 11. PIX

Regras:

- Aplicar desconto de `5%` sobre o `valor_base`.
- O desconto se aplica a cada opcao de pagamento.
- O desconto deve aparecer tanto na opcao `TOTAL` quanto nas opcoes parciais.
- Formula: `total_com_desconto = valor_base * 0.95`.
- O resultado deve ser arredondado com `HALF_UP` para 2 casas.

## 12. Cartao De Credito

Parcelas permitidas:

- `1x`
- `6x`
- `12x`

Regras:

- Nao gerar outras quantidades de parcelas.
- `1x` nao tem juros.
- Em `1x`, `valor_parcela = valor_base`.
- `6x` e `12x` usam Price/PMT com juros compostos de `2,5% a.m.`.
- Formula: `valor_parcela = base * i * (1+i)^n / ((1+i)^n - 1)`.
- Na formula, `i = 0.025`.
- O valor da parcela deve ser arredondado com `HALF_UP` para 2 casas.

## 13. Erros De Negocio

Erros obrigatorios:

- HTTP 400 para placa invalida: `{ "error": "invalid_plate" }`.
- HTTP 422 para tipo desconhecido especifico: `{ "error": "unknown_debt_type", "type": "<tipo>" }`.
- HTTP 422 quando todos os debitos retornados forem de tipo desconhecido: `{ "error": "unknown_debt_type" }`.
- HTTP 503 quando todos os provedores falharem: `{ "error": "all_providers_unavailable" }`.

## 14. Divergencia Entre Provedores

Estrategia inicial:

- Usar o primeiro provedor disponivel conforme a ordem configurada.
- Nao combinar respostas divergentes entre provedores na primeira versao.
- Nao escolher automaticamente o maior ou menor valor entre provedores.
- Registrar divergencia entre provedores como melhoria futura caso multiplos provedores respondam com dados conflitantes.

## 15. Casos De Teste Obrigatorios

Cobrir no minimo:

- Placa `ABC1234` com IPVA e MULTA retorna os valores abaixo (data de referencia `2024-05-10`):

  ```json
  {
    "placa": "ABC1234",
    "debitos": [
      { "tipo": "IPVA",  "valor_original": "1500.00", "valor_atualizado": "1800.00", "vencimento": "2024-01-10", "dias_atraso": 121 },
      { "tipo": "MULTA", "valor_original": "300.50",  "valor_atualizado": "555.93",  "vencimento": "2024-02-15", "dias_atraso": 85  }
    ],
    "resumo": { "total_original": "1800.50", "total_atualizado": "2355.93" },
    "pagamentos": {
      "opcoes": [
        { "tipo": "TOTAL",        "valor_base": "2355.93", "pix": { "total_com_desconto": "2238.13" }, "cartao_credito": { "parcelas": [{ "quantidade": 1, "valor_parcela": "2355.93" }, { "quantidade": 6, "valor_parcela": "427.72" }, { "quantidade": 12, "valor_parcela": "229.67" }] } },
        { "tipo": "SOMENTE_IPVA",  "valor_base": "1800.00", "pix": { "total_com_desconto": "1710.00" }, "cartao_credito": { "parcelas": [{ "quantidade": 1, "valor_parcela": "1800.00" }, { "quantidade": 6, "valor_parcela": "326.79" }, { "quantidade": 12, "valor_parcela": "175.48" }] } },
        { "tipo": "SOMENTE_MULTA", "valor_base": "555.93",  "pix": { "total_com_desconto": "528.13"  }, "cartao_credito": { "parcelas": [{ "quantidade": 1, "valor_parcela": "555.93"  }, { "quantidade": 6, "valor_parcela": "100.93" }, { "quantidade": 12, "valor_parcela": "54.20"  }] } }
      ]
    }
  }
  ```
- Zero debitos retorna listas e totais coerentes.
- Todos os provedores falhando retorna HTTP 503.
- Tipo de debito desconhecido retorna HTTP 422.
- Debito nao vencido nao recebe juros.
- Placa invalida retorna HTTP 400.
- Fallback usa o proximo provedor quando o primeiro falha.
- PIX aplica desconto em `TOTAL` e nas opcoes parciais.
- Cartao gera somente `1x`, `6x` e `12x`.

Testes unitarios devem cobrir:

- Calculo de juros por tipo.
- Arredondamento `HALF_UP`.
- Simulacao PIX.
- Simulacao cartao Price.
- Normalizacao de provedores.
- Tratamento de tipos desconhecidos.

Testes e2e devem cobrir:

- Placa valida com debitos.
- Placa invalida.
- Zero debitos.
- Fallback entre provedores.
- Todos os provedores indisponiveis.

## 16. Fora Do Escopo

Nao implementar nesta versao:

- Banco de dados.
- Autenticacao.
- Interface grafica.
- Pagamento real.
