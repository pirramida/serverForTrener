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

  async changeSessionsClient(client: { name: string; phone: string }): Promise<any> {
    try {
      // 1. Получаем ID пакета из sessionQueue клиента
      const currentSessionQueueQuery = `
        SELECT sessionQueue FROM clients WHERE name = ? AND phone = ?
      `;
      const result: { sessionQueue: string | null }[] = await this.databaseService.query(currentSessionQueueQuery, [client.name, client.phone]);
  
      // Проверяем, существует ли результат и содержит ли он sessionQueue
      const currentQueue = result.length > 0 && result[0].sessionQueue
        ? JSON.parse(result[0].sessionQueue) // Если sessionQueue существует, парсим его
        : []; // Иначе возвращаем пустой массив
  
      // Получаем ID первого пакета из очереди
      const firstPackageId = currentQueue.length > 0 ? currentQueue[0].id : null;
      if (!firstPackageId) {
        throw new Error('Нет пакетов в очереди для списания');
      }
  
      // 2. Получаем текущий пакет из payment_history
      const packageQuery = `
        SELECT quantityLeft, status FROM payment_history WHERE unique_id = ?
      `;
      const packageResult: { quantityLeft: number; status: string }[] = await this.databaseService.query(packageQuery, [firstPackageId]);
  
      // Проверяем, что результат не пустой
      if (packageResult.length === 0) {
        throw new Error('Пакет не найден в payment_history');
      }
  
      // Деструктурируем quantityLeft и status из первого элемента результата
      const { quantityLeft, status } = packageResult[0];
  
      // 3. Уменьшаем количество тренировок (quantityLeft)
      let updatedQuantityLeft = quantityLeft - 1;
  
      // Если количество тренировок стало 0, меняем статус на "Не активен"
      if (updatedQuantityLeft === 0 && status !== 'Не активен') {
        // Обновляем статус пакета в payment_history
        await this.databaseService.query(
          `
          UPDATE payment_history 
          SET quantityLeft = ?, status = 'Не активен'
          WHERE unique_id = ?
          `,
          [updatedQuantityLeft, firstPackageId]
        );
  
        // 4. Удаляем ID текущего пакета из очереди в clients
        const updatedQueue = currentQueue.slice(1); // Удаляем первый элемент из очереди
        const updatedQueueString = JSON.stringify(updatedQueue); // Преобразуем в строку
  
        // Обновляем sessionQueue клиента
        await this.databaseService.query(
          `
          UPDATE clients
          SET sessionQueue = ?
          WHERE name = ? AND phone = ?
          `,
          [updatedQueueString, client.name, client.phone]
        );
      } else {
        // Если тренировка не последняя, просто обновляем количество оставшихся тренировок
        await this.databaseService.query(
          `
          UPDATE payment_history 
          SET quantityLeft = ?
          WHERE unique_id = ?
          `,
          [updatedQuantityLeft, firstPackageId]
        );
      }
  
      // 5. Обновляем количество сессий у клиента
      await this.databaseService.query(
        `
        UPDATE clients
        SET sessions = CASE 
            WHEN sessions > 0 THEN sessions - 1 
            ELSE 0 
        END
        WHERE name = ? AND phone = ?
        `,
        [client.name, client.phone]
      );
  
      // 6. Записываем историю сессий
      await this.databaseService.query(
        `
        INSERT INTO session_history (name, phone, action)
        VALUES (?, ?, ?)
        `,
        [client.name, Number(client.phone), 'Списание тренировки']
      );
  
      // 7. Возвращаем обновленную информацию
      const response = await this.databaseService.query(
        'SELECT quantity, quantityLeft FROM payment_history WHERE unique_id = ?',
        [firstPackageId]
      );
  
      return response;
    } catch (error) {
      console.error('Произошла ошибка в процессе выполнения:', error);
      throw error;
    }
  }
  

  async getQuantity(client: any): Promise<any[]> {
    try {
      console.log(client);
      const currentSessionQueueQuery = `
        SELECT sessionQueue FROM clients WHERE name = ? AND phone = ? AND id = ?
      `;
      const result: { sessionQueue: string | null }[] = await this.databaseService.query(currentSessionQueueQuery, [client.name, client.phone, client.id]);
      console.log(result)
      // Проверяем, существует ли результат и содержит ли он sessionQueue
      const currentQueue = result.length > 0 && result[0].sessionQueue
        ? JSON.parse(result[0].sessionQueue) // Если sessionQueue существует, парсим его
        : []; // Иначе возвращаем пустой массив
        console.log(currentQueue)

      // Получаем ID первого пакета из очереди
      const firstPackageId = currentQueue.length > 0 ? currentQueue[0].id : null;
      if (!firstPackageId) {
        throw new Error('Нет пакетов в очереди для списания');
      }
   

      return await this.databaseService.query('SELECT quantity, quantityLeft, dateTo FROM payment_history WHERE unique_id = ?', [firstPackageId]);
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
  
      // 1. Вставляем запись в payment_history
      const query = `
        INSERT INTO payment_history (
          unique_id, date, client, amount, type, status, dateTo, customPaymentType,
          isExpiryDateManuallySet, notes, phone, method, quantity, quantityLeft
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      let sessionCount;
      if (type === 'Другое') {
        sessionCount = extractSessionCount(customPaymentType);
      } else {
        sessionCount = extractSessionCount(type);
      }
  
      // Вставка в payment_history
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
        sessionCount,
        sessionCount,
      ]);
  
      // 2. Получаем текущий sessionQueue клиента
      const currentSessionQueueQuery = `
        SELECT sessionQueue FROM clients WHERE name = ? AND phone = ?
      `;
  
      const result: { sessionQueue: string | null }[] = await this.databaseService.query(currentSessionQueueQuery, [client, phone]);
  
      // Проверяем, существует ли результат и содержит ли он sessionQueue
      const currentQueue = result.length > 0 && result[0].sessionQueue
        ? JSON.parse(result[0].sessionQueue) // Если sessionQueue существует, парсим его
        : []; // Иначе возвращаем пустой массив
  
      // 3. Добавляем новый пакет в sessionQueue
      const newPackage = {
        id: id,
        dateTo: dateTo, // Срок окончания нового пакета
      };
  
      // 4. Если количество сессий = 1, добавляем эту тренировку в начало массива, иначе — в конец
      let updatedQueue: any[];
  
      if (sessionCount === 1) {
        updatedQueue = [newPackage, ...currentQueue]; // Вставляем в начало
      } else {
        updatedQueue = [...currentQueue, newPackage]; // Вставляем в конец
      }
  
      // 5. Сортируем массив по дате окончания
      updatedQueue.sort((a, b) => new Date(a.dateTo).getTime() - new Date(b.dateTo).getTime());
  
      // 6. Обновляем sessionQueue клиента
      const updatedQueueString = JSON.stringify(updatedQueue);
  
      const updateQueueQuery = `
        UPDATE clients
        SET sessionQueue = ?
        WHERE name = ? AND phone = ?
      `;
      
      await this.databaseService.run(updateQueueQuery, [updatedQueueString, client, phone]);
  
      return { success: true, message: 'Платеж успешно добавлен!' };
    } catch (error) {
      console.error('Произошла неудача при внесении транзакции в приложение ', error);
      throw new HttpException(
        'Произошла ошибка при внесении данных о транзакции в базу данных!',
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
