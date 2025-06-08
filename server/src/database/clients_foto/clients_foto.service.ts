import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ClientsFotoService {
  constructor(private readonly databaseService: DatabaseService) {}

  private baseFolderPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'uploads',
    'users',
  );

  async createFolder({
    userId,
    clientId,
    folderName,
  }: {
    userId: number;
    clientId: number;
    folderName: string;
  }) {
    const response = await this.databaseService.runTransaction(async () => {
      const createdAt = new Date().toISOString();

      const existing = await this.databaseService.query(
        `SELECT id FROM folders WHERE clientId = ? AND nameFolder = ?`,
        [clientId, folderName],
      );
      if (existing.length > 0) {
        throw new Error('Папка с таким именем уже существует');
      }

      // Вставка в БД
      await this.databaseService.query(
        `INSERT INTO folders (userId, clientId, nameFolder, created_at) VALUES (?, ?, ?, ?)`,
        [userId, clientId, folderName, createdAt],
      );

      // Получаем id только что созданной папки
      const result = (await this.databaseService.query(
        `SELECT id FROM folders WHERE userId = ? AND clientId = ? AND nameFolder = ? AND created_at = ? ORDER BY id DESC LIMIT 1`,
        [userId, clientId, folderName, createdAt],
      )) as any;

      const folderId = result?.[0]?.id;

      if (!folderId) {
        throw new Error('Не удалось получить ID новой папки из базы данных');
      }

      userId = 1;

      const folderPath = path.join(
        this.baseFolderPath,
        String(userId),
        'clients',
        String(clientId),
        'folders',
        String(folderId),
      );

      await fs.promises.mkdir(folderPath, { recursive: true });

      return { folderId };
    });
  }

  async updateFolderName({
    userId,
    clientId,
    folderId,
    newName,
  }: {
    userId: number;
    clientId: number;
    folderId: number;
    newName: string;
  }) {
    await this.databaseService.query(
      `UPDATE folders SET nameFolder = ? WHERE id = ? AND clientId = ?`,
      [newName, folderId, clientId],
    );

    return { success: true };
  }

  async deleteFolder(userId: number, clientId: number, folderId: number) {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        // Найдём имя папки в БД
        const rows = (await this.databaseService.query(
          `SELECT nameFolder FROM folders WHERE id = ? AND clientId = ?`,
          [folderId, clientId],
        )) as any[];

        const folderRecord = rows[0];
        console.log('Результат выборки из БД:', rows);
        console.log('clientId:', clientId, 'folderId:', folderId);

        if (!folderRecord?.nameFolder) throw new Error('Папка не найдена');

        const folderPath = path.join(
          __dirname,
          '..',
          '..',
          '..',
          'uploads',
          'users',
          String(userId),
          'clients',
          String(clientId),
          'folders',
          String(folderId),
        );

        // Удаление из БД
        await this.databaseService.run(`DELETE FROM folders WHERE id = ?`, [
          folderId,
        ]);
        await this.databaseService.run(
          `DELETE FROM clients_fotos WHERE folderId = ?`,
          [folderId],
        );

        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true });
        }

        return { success: true };
      });
    } catch (err) {
      console.error('Ошибка при удалении папки:', err);
      throw new Error('Ошибка удаления');
    }
  }

  async getFolders(clientId: number): Promise<{ id: number; name: string }[]> {
    try {
      const query = `SELECT id, nameFolder, counterPhoto FROM folders WHERE clientId = ?`;

      const rows = (await this.databaseService.query(query, [clientId])) as any;

      // Если результат null или не массив, возвращаем пустой массив
      if (!Array.isArray(rows)) {
        throw new Error('Неверный формат данных из базы');
      }

      return rows;
    } catch (error) {
      console.error('Ошибка при получении папок клиента:', error);
      throw new Error('Не удалось получить папки клиента');
    }
  }

 async uploadPhoto(
  {
    clientId,
    userId,
    folderId,
    originalName,
    type,
  }: {
    clientId: number;
    userId: number;
    folderId: number;
    originalName: string;
    type: string;
  },
  file: Express.Multer.File,
) {
  try {
    const fotoId = uuidv4();
    const createdAt = new Date().toISOString();
    userId = 1;

    const fotoFolder = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'users',
      String(userId),
      'clients',
      String(clientId),
      'folders',
      String(folderId),
    );

    const safeOriginalName = originalName || file.originalname || 'default.jpg';
    const ext = path.extname(safeOriginalName) || '.jpg';
    const fileName = `${fotoId}${ext}`;
    const filePath = path.join(fotoFolder, fileName);

    // Сначала сохраняем файл на диск вне транзакции
    await fs.promises.writeFile(filePath, file.buffer);

    // Далее начинается транзакция
    const response = await this.databaseService.runTransaction(async () => {
      await this.databaseService.query(
        `INSERT INTO clients_fotos 
         (clientsId, userId, folderId, url, type, is_primary, uploaded_at, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          userId,
          folderId,
          `/uploads/users/${userId}/clients/${clientId}/folders/${folderId}/${fileName}`,
          type,
          false,
          createdAt,
          null,
        ],
      );

      const querySelect = `SELECT counterPhoto FROM folders WHERE id = ?`;
      const rows = (await this.databaseService.query(querySelect, [folderId])) as any[];

      const currentCounter = rows?.[0]?.counterPhoto || 0;
      const newCounterPhoto = Number(currentCounter) + 1;

      const queryUpdate = `UPDATE folders SET counterPhoto = ? WHERE id = ?`;
      await this.databaseService.query(queryUpdate, [newCounterPhoto, folderId]);

      return {
        success: true,
        url: `/uploads/users/${userId}/clients/${clientId}/folders/${folderId}/${fileName}`,
      };
    });

    return response;
  } catch (error) {
    console.error('Ошибка при загрузке фото:', error);
    return {
      success: false,
      error: error.message || 'Ошибка при загрузке фото',
    };
  }
}


  async uploadPrimaryPhoto(
    {
      clientId,
      userId,
      type,
      originalName,
    }: {
      clientId: number;
      userId: number;
      type: string;
      originalName: string;
    },
    file: Express.Multer.File,
  ) {
    const fotoId = uuidv4();
    const createdAt = new Date().toISOString();

    const fotoFolder = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'uploads',
      'users',
      String(userId),
      'clients',
      String(clientId),
      'primaryPhotos',
    );

    // ✅ Создаем папку, если не существует
    await fs.promises.mkdir(fotoFolder, { recursive: true });

    const safeOriginalName = originalName || file.originalname || 'default.jpg';
    const ext = path.extname(safeOriginalName) || '.jpg';
    const fileName = `${fotoId}${ext}`;
    const filePath = path.join(fotoFolder, fileName);

    // ✅ Сохраняем файл
    await fs.promises.writeFile(filePath, file.buffer);

    // ✅ Записываем в базу
    await this.databaseService.query(
      `INSERT INTO clients_fotos 
     (clientsId, userId, folderId, url, type, is_primary, uploaded_at, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        userId,
        null,
        `/uploads/users/${userId}/clients/${clientId}/primaryPhotos/${fileName}`,
        type,
        1,
        createdAt,
        null,
      ],
    );

    return {
      success: true,
      fileName,
      url: `/uploads/users/${userId}/clients/${clientId}/primaryPhotos/${fileName}`,
      uploadedAt: createdAt,
    };
  }

  async deletePhoto(id: string) {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        console.log('Удаление фото по дате:', id);

        const rows = (await this.databaseService.query(
          `SELECT clientsId, folderId, url FROM clients_fotos WHERE id = ?`,
          [id],
        )) as any[];

        const record = rows[0];
        if (!record) {
          throw new Error('Фото не найдено');
        }

        const filePath = path.join(__dirname, '..', '..', '..', record.url);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await this.databaseService.run(
          `DELETE FROM clients_fotos WHERE id = ?`,
          [id],
        );

        if (record.folderId !== null) {
          const querySelect = `SELECT counterPhoto FROM folders WHERE id = ?`;

          const result = (await this.databaseService.query(querySelect, [
            record.folderId,
          ])) as any[];

          const counterPhoto = result[0]?.counterPhoto;

          if (!counterPhoto || Number(counterPhoto) === 0) {
            return { success: true };
          }

          const newCounterPhoto = Number(counterPhoto) - 1;

          const queryUpdate = `UPDATE folders SET counterPhoto = ? WHERE id = ?`;

          await this.databaseService.query(queryUpdate, [
            newCounterPhoto,
            record.folderId,
          ]);
        }

        return { success: true };
      });
    } catch (error) {
      console.error('Ошибка при удалении фото:', error);
      return { success: false, error: error.message || 'Ошибка удаления фото' };
    }
  }

  async getPhotos(folderId: number) {
    const rows = await this.databaseService.query(
      `SELECT * 
       FROM clients_fotos 
       WHERE folderId = ?`,
      [folderId],
    );

    console.log('rowsrowsrows', rows);
    return rows;
  }

  async getPrimaryPhotos(isPrimary: number, clientId: number, userId: number) {
    const rows = await this.databaseService.query(
      `SELECT * 
       FROM clients_fotos 
       WHERE is_primary = ? AND clientsId = ? AND userId = ?`,
      [isPrimary, clientId, userId],
    );

    console.log('rowsrowsrows', rows);
    return rows;
  }
}
