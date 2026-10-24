import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ANY_EVENT, EVENT_HANDLER_METADATA } from './decorators/event-handler.decorator';
import { EventEnvelope } from './event.types';

type HandlerFn = (event: EventEnvelope) => unknown;

/** Descubre al arrancar todos los métodos decorados con @EventHandler. */
@Injectable()
export class EventHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(EventHandlerRegistry.name);
  private readonly handlers = new Map<string, HandlerFn[]>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object' || !wrapper.isDependencyTreeStatic()) continue;

      const prototype = Object.getPrototypeOf(instance);
      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const types = this.reflector.get<string[] | undefined>(EVENT_HANDLER_METADATA, prototype[method]);
        if (!types?.length) continue;

        const fn: HandlerFn = (event) => instance[method](event);
        for (const type of types) {
          this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
        }
        this.logger.log(`${instance.constructor.name}.${method} -> ${types.join(', ')}`);
      }
    }
  }

  resolve(type: string): HandlerFn[] {
    return [...(this.handlers.get(type) ?? []), ...(this.handlers.get(ANY_EVENT) ?? [])];
  }
}
