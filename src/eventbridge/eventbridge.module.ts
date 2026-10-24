import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EVENTBRIDGE_CLIENT } from './eventbridge.constants';
import { EventBridgeHandler } from './eventbridge.handler';
import { EventBridgePublisher } from './eventbridge.publisher';

/** Se importa vía `ConditionalModule` sólo si EVENTBRIDGE_ENABLED=true. */
@Module({
  providers: [
    {
      provide: EVENTBRIDGE_CLIENT,
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { region, endpoint } = config.get('eventBridge', { infer: true });
        // Credenciales: cadena por defecto del SDK (rol IAM, perfil o variables AWS_*).
        return new EventBridgeClient({ region, endpoint });
      },
      inject: [ConfigService],
    },
    EventBridgePublisher,
    EventBridgeHandler,
  ],
})
export class EventBridgeModule {}
