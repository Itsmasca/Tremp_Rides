import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LocationModule } from '../location/location.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/** DatabaseModule y RedisModule son @Global(). */
@Module({
  imports: [EventsModule, LocationModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
