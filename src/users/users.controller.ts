import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':userId')
  findOne(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.findOne(userId);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('update/:userId')
  update(@Param('userId', ParseIntPipe) userId: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.remove(userId);
  }
}
