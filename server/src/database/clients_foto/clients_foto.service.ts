import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ClientsFotoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async savePhoto(file: Express.Multer.File, body: any) {
    const { clientsId, userId, folderId, type, isPrimary, comment } = body;
  
    // 🧱 Построим структуру: uploads/user-{userId}/client-{clientsId}/folder-{folderId}
    const uploadDir = path.join(
      __dirname,
      '..',
      '..',
      'uploads',
      `user-${userId}`,
      `client-${clientsId}`,
      `folder-${folderId}`
    );
  
    // 🛠️ Создадим директорию, если нет
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  
    // 💾 Сохраняем файл
    const filePath = path.join(uploadDir, file.originalname);
    fs.writeFileSync(filePath, file.buffer);
  
    // 🌐 Путь для клиента (URL)
    const url = `/uploads/user-${userId}/client-${clientsId}/folder-${folderId}/${file.originalname}`;
    const now = new Date().toISOString();
  
    // 📥 Вставка в БД
    await this.databaseService.run(
      `INSERT INTO clients_fotos (clientsId, userId, folderId, url, type, is_primary, uploaded_at, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientsId,
        userId,
        folderId || null,
        url,
        type,
        isPrimary === 'true',
        now,
        comment || null,
      ],
    );
  
    return { success: true, url };
  }
  
}
