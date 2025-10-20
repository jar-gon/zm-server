import { Controller, Get, Post, Delete, Body, Patch, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Roles } from 'src/common/decorators/public.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';

@Controller('user')
@ApiTags('用户接口')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建用户', description: '' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles(['admin'])
  @ApiOperation({ summary: '查询列表', description: '' })
  findAllPaginate(@Body() searchUserDto: SearchUserDto) {
    return this.userService.findAllPaginate(searchUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询详情', description: '' })
  findOne(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改', description: '' })
  update(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除', description: '' })
  async remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.userService.remove(id);
  }
}
