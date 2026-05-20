## Contexto

Você deve implementar um serviço de consulta e simulação de pagamento de débitos
veiculares, integrando com múltiplos provedores externos. Cada provedor retorna os
mesmos dados, porém em formatos diferentes.
Utilize a linguagem que se sentir mais confortável. Importante: na apresentação do teste,
você deverá realizar modificações no projeto utilizando IA — então deixe seu ambiente
configurado e utilize a IA de sua preferência.

## Objetivo
Construir uma solução que:
Consulte múltiplos provedores externos
Normalize os dados em um modelo canônico
Calcule valores atualizados com juros (juros simples)
Simule formas de pagamento (PIX e cartão de crédito)
Permita pagamento total ou parcial (por tipo de débito)
Seja extensível para novos provedores e novos tipos de débito
Seja resiliente a falhas (fallback entre provedores)
Entrada
{
  "placa": "ABC1234"
}

Provedores simulados
Provedor A (JSON)
{
  "vehicle": "ABC1234",
  "debts": [
    { "type": "IPVA",  "amount": 1500.00, "due_date": "2024-01-10" },
    { "type": "MULTA", "amount":  300.50, "due_date": "2024-02-15" }
  ]
}

Provedor B (XML)
<response>
  <plate>ABC1234</plate>
  <debts>
    <debt><category>IPVA</category><value>1500.00</value><expiration>2024-01-10</expiration></debt>
    <debt><category>MULTA</category><value>300.50</value><expiration>2024-02-15</expiration></debt>
  </debts>
