import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class SessionService {
  constructor(private readonly databaseService: DatabaseService) { }


  async getWriteOffHistory(): Promise<any[]> {
    try {
      const results = await this.databaseService.query('SELECT * FROM session_history') as any;

      return results.map((writeOff) => {
        const [datePart, timePart] = writeOff.date.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hours, minutes, seconds] = timePart.split(':');

        // Добавляем 3 часа
        const dateObj = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hours) + 3,
          Number(minutes),
          Number(seconds),
        );

        const newDate = dateObj.toLocaleDateString('ru-RU');
        const newTime = dateObj.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        }); // "чч:мм"

        return {
          ...writeOff,
          date: newDate,
          time: newTime,
        };
      });
    } catch (err) {
      console.error('Ошибка при получении истории списаний:', err.message);
      return [];
    }
  }

  async customGetPaymentHistory(clientId: number): Promise<any[]> {
    try {
      console.log('clientId', clientId)
      const response = await this.databaseService.query(
        'SELECT * FROM session_history WHERE clientId = ?',
        [clientId]
      );
      console.log('responseresponse', clientId)

      return response;
    } catch (err) {
      console.error('Ошибка при получении истории платежей:', err.message);
      return [];
    }
  }

}
