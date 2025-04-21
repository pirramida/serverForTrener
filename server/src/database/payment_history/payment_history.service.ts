import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class PaymentService {
    constructor(private readonly databaseService: DatabaseService) {}


      async getAllPaymentHistory(): Promise<any[]> {
        try {
          return await this.databaseService.query('SELECT * FROM payment_history');
        } catch (err) {
          console.error('Ошибка при получении истории платежей:', err.message);
          return [];
        }
      }

      async postNewPaymentHistory(fromData: any): Promise<any> {
        try {
          const {
            id,
            date,
            client,
            amount,
            type,
            status,
            dateTo,
            customPaymentType,
            isExpiryDateManuallySet,
            notes,
            phone,
            method,
          } = fromData;
      
          const query = `
            INSERT INTO payment_history (
              unique_id, date, client, amount, type, status, dateTo, customPaymentType,
              isExpiryDateManuallySet, notes, phone, method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
      
          await this.databaseService.run(query, [
            id,
            date,
            client,
            amount,
            type,
            status,
            dateTo,
            customPaymentType,
            isExpiryDateManuallySet,
            notes,
            phone,
            method,
          ]);

          let sessionCount;
          
          if (type === 'Другое') { sessionCount = extractSessionCount(customPaymentType);}
          else { sessionCount = extractSessionCount(type); }

          const result = await this.databaseService.run(
            'UPDATE clients SET sessions = COALESCE(sessions, 0) + ? WHERE name = ?',
            [sessionCount, client]
          );
          

          return { success: true, message: 'Платеж успешно добавлен!' };
        } catch (error) {
          console.error('Произошла неудача при внесении транзакции в приложение ', error);
          throw new HttpException(
            'Произошла лютая ошибка при внесении данных о транзакции в базу данных!',
            HttpStatus.INTERNAL_SERVER_ERROR
          );
        }
      }
      
      


      
}

function extractSessionCount(input: any): number {
  if (!input) return 0;

  if (typeof input === 'number') {
    return input;
  }

  if (typeof input === 'string') {
    const lower = input.toLowerCase();

    if (lower.includes('разовая')) return 1;

    const match = lower.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }

  return 0;
}
