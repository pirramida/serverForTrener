import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class ClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getAllClients(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.databaseService.getDB().all('SELECT * FROM clients', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async customGet(clientId: number, nameColumn?: string): Promise<any> {

    const rows = await this.databaseService.query(
      `SELECT ${nameColumn} FROM clients WHERE id = ?`,
      [clientId],
    );
  
    if (!rows.length) {
      throw new NotFoundException('Клиент не найден');
    }
  
    const value = rows[0][nameColumn];
  
    // Если поле — parametrs (или любое поле с JSON), можно попробовать распарсить:
    if (typeof value === 'string') {
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          return JSON.parse(value);
        } catch {
          return value; // Если парсинг не удался, вернуть как есть
        }
      }
    
      return value; // Просто строка
    }
    
    return null; // или вернуть {}, [] — в зависимости от твоих ожиданий по умолчанию
    
  }
  

  async deleteClient(phoneNumber: any): Promise<void> {
    try {
      const query = `DELETE FROM clients WHERE phone = ?`;
      await this.databaseService.query(query, [phoneNumber]);
      console.log(`Клиент с номером ${phoneNumber} успешно удален.`);
    } catch (error) {
      console.error(
        `Ошибка при удалении клиента с номером ${phoneNumber}:`,
        error,
      );
      throw new HttpException(
        'Не удалось удалить клиента',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async changeParametrs(
    corrections: any,
    parameters: any,
    primary: any,
    clientId: number,
  ): Promise<any> {
    try {
      // Связка параметров с primary значениями
      const newPrimaryParametrs = parameters.map((param, index) => ({
        param,
        primary: primary[index],
      }));

      // Связка параметров с каждой коррекцией
      const newCorrectionsParametrs = corrections.map((corrRow) =>
        corrRow.map((value, index) => ({
          param: parameters[index],
          corr: value,
        })),
      );

      // Финальный объект
      const parametrs = {
        primary: newPrimaryParametrs,
        corrections: newCorrectionsParametrs,
      };

      await this.databaseService.query(
        'UPDATE clients SET parametrs = ? WHERE id = ?',
        [JSON.stringify(parametrs), clientId],
      );

      return true;
    } catch (error) {
      console.error(`Проблема с изменением параметров клиента`, error);
      throw new HttpException(
        'Проблема с изменением параметров клиента',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async changeClient(phoneNumber: any, form: any): Promise<any> {
    try {
      let newDataClient: any[] = [];

      await this.databaseService.runTransaction(async () => {
        // Получаем клиента
        const client = (await this.databaseService.query(
          'SELECT * FROM clients WHERE phone = ?',
          [phoneNumber],
        )) as any;

        if (client.length === 0) {
          throw new HttpException(
            `Ошибка при изменении клиента с номером ${phoneNumber}: клиент не найден`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const id = (client[0] as any).id;

        const query = `
          UPDATE clients SET
            name = ?, 
            age = ?, 
            gender = ?, 
            photo = ?, 
            goal = ?, 
            activityLevel = ?, 
            injuries = ?, 
            trainingHistory = ?, 
            weight = ?, 
            height = ?, 
            chest = ?, 
            waist = ?, 
            hips = ?, 
            bodyFat = ?,
            phone = ?,
            birthDate = ?
          WHERE id = ?
        `;

        if (client[0].birthDate !== form.dateOfBirth) {
          const birthDate = new Date(form.dateOfBirth);
          const today = new Date();

          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();

          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }

          form.age = age;
        }

        const values = [
          form.name,
          form.age,
          form.gender,
          form.photo,
          form.goal,
          form.activityLevel,
          form.injuries,
          form.trainingHistory,
          form.weight,
          form.height,
          form.chest,
          form.waist,
          form.hips,
          form.bodyFat,
          form.phone,
          form.dateOfBirth,
          id,
        ];

        await this.databaseService.run(query, values);

        // Получаем обновлённого клиента
        newDataClient = await this.databaseService.query(
          'SELECT * FROM clients WHERE id = ?',
          [id],
        );
      });

      return newDataClient;
    } catch (error) {
      console.error(
        `Ошибка при изменении клиента с номером ${phoneNumber}:`,
        error,
      );
      throw new HttpException(
        `Ошибка при изменении клиента с номером ${phoneNumber}: ${error.message || ''}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  addClient(form: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO clients (
          name, phone, age, gender, photo, goal, activityLevel, 
          injuries, trainingHistory, weight, height, chest, waist, hips, bodyFat, birthDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        form.name,
        form.phone,
        form.age,
        form.gender,
        form.photo, // null допустим
        form.goal,
        form.activityLevel,
        form.injuries,
        JSON.stringify(form.trainingHistory), // Массив -> строка
        form.weight,
        form.height,
        form.chest,
        form.waist,
        form.hips,
        form.bodyFat,
        form.birthDate,
      ];

      this.databaseService.getDB().run(query, values, (err) => {
        if (err) {
          console.error('Ошибка при добавлении клиента:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
