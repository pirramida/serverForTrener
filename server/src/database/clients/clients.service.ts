import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

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
