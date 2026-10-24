import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateUserDto, VehicleDto } from './dto/create-user.dto';
import { ListUsersQuery } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/**
 * CRUD de la comunidad (spec 005).
 * Sin autenticación todavía: cuando exista, `:id` debe salir del token, no del path.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.delete(id);
  }

  @Put(':id/vehicle')
  setVehicle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VehicleDto) {
    return this.users.setVehicle(id, dto);
  }

  @Delete(':id/vehicle')
  @HttpCode(204)
  removeVehicle(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.removeVehicle(id);
  }
}
