import { IsPlate } from '../../common/validation/plate.validator';

export class SimulateRequestDto {
  @IsPlate()
  placa!: string;
}

export interface CartaoParcelaDto {
  quantidade: number;
  valor_parcela: string;
}

export interface OpcaoPagamentoDto {
  tipo: string;
  valor_base: string;
  pix: { total_com_desconto: string };
  cartao_credito: { parcelas: CartaoParcelaDto[] };
}

export interface DebitoResponseDto {
  tipo: string;
  valor_original: string;
  valor_atualizado: string;
  vencimento: string;
  dias_atraso: number;
}

export interface SimulateResponseDto {
  placa: string;
  debitos: DebitoResponseDto[];
  resumo: {
    total_original: string;
    total_atualizado: string;
  };
  pagamentos: {
    opcoes: OpcaoPagamentoDto[];
  };
}
