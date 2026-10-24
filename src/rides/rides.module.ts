import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { SearchRidesController } from './search-rides/search-rides.controller';
import { SearchRidesHandler } from './search-rides/search-rides.handler';
import { SearchRidesQueries } from './search-rides/search-rides.queries';

/** Slices de viajes. Por ahora sólo búsqueda (spec 010); create/get/list llegan con la 006 (T9–T12). */
@Module({
  imports: [AuthModule, MatchingModule],
  controllers: [SearchRidesController],
  providers: [SearchRidesHandler, SearchRidesQueries],
})
export class RidesModule {}
