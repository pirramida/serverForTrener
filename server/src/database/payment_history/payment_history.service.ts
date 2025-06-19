import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class PaymentService {
  constructor(private readonly databaseService: DatabaseService) { }

  async getAllPaymentHistory(): Promise<any[]> {
    try {
      return await this.databaseService.query('SELECT * FROM payment_history');
    } catch (err) {
      console.error('Ошибка при получении истории платежей:', err.message);
      return [];
    }
  }


  async changeSessionsClient(
    client: { id: number; name: string; phone: string; },
    payload,
    userId
  ): Promise<any> {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        console.log('[TX] Транзакция началась');

        // const resetResult = (await this.databaseService.query(
        //   `SELECT lastReset, dateUpdate FROM users WHERE id = ?`,
        //   [userId],
        // )) as any;

        // const lastReset =
        //   resetResult.length > 0 ? resetResult[0].lastReset : null;
        // const dateUpdate =
        //   resetResult.length > 0 ? parseInt(resetResult[0].dateUpdate, 10) : 1;
        // const lastResetMonth = lastReset?.slice(0, 7);

        // const now = new Date();
        // const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        // const todayDate = now.getDate();

        // console.log('[TX] lastResetMonth:', lastResetMonth);
        // console.log(
        //   '[TX] dateUpdate:',
        //   dateUpdate,
        //   'Сегодняшнее число:',
        //   todayDate,
        // );

        // const shouldReset = lastResetMonth !== currentMonth && todayDate >= dateUpdate;
        // if (shouldReset) {
        //   console.log('[TX] Обновляем статистику за прошлый месяц');

        //   const userData = (await this.databaseService.query(
        //     `SELECT cashInMonth, sessionsInMonth, newClientsInMonth FROM users WHERE id = ?`,
        //     [userId],
        //   )) as any;
        //   console.log('[TX] userData:', userData);

        //   const { cashInMonth, sessionsInMonth, newClientsInMonth } =
        //     userData[0];

        //   const previousMonthDate = new Date(
        //     now.getFullYear(),
        //     now.getMonth() - 1,
        //     1,
        //   );
        //   const period = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

        //   await this.databaseService.query(
        //     `INSERT INTO statistic (
        //     cashInMonth,
        //     sessionsInMonth,
        //     clientsInMonth,
        //     period,
        //     createdAt,
        //     user_id
        //   ) VALUES (?, ?, ?, ?, ?, ?)`,
        //     [
        //       cashInMonth,
        //       sessionsInMonth,
        //       newClientsInMonth,
        //       period,
        //       now.toISOString(),
        //       userId,
        //     ],
        //   );
        //   console.log('[TX] Сохранили статистику за период:', period);

        //   await this.databaseService.query(
        //     `UPDATE users SET cashInMonth = 0, sessionsInMonth = 0, newClientsInMonth = 0, lastReset = ? WHERE id = ?`,
        //     [now.toISOString(), userId],
        //   );
        //   console.log('[TX] Обнулили поля статистики');
        // }


        const clientId = client.id;
        console.log('[TX] clientId:', clientId);

        let currentQueue = [];
        let firstPackageId = null;
        let packageResult = [];
        let quantityLeft = 0;
        let status = '';
        let amount = 0;
        let quantity = 1; // защита от деления на 0
        let updatedQuantityLeft = 0;
        let response;

        // Только если это списание — получаем данные очереди
        if (payload.action !== 'no_writeoff') {
          const result = await this.databaseService.query(
            `SELECT sessionQueue FROM clients WHERE id = ?`,
            [clientId]
          ) as any;
          currentQueue = result?.[0]?.sessionQueue
            ? JSON.parse(result[0].sessionQueue)
            : [];

          firstPackageId = currentQueue.length > 0 ? currentQueue[0].id : null;
          console.log('[TX] firstPackageId:', firstPackageId);

          if (!firstPackageId) {
            throw new Error('Нет пакетов в очереди для списания');
          }

          packageResult = await this.databaseService.query(
            `SELECT quantityLeft, status, amount, quantity FROM payment_history WHERE unique_id = ?`,
            [firstPackageId]
          ) as any;

          if (packageResult.length === 0) {
            throw new Error('Пакет не найден в payment_history');
          }

          ({ quantityLeft, status, amount, quantity } = packageResult[0]);
          updatedQuantityLeft = quantityLeft - 1;
        }

        if (
          payload.action === '' ||
          payload.action === 'writeoff' ||
          payload.action === undefined
        ) {
          console.log('[TX] Списание тренировки. Осталось:', updatedQuantityLeft);

          if (updatedQuantityLeft === 0 && status !== 'Не активен') {
            await this.databaseService.query(
              `UPDATE payment_history SET quantityLeft = ?, status = 'Не активен' WHERE unique_id = ?`,
              [updatedQuantityLeft, firstPackageId]
            ) as any;

            const updatedQueue = currentQueue.slice(1);
            await this.databaseService.query(
              `UPDATE clients SET sessionQueue = ? WHERE id = ?`,
              [JSON.stringify(updatedQueue), clientId]
            ) as any;

            console.log('[TX] Обновили очередь и статус пакета');
          } else {
            await this.databaseService.query(
              `UPDATE payment_history SET quantityLeft = ? WHERE unique_id = ?`,
              [updatedQuantityLeft, firstPackageId]
            );
            console.log('[TX] Уменьшили quantityLeft');
          }

          await this.databaseService.query(
            `UPDATE clients SET sessions = CASE WHEN sessions > 0 THEN sessions - 1 ELSE 0 END WHERE id = ?`,
            [clientId]
          ) as any;
          console.log('[TX] Обновили sessions клиента');

          await this.databaseService.query(
            `INSERT INTO session_history (name, phone, action, report, userID, clientId, trainingTime) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              client.name,
              Number(client.phone),
              payload.type !== 'missed'
                ? 'Списание тренировки'
                : 'Перенесенная тренировка со списанием',
              JSON.stringify(payload),
              userId,
              clientId,
              payload.sessionDate
            ]
          ) as any;
          console.log('[TX] Добавили в историю сессий');

          response = await this.databaseService.query(
            `SELECT quantity, quantityLeft FROM payment_history WHERE unique_id = ?`,
            [firstPackageId]
          ) as any;

          const pricePerSession = amount / quantity;
          await this.databaseService.query(
            `UPDATE users SET cashInMonth = COALESCE(cashInMonth, 0) + ?, sessionsInMonth = COALESCE(sessionsInMonth, 0) + 1, totalCash = COALESCE(totalCash, 0) + ?, totalSessions = COALESCE(totalSessions, 0) + 1 WHERE id = ?`,
            [pricePerSession, pricePerSession, userId]
          ) as any;
          console.log('[TX] Обновили доход тренера');
        } else {
          await this.databaseService.query(
            `INSERT INTO session_history (name, phone, action, report, userID, clientId, trainingTime) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              client.name,
              Number(client.phone),
              'Перенесенная тренировка без списания',
              JSON.stringify(payload),
              userId,
              clientId,
              payload.sessionDate
            ]
          ) as any;
          response = [{ quantity: 0, quantityLeft: 0 }];
          console.log('[TX] Перенос тренировки');
        }

        // Обновляем флаги в календаре
        const results = await this.databaseService.query(
          `SELECT events_todayChange FROM users WHERE id = ?`,
          [userId]
        ) as any;
        const events_todayChange = JSON.parse(results[0].events_todayChange || '[]');
        const updatedEvents = events_todayChange.map((item: any) => {
          if (item.summary === client.name || isSimilarName(item.summary, client.name)) {
            return { ...item, marked: true };
          }
          return item;
        });

        await this.databaseService.query(
          `UPDATE users SET events_todayChange = ? WHERE id = ?`,
          [JSON.stringify(updatedEvents), userId]
        );
        console.log('[TX] Обновили события пользователя');

        console.log('[TX] Транзакция завершена успешно', response);
        return response;
      });

      console.log('[TX] Финальный ответ:', response);
      return response;
    } catch (error) {
      console.error('Произошла ошибка в процессе выполнения:', error);
      throw error;
    }
  }

  async getQuantity(client: any): Promise<any[]> {
    try {
      const currentSessionQueueQuery = `
        SELECT sessionQueue FROM clients WHERE id = ?
      `;
      const result: { sessionQueue: string | null }[] =
        await this.databaseService.query(currentSessionQueueQuery, [client.id]);
      console.log(result);
      // Проверяем, существует ли результат и содержит ли он sessionQueue
      const currentQueue =
        result.length > 0 && result[0].sessionQueue
          ? JSON.parse(result[0].sessionQueue) // Если sessionQueue существует, парсим его
          : []; // Иначе возвращаем пустой массив
      console.log(currentQueue);

      // Получаем ID первого пакета из очереди
      const firstPackageId =
        currentQueue.length > 0 ? currentQueue[0].id : null;
      if (!firstPackageId) {
        throw new Error('Нет пакетов в очереди для списания');
      }
      return await this.databaseService.query(
        'SELECT quantity, quantityLeft, dateTo FROM payment_history WHERE unique_id = ?',
        [firstPackageId],
      );
    } catch (err) {
      console.error('Ошибка при получении истории платежей:', err.message);
      return [];
    }
  }

  async postNewPaymentHistory(fromData: any, userId: number): Promise<any> {
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
          isExpiryDateManuallySet, notes, phone, method, quantity, quantityLeft, clientId, userId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      let sessionCount;
      if (type === 'Другое') {
        sessionCount = extractSessionCount(customPaymentType);
      } else {
        sessionCount = extractSessionCount(type);
      }

      const clientIdResult = (await this.databaseService.query(
        'SELECT id FROM clients WHERE name = ?',
        [client],
      )) as any[];
      const clientId = clientIdResult[0]?.id;

      const response = await this.databaseService.runTransaction(async () => {
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
          clientId,
          userId,
        ]);

        // 2. Получаем текущий sessionQueue клиента
        const currentSessionQueueQuery = `
        SELECT sessionQueue FROM clients WHERE id = ?
        `;

        const result: { sessionQueue: string | null }[] =
          await this.databaseService.query(currentSessionQueueQuery, [
            clientId,
          ]);

        // Проверяем, существует ли результат и содержит ли он sessionQueue
        const currentQueue =
          result.length > 0 && result[0].sessionQueue
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
        updatedQueue.sort(
          (a, b) => new Date(a.dateTo).getTime() - new Date(b.dateTo).getTime(),
        );

        // 6. Обновляем sessionQueue клиента
        const updatedQueueString = JSON.stringify(updatedQueue);

        const updateQueueQuery = `
        UPDATE clients
        SET sessionQueue = ?
        WHERE id = ?
        `;

        await this.databaseService.run(updateQueueQuery, [
          updatedQueueString,
          clientId,
        ]);

        return { success: true, message: 'Платеж успешно добавлен!' };
      });
      return response;
    } catch (error) {
      console.error(
        'Произошла неудача при внесении транзакции в приложение ',
        error,
      );
      throw new HttpException(
        'Произошла ошибка при внесении данных о транзакции в базу данных!',
        HttpStatus.INTERNAL_SERVER_ERROR,
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

function isSimilarName(eventSummary: string, clientFullName: string): boolean {
  if (!eventSummary || !clientFullName) return false;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\wа-яё ]/gi, '')
      .trim();

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

  return patterns.some((pattern) =>
    normalizedSummary.includes(pattern.toLowerCase()),
  );
}
