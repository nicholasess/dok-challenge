import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DebtsService } from './debts.service';
import { BusinessError } from '../common/errors/business.errors';
import { SimulateRequestDto } from './dto/simulate.dto';

@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
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
