import { ApiProperty } from '@nestjs/swagger';
import { IsPlate } from '../../common/validation/plate.validator';

export class SimulateRequestDto {
  @ApiProperty({
    description: 'Placa do veículo no formato antigo (ABC1234) ou Mercosul (ABC1D23).',
    example: 'ABC1234',
  })
  @IsPlate()
  placa!: string;
}

export class CartaoParcelaDto {
  @ApiProperty({ example: 6 })
  quantidade!: number;

  @ApiProperty({ example: '427.72' })
  valor_parcela!: string;
}

export class PixDto {
  @ApiProperty({ example: '2238.13' })
  total_com_desconto!: string;
}

export class CartaoCreditoDto {
  @ApiProperty({ type: [CartaoParcelaDto] })
  parcelas!: CartaoParcelaDto[];
}

export class OpcaoPagamentoDto {
  @ApiProperty({ example: 'TOTAL', description: 'TOTAL ou SOMENTE_<TIPO>' })
  tipo!: string;

  @ApiProperty({ example: '2355.93' })
  valor_base!: string;

  @ApiProperty({ type: PixDto })
  pix!: PixDto;

  @ApiProperty({ type: CartaoCreditoDto })
  cartao_credito!: CartaoCreditoDto;
}

export class DebitoResponseDto {
  @ApiProperty({ example: 'IPVA' })
  tipo!: string;

  @ApiProperty({ example: '1500.00' })
  valor_original!: string;

  @ApiProperty({ example: '1800.00' })
  valor_atualizado!: string;

  @ApiProperty({ example: '2024-01-10' })
  vencimento!: string;

  @ApiProperty({ example: 121 })
  dias_atraso!: number;
}

export class ResumoDto {
  @ApiProperty({ example: '1800.50' })
  total_original!: string;

  @ApiProperty({ example: '2355.93' })
  total_atualizado!: string;
}

export class PagamentosDto {
  @ApiProperty({ type: [OpcaoPagamentoDto] })
  opcoes!: OpcaoPagamentoDto[];
}

export class SimulateResponseDto {
  @ApiProperty({ example: 'ABC1234' })
  placa!: string;

  @ApiProperty({ type: [DebitoResponseDto] })
  debitos!: DebitoResponseDto[];

  @ApiProperty({ type: ResumoDto })
  resumo!: ResumoDto;

  @ApiProperty({ type: PagamentosDto })
  pagamentos!: PagamentosDto;
}