</response>
Nota — Quando o Provedor B não tiver débitos para a placa, o XML DEVE usar o elemento autofechado <debts/> (zero filhos).
Regras de Negócio
Considere (políticas globais)
Data atual fixa (UTC) para o teste: 2024-05-10T00:00:00Z. Use UTC para todas as comparações de data.
Política de juros: SIMPLES (não compostos).
Política de arredondamento: HALF_UP (meia unidade afastada do zero), 2 casas decimais para valores monetários.
Valores monetários no JSON de saída devem ser strings decimais (evita perda de precisão de float).
Tolerância nos exemplos: ±R$ 0,02 (arredondamentos intermediários podem variar).
1. Juros por atraso (juros simples)
IPVA
Taxa: 0,33% ao dia.
Teto: 20% do valor original. Aplicado ao valor de juros, NÃO ao total.
Fórmula: juros = min(valor × 0,0033 × dias_atraso, valor × 0,20).
Valor atualizado = valor_original + juros (arredondado HALF_UP, 2 casas).
Exemplo: 1.500,00 com 121 dias de atraso → juros = min(598,95, 300,00) = 300,00 → total = 1.800,00.
MULTA
Taxa: 1,00% ao dia.
Sem teto.
Fórmula: juros = valor × 0,01 × dias_atraso.
Exemplo: 300,50 com 85 dias de atraso → juros = 300,50 × 0,01 × 85 = 255,425 → 255,43 (HALF_UP) → total = 555,93.
Casos de borda
Débitos não vencidos (dias_atraso ≤ 0): juros = 0; valor_atualizado = valor_original.
Tipos de débito não previstos pelas regras acima devem causar erro HTTP 422 com payload {"error":"unknown_debt_type","type":"<TIPO>"}. Não silenciar, não converter para 'OUTROS'.
2. Pagamento
PIX
Desconto de 5% aplicado ao valor_base de CADA opção de pagamento (TOTAL e cada parcial), não somente ao TOTAL.
Fórmula: total_com_desconto = valor_base × 0,95, arredondado HALF_UP para 2 casas.
Cartão de crédito
Opções fixas: 1x, 6x e 12x (não devem aparecer outros valores).
1x (à vista): sem juros. valor_parcela = valor_base.
6x e 12x: amortização tipo Price (PMT) a 2,5% a.m. compostos.
Fórmula Price/PMT: valor_parcela = base × i × (1+i)^n / ((1+i)^n − 1), com i = 0,025.
Arredondamento HALF_UP, 2 casas decimais. Tolerância de ±R$ 0,02 nos valores de exemplo.
Saída esperada
Para a placa de teste ABC1234 (com os débitos dos provedores acima e data de referência 2024-05-10):
{
  "placa": "ABC1234",
  "debitos": [
    {
      "tipo": "IPVA",
      "valor_original": "1500.00",
      "valor_atualizado": "1800.00",
      "vencimento": "2024-01-10",
      "dias_atraso": 121
    },
    {
      "tipo": "MULTA",
      "valor_original": "300.50",
      "valor_atualizado": "555.93",
      "vencimento": "2024-02-15",
      "dias_atraso": 85
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
        "pix":  { "total_com_desconto": "2238.13" },
        "cartao_credito": {
          "parcelas": [
            { "quantidade":  1, "valor_parcela": "2355.93" },
            { "quantidade":  6, "valor_parcela":  "427.72" },
            { "quantidade": 12, "valor_parcela":  "229.67" }
          ]
        }
      },
      {
        "tipo": "SOMENTE_IPVA",
        "valor_base": "1800.00",
        "pix":  { "total_com_desconto": "1710.00" },
        "cartao_credito": {
          "parcelas": [
            { "quantidade":  1, "valor_parcela": "1800.00" },
            { "quantidade":  6, "valor_parcela":  "326.79" },
            { "quantidade": 12, "valor_parcela":  "175.48" }
          ]
        }
      },
      {
        "tipo": "SOMENTE_MULTA",
        "valor_base": "555.93",
        "pix":  { "total_com_desconto":  "528.13" },
        "cartao_credito": {
          "parcelas": [
            { "quantidade":  1, "valor_parcela":  "555.93" },
            { "quantidade":  6, "valor_parcela":  "100.93" },
            { "quantidade": 12, "valor_parcela":   "54.20" }
          ]
        }
      }
    ]
  }
}
Nota — Convenção de nomes: use sempre singular para o agrupamento parcial — SOMENTE_<TIPO> (p.ex. SOMENTE_IPVA, SOMENTE_MULTA, SOMENTE_LICENCIAMENTO). Mesmo que existam múltiplos débitos do mesmo tipo no input.
Requisitos
O sistema deve:
Suportar múltiplos provedores.
Fazer fallback caso um provedor falhe (tente o próximo na ordem configurada).
Isolar lógica de: integração / domínio (regras de negócio) / pagamento.
Ser fácil adicionar novos provedores e regras de juros.
Tratamento de erros estruturado:
HTTP 422 com {"error":"unknown_debt_type"} quando todos os débitos retornados são de tipo desconhecido.
HTTP 503 com {"error":"all_providers_unavailable"} quando TODOS os provedores falharem.
HTTP 400 com {"error":"invalid_plate"} para placa fora do padrão Mercosul/antigo.
Casos de borda (a serem cobertos por testes)
Zero débitos para a placa (provedor responde com lista vazia ou <debts/>).
Todos os provedores falham (timeout, indisponibilidade, erro).
Débito com tipo desconhecido (não IPVA nem MULTA).
Débito não vencido (dias_atraso ≤ 0): valor_atualizado = valor_original.
Placa fora do padrão (validação).
Provedores retornando dados divergentes para a mesma placa (descreva sua estratégia, mesmo que não a implemente).
Seria bacana se
Simular falha de provedor (timeout / indisponibilidade).
Implementar retry com backoff e/ou circuit breaker.
Ter testes automatizados (unitários + de integração para o fallback).
Demonstrar uso de logs estruturados (com mascaramento de placa para LGPD).
Explicar padrões utilizados (Strategy, Adapter, Ports & Adapters, etc.).
Limitar tamanho do corpo da requisição (ex.: 1 MiB) e rejeitar JSON com campos desconhecidos.
Não é necessário
Banco de dados.
Autenticação.
Interface gráfica.
