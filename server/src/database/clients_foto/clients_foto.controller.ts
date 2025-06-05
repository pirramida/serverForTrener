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
} from '@nestjs/common';
import { ClientsFotoService } from './clients_foto.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('clients_foto')
export class ClientsFotoController {
  constructor(private readonly clientsFotoService: ClientsFotoService) {}

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

  @Delete('delete-photos')
  async deletePhoto(@Body() body: { fotoId: number }) {
    return this.clientsFotoService.deletePhoto(body.fotoId);
  }

  @Get('get-photos')
  async getPhotos(@Query('folderId') folderId: number) {
    return this.clientsFotoService.getPhotos(Number(folderId));
  }

  
}
