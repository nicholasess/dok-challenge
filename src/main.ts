import { NestFactory } from '@nestjs/core';
import { HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '1mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const constraint = Object.keys(errors[0]?.constraints ?? {})[0] ?? 'validation_error';
        return new HttpException({ error: constraint }, HttpStatus.BAD_REQUEST);
      },
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('dok — API de Simulação de Débitos Veiculares')
    .setDescription(
      'Consulta provedores externos, aplica regras de juros e retorna opções de pagamento (PIX e cartão de crédito) para débitos veiculares.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
