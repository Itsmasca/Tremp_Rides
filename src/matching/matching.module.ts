import { Module } from '@nestjs/common';
import { MatchingClient } from './matching.client';

/** Cliente HTTP de matching-py (spec 010). No abre conexiones al arrancar: sin matching-py la API vive igual. */
@Module({
  providers: [MatchingClient],
  exports: [MatchingClient],
})
export class MatchingModule {}
