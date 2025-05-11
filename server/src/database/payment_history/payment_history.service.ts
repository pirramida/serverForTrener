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

  async changeSessionsClient(client: { name: string; phone: string }, payload): Promise<any> {
    try {
      // Для месячного обновления статистики!
      // Получаем текущую дату
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Получаем дату последнего сброса
      const resetResult: { lastReset: string | null }[] = await this.databaseService.query(
        `SELECT lastReset FROM users WHERE name = ?`,
        ['Юлия']
      );

      const lastReset = resetResult.length > 0 ? resetResult[0].lastReset : null;
      const lastResetMonth = lastReset?.slice(0, 7); // YYYY-MM

      if (lastResetMonth !== currentMonth) {
        // Получаем текущие значения
        const userData: {
          cashInMonth: number;
          sessionsInMonth: number;
          newClientsInMonth: number;
        }[] = await this.databaseService.query(
          `SELECT cashInMonth, sessionsInMonth, newClientsInMonth FROM users WHERE name = ?`,
          ['Юлия']
        );

        const { cashInMonth, sessionsInMonth, newClientsInMonth } = userData[0];

        // Период — это месяц, за который собираем статистику (предыдущий)
        const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const period = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Поменять на id user настоящий. Пока что один пользователь 1 id 
        const user_id = 1
        // Сохраняем статистику
        await this.databaseService.query(
          `
          INSERT INTO statistic (
            cashInMonth,
            sessionsInMonth,
            clientsInMonth,
            period,
            createdAt,
            user_id
          ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            cashInMonth,
            sessionsInMonth,
            newClientsInMonth,
            period,
            now.toISOString(),
            user_id
          ]
        );

        // Обнуляем поля
        await this.databaseService.query(
          `
          UPDATE users
          SET 
            cashInMonth = 0,
            sessionsInMonth = 0,
            newClientsInMonth = 0,
            lastReset = ?
          WHERE name = ?
          `,
          [now.toISOString(), 'Юлия']
        );
      }

      let response;
      //-----------------------------------------------------------------
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
          SELECT quantityLeft, status, amount, quantity FROM payment_history WHERE unique_id = ?
        `;
        const packageResult: { quantityLeft: number; status: string; amount: number; quantity: number; }[] = await this.databaseService.query(packageQuery, [firstPackageId]);
    
        // Проверяем, что результат не пустой
        if (packageResult.length === 0) {
          throw new Error('Пакет не найден в payment_history');
        }
    
        // Деструктурируем quantityLeft и status из первого элемента результата
        const { quantityLeft, status, amount, quantity } = packageResult[0];
    
        // 3. Уменьшаем количество тренировок (quantityLeft)
        let updatedQuantityLeft = quantityLeft - 1;
        if (payload.action === '' || payload.action === 'writeoff') {

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
        //ID Юлия. Потом поментяь на ID кого угодно!!!
        await this.databaseService.query(
          `
          INSERT INTO session_history (name, phone, action, report, userID)
          VALUES (?, ?, ?, ?, ?)
          `,
          [client.name, Number(client.phone), 'Списание тренировки', JSON.stringify(payload), 1]
        );
      
        // 7. Возвращаем обновленную информацию
        response = await this.databaseService.query(
          'SELECT quantity, quantityLeft FROM payment_history WHERE unique_id = ?',
          [firstPackageId]
        );
    
        // 8. Расчёт дохода за проведённую тренировку

        // Получаем стоимость одной тренировки
        const pricePerSession = amount / quantity;

        // Обновляем доход тренера за месяц
        await this.databaseService.query(
          `UPDATE users SET 
            cashInMonth = COALESCE(cashInMonth, 0) + ?, 
            sessionsInMonth = COALESCE(sessionsInMonth, 0) + 1,
            totalCash = COALESCE(totalCash, 0) + ?, 
            totalSessions = COALESCE(totalSessions, 0) + 1
          WHERE name = ?`,
          [pricePerSession, pricePerSession, 'Юлия']
        );

      } else {
        await this.databaseService.query(
          `
          INSERT INTO session_history (name, phone, action, report, userID)
          VALUES (?, ?, ?, ?, ?)
          `,
          [client.name, Number(client.phone), 'Перенесенная тренировка', JSON.stringify(payload), 1]
        );
        response = await this.databaseService.query(
          'SELECT quantity, quantityLeft FROM payment_history WHERE unique_id = ?',
          [firstPackageId]
        );

      }

      const results = await this.databaseService.query(
        'SELECT events_todayChange FROM users WHERE id = ?', ['1']
      ) as any
      console.log('events_todayChangeevents_todayChange', results[0].events_todayChange);
      let events_todayChange = JSON.parse(results[0].events_todayChange);
      console.log('events_todayChangeevents_todayChangeevents_todayChange', events_todayChange);

      const updatedEvents = events_todayChange.map((item: any) => {
        if (item.summary === client.name || isSimilarName(item.summary, client.name)) {
          return {
            ...item,
            marked: true,
          };
        }
        return { ...item };
      });
      
      
      await this.databaseService.query(
        'UPDATE users SET events_todayChange = ? WHERE id = ?', [JSON.stringify(updatedEvents), '1']
      )
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


function mergeEventsWithClients(events, clients) {
  return events.map(event => {
      const client = clients.find(c =>
          c.name === event.summary || isSimilarName(event.summary, c.name )
      );
      if (client && event.marked !== true) {
          return {
              ...client,
              start: event.start,
              marked: event.marked ?? false,
          };
      }
      return null;
  }).filter(Boolean); // убираем null
}

function isSimilarName(eventSummary: string, clientFullName: string): boolean {
  if (!eventSummary || !clientFullName) return false;

  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^\wа-яё ]/gi, '').trim();

  const summaryWords = normalize(eventSummary).split(' ');
  const clientWords = normalize(clientFullName).split(' ');

  if (clientWords.length < 2) return false;

  const [surname, name] = clientWords;
  const initial = name[0];

  const patterns = [
    `${surname} ${initial}`,
    `${initial} ${surname}`,
    `${surname} ${name}`,
    `${name} ${surname}`,
    name,
    surname,
  ];

  const normalizedSummary = summaryWords.join(' ');

  return patterns.some(pattern => normalizedSummary.includes(pattern.toLowerCase()));
}
