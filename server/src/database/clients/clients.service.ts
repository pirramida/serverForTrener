import { Injectable } from '@nestjs/common';
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

  async deleteClient(phoneNumber: any): Promise<void> {
    try {
      const query = `DELETE FROM clients WHERE phone = ?`;
      await this.databaseService.query(query, [phoneNumber]);
      console.log(`Клиент с номером ${phoneNumber} успешно удален.`);
    } catch (error) {
      console.error(`Ошибка при удалении клиента с номером ${phoneNumber}:`, error);
      throw new HttpException('Не удалось удалить клиента', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async changeClient(phoneNumber: any, form: any): Promise<void> {
    try {
      // Получаем данные клиента по номеру телефона
      const changeClient = await this.databaseService.query('SELECT * FROM clients WHERE phone = ?', [phoneNumber]);
      
      // Проверяем, если клиент не найден
      if (changeClient.length === 0) {
        console.log(`Ошибка при изменении клиента с номером ${phoneNumber}: клиент не найден`);
        throw new HttpException(`Ошибка при изменении клиента с номером ${phoneNumber}: клиент не найден`, HttpStatus.BAD_REQUEST);
      }
  
      // Обновляем данные клиента
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
          bodyFat = ?
        WHERE phone = ?
      `;
  
      const values = [
        form.name,
        form.age,
        form.gender,
        form.photo,
        form.goal,
        form.activityLevel,
        form.injuries,
        JSON.stringify(form.trainingHistory),
        form.weight,
        form.height,
        form.chest,
        form.waist,
        form.hips,
        form.bodyFat,
        phoneNumber
      ];
  
      // Выполняем обновление
      await this.databaseService.run(query, values);
  
    } catch (error) {
      console.log(`Ошибка при изменении клиента с номером ${phoneNumber}:`, error);
      throw new HttpException(`Ошибка при изменении клиента с номером ${phoneNumber}:`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  

  addClient(form: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO clients (
          name, phone, age, gender, photo, goal, activityLevel, 
          injuries, trainingHistory, weight, height, chest, waist, hips, bodyFat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        form.bodyFat
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
