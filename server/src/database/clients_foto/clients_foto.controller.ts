import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientsFotoService } from './clients_foto.service';

@Controller('clients_foto')
export class ClientsFotoController {
  constructor(private readonly clientsFotoService: ClientsFotoService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any, // тут придут все поля из FormData
  ) {
    return this.clientsFotoService.savePhoto(file, body);
  }
}
