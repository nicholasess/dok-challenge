import { Module } from '@nestjs/common';
import { DebtsModule } from './debts/debts.module';

@Module({
  imports: [DebtsModule],
})
export class AppModule {}
