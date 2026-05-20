import { Module } from '@nestjs/common';
import { ProviderAAdapter } from './provider-a/provider-a.adapter';
import { ProviderBAdapter } from './provider-b/provider-b.adapter';
import { PROVIDERS_TOKEN } from './provider.port';

@Module({
  providers: [
    ProviderAAdapter,
    ProviderBAdapter,
    {
      provide: PROVIDERS_TOKEN,
      useFactory: (a: ProviderAAdapter, b: ProviderBAdapter) => [a, b],
      inject: [ProviderAAdapter, ProviderBAdapter],
    },
  ],
  exports: [PROVIDERS_TOKEN],
})
export class ProvidersModule {}
