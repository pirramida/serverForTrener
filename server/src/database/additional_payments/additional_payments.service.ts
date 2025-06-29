import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class additionalPaymentsService {
  constructor(private readonly databaseService: DatabaseService) { }

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

  async postNewAdditionalPayments(body: any) {
    try {
      const {
        isOurClient,
        client_id,
        amount,
        incomeType,
        comment,
        date,
        client_name,
        userId,
      } = body;
      await this.databaseService.runTransaction(async () => {

        if (isOurClient) {
          await this.databaseService.query(
            `INSERT INTO additional_payments
         (client_id, amount, income_type, comment, created_at, client_name, is_our_client, userId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [client_id, amount, incomeType, comment, date, client_name, isOurClient ? 1 : 0, userId]
          );
        } else {
          await this.databaseService.query(
            `INSERT INTO additional_payments
         (client_id, amount, income_type, comment, created_at, external_client_name, is_our_client, userId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [null, amount, incomeType, comment, date, client_name, isOurClient ? 1 : 0, userId]
          );
        }

        await this.databaseService.query(
          `UPDATE users SET totalAdditionalPyments = totalAdditionalPyments + ?, additionalPymentsInMonth = additionalPymentsInMonth + ? WHERE id = ?`,
          [Number(amount), Number(amount), userId]
        );
      });
    } catch (error) {
      console.error('Ошибка при сохранении дополнительной оплаты:', error);
      throw new Error('Ошибка при сохранении дополнительной оплаты');
    }
  }


}
