import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class PaymentService {
    constructor(private readonly databaseService: DatabaseService) {}


      async getAllPaymentHistory(): Promise<any[]> {
        try {
          return await this.databaseService.query('SELECT * FROM payment_history ORDER BY date DESC');
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
              id, date, client, amount, type, status, dateTo, customPaymentType,
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