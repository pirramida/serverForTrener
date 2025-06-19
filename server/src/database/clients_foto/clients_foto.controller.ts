import {
  Controller,
  Post,
  Body,
  Delete,
  Put,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { ClientsFotoService } from './clients_foto.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/Auth.guard';

@Controller('clients_foto')
@UseGuards(JwtAuthGuard)
export class ClientsFotoController {
  jwtService: any;
  constructor(private readonly clientsFotoService: ClientsFotoService) { }

  @Post('create-folder')
  async createFolder(
    @Body() body: { userId: number; clientId: number; folderName: string },
  ) {
    return this.clientsFotoService.createFolder(body);
  }

  @Put('update-folder-name')
  async updateFolderName(
    @Body()
    body: {
      userId: number;
      clientId: number;
      folderId: number;
      newName: string;
    },
  ) {
    return this.clientsFotoService.updateFolderName(body);
  }

  @Delete('delete-folder')
  async deleteFolder(@Body() body: { userId: number; clientId: number; folderId: number }) {
    const { userId, clientId, folderId } = body;
    return this.clientsFotoService.deleteFolder(userId, clientId, folderId);
  }

  @Get('get-folders')
  async getFolders(@Query('clientId') clientId: number) {
    return this.clientsFotoService.getFolders(Number(clientId));
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      clientId: number;
      folderId: number;
      userId: number;
      originalName: string;
      type: string;
    },
  ) {
    return this.clientsFotoService.uploadPhoto(body, file);
  }

  @Post('upload-primary-photo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPrimaryPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      clientId: number;
      userId: number;
      type: string;
      originalName: string;
    },
  ) {
    return this.clientsFotoService.uploadPrimaryPhoto(body, file);
  }

  @Delete('delete-photos')
  async deletePhoto(@Body() body: { id: string }) {
    console.log('ididid', body.id);
    return this.clientsFotoService.deletePhoto(body.id);
  }


  @Get('get-photos')
  async getPhotos(@Query('folderId') folderId: number) {
    return this.clientsFotoService.getPhotos(Number(folderId));
  }

  @Get('get-primary-photos')
  async getPrimaryPhotos(
    @Query('isPrimary') isPrimary: number,
    @Query('clientId') clientId: number,
    @Query('userId') userId: number,
  ) {
    console.log(isPrimary, clientId, userId);
    return this.clientsFotoService.getPrimaryPhotos(isPrimary, clientId, userId);
  }



}
