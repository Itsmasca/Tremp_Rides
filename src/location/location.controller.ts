import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Put } from '@nestjs/common';
import { SetLocationDto } from './dto/set-location.dto';
import { LocationService } from './location.service';

/**
 * Ubicación efímera del usuario. Vive solo en Redis con TTL;
 * nunca se persiste en PostgreSQL (requisito de privacidad del producto).
 */
@Controller('location')
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Put(':userId')
  async set(@Param('userId') userId: string, @Body() dto: SetLocationDto) {
    return this.location.set(userId, dto);
  }

  @Get(':userId')
  async get(@Param('userId') userId: string) {
    const value = await this.location.get(userId);
    if (value === null) throw new NotFoundException();
    return value;
  }

  @Delete(':userId')
  @HttpCode(204)
  async clear(@Param('userId') userId: string) {
    await this.location.clear(userId);
  }
}
