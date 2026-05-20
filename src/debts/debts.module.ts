import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { InterestService } from './entities/interest.service';
import { PaymentsModule } from '../payments/payments.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [PaymentsModule, ProvidersModule],
  controllers: [DebtsController],
  providers: [DebtsService, InterestService],
})
export class DebtsModule {}
