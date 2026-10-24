import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EventHandlerRegistry } from './event-handler.registry';
import { EventsConsumer } from './events.consumer';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuditHandler } from './handlers/audit.handler';

@Module({
  imports: [DiscoveryModule],
  controllers: [EventsController],
  providers: [EventsService, EventHandlerRegistry, EventsConsumer, AuditHandler],
  exports: [EventsService],
})
export class EventsModule {}
