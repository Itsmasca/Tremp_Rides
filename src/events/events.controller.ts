import { Body, Controller, DefaultValuePipe, Get, HttpCode, MessageEvent, ParseIntPipe, Post, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PublishEventDto } from './dto/publish-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(202)
  async publish(@Body() dto: PublishEventDto) {
    const { id, occurredAt } = await this.events.publish(dto.type, dto.payload, dto.correlationId);
    return { id, occurredAt };
  }

  @Get()
  recent(@Query('count', new DefaultValuePipe(50), ParseIntPipe) count: number) {
    return this.events.recent(Math.min(Math.max(count, 1), 1000));
  }

  @Get('dlq')
  deadLetters(@Query('count', new DefaultValuePipe(50), ParseIntPipe) count: number) {
    return this.events.deadLetters(Math.min(Math.max(count, 1), 1000));
  }

  /** SSE: GET /events/stream?types=order.created,order.paid */
  @Sse('stream')
  stream(@Query('types') types?: string): Observable<MessageEvent> {
    const filter = types?.split(',').map((t) => t.trim()).filter(Boolean);
    return this.events.live(filter).pipe(map((event) => ({ id: event.id, type: event.type, data: event })));
  }
}
