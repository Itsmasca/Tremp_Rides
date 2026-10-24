import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesService } from './preferences.service';

@Controller('users/:id/preferences')
export class PreferencesController {
  constructor(private readonly svc: PreferencesService) {}

  /**
   * GET /users/:id/preferences
   * Devuelve las preferencias actuales del usuario (pref_sexo_viaje + raw_text).
   */
  @Get()
  async getPreferences(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.svc.getPreferences(id);
    return {
      userId: row.id,
      prefSexoViaje: row.pref_sexo_viaje,
      rawText: row.raw_text,
      revision: row.preferences_revision,
    };
  }

  /**
   * PATCH /users/:id/preferences
   * Actualiza preferencias y dispara el evento preferences.updated en rides.events.
   * matching-py consumirá ese evento y extraerá la estructura con Bedrock.
   */
  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePreferences(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<void> {
    await this.svc.updatePreferences(id, dto);
  }
}
