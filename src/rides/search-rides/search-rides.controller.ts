import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SearchRidesDto } from './search-rides.dto';
import { SearchRidesHandler } from './search-rides.handler';

@Controller('rides')
export class SearchRidesController {
  constructor(private readonly handler: SearchRidesHandler) {}

  /** 200 { requestId, results } · 400 validación · 401 sin token · 502 contrato roto · 503 matching-py caído */
  @Post('search')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  search(@CurrentUser() user: JwtPayload, @Body() dto: SearchRidesDto) {
    return this.handler.execute(user.sub, dto);
  }
}
