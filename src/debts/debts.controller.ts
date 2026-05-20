import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { BusinessError } from '../common/errors/business.errors';
import { SimulateRequestDto, SimulateResponseDto } from './dto/simulate.dto';

@ApiTags('debts')
@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simula opções de pagamento para débitos veiculares' })
  @ApiBody({ type: SimulateRequestDto })
  @ApiResponse({ status: 200, description: 'Simulação realizada com sucesso.', type: SimulateResponseDto })
  @ApiResponse({ status: 400, description: '`{ "error": "invalid_plate" }` — placa inválida.' })
  @ApiResponse({ status: 422, description: '`{ "error": "unknown_debt_type", "type": "<tipo>" }` — tipo de débito desconhecido.' })
  @ApiResponse({ status: 503, description: '`{ "error": "all_providers_unavailable" }` — todos os provedores indisponíveis.' })
  async simulate(@Body() body: SimulateRequestDto) {
    try {
      return await this.debtsService.simulate(body.placa);
    } catch (e) {
      if (e instanceof BusinessError) {
        if (e.code === 'all_providers_unavailable') {
          throw new HttpException(
            { error: e.code },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (e.code === 'unknown_debt_type') {
          const payload: Record<string, string> = { error: e.code };
          if (e.type) payload['type'] = e.type;
          throw new HttpException(payload, HttpStatus.UNPROCESSABLE_ENTITY);
        }
      }
      throw e;
    }
  }
}
