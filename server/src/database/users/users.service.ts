import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) { }

  async validateUser(username: string, password: string): Promise<any> {
    try {
      const [user] = await this.databaseService.query(
        'SELECT * FROM users WHERE name = ?',
        [username],
      ) as any;
      console.log('useruser', user);

      if (!user) return null;

      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log(isPasswordValid);
      if (!isPasswordValid) return null;

      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Ошибка при проверке пользователя:', error.message);
      throw new Error('Ошибка авторизации');
    }
  }


  async findUserById(id: number): Promise<any> {
    try {
      const [user] = await this.databaseService.query(
        'SELECT * FROM users WHERE id = ?',
        [id],
      );
      return user || null;
    } catch (err) {
      console.error('Ошибка при проверке пользователя:', err.message);
      return null;
    }
  }

  async storeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    await this.databaseService.query(
      'UPDATE users SET refresh_token = ? WHERE id = ?',
      [refreshToken, userId]
    );
  }


  // Получение всех пользователей
  async getAllStatisticUser(): Promise<any[]> {
    try {
      return await this.databaseService.query('SELECT * FROM users');
    } catch (err) {
      console.error('Ошибка при получении статистики:', err.message);
      return [];
    }
  }

  // Сохранение данных о Google аккаунте
  async addGoogleAcc(userdata, action): Promise<any> {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        if (action === 'save') {
          const { email, access_token, refresh_token, expires_in } = userdata;

          const tokenData = {
            email,
            access_token,
            refresh_token,
            token_expires: Date.now() + expires_in * 1000,
          };

          await this.databaseService.query(
            `UPDATE users SET googleCalendar = ? WHERE name = ?`,
            [JSON.stringify(tokenData), 'Юлия'],
          );

          return { message: true };
        } else if (action === 'delete') {
          await this.databaseService.query(
            `UPDATE users SET googleCalendar = NULL WHERE name = ?`,
            ['Юлия'],
          );
          return { message: true };
        } else {
          return { message: false, error: 'Неизвестное действие' };
        }
      });
      return response;
    } catch (err) {
      console.error('Ошибка при работе с Google аккаунтом:', err);
      return { message: false };
    }
  }

  async addSessions(newWorkout): Promise<boolean> {
    try {
      const events = (await this.databaseService.query(
        `SELECT events_todayChange FROM users WHERE name = ?`,
        ['Юлия'],
      )) as any;

      let oldEvents = JSON.parse(events[0].events_todayChange);
      oldEvents.push(newWorkout);

      await this.databaseService.query(
        'UPDATE users SET events_todayChange = ? WHERE name = ?',
        [(oldEvents = JSON.stringify(oldEvents)), 'Юлия'],
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  async changeDateUpdate(dateUpdate, id): Promise<any> {
    try {
      const sql = 'UPDATE users SET dateUpdate = ? WHERE id = ?';
      const params = [dateUpdate, id];
      await this.databaseService.query(sql, params);
      return true;
    } catch (err) {
      return false;
    }
  }

  async customGet(userId: number, nameColumn?: string): Promise<any> {
    const rows = await this.databaseService.query(
      `SELECT ${'dateUpdate'} FROM users WHERE id = ?`,
      [1],
    );

    if (!rows.length) {
      throw new Error('Нет сохранённого Google аккаунта');
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

  async getGoogleCalendarEvents(): Promise<any> {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        // Получаем данные пользователя из базы
        const [user] = (await this.databaseService.query(
          `SELECT googleCalendar, events_today, events_tomorrow, events_todayChange, events_tomorrowChange FROM users WHERE name = ?`,
          ['Юлия'],
        )) as any[];

        if (!user || !user.googleCalendar) {
          console.error('Ошибка: Нет сохранённого Google аккаунта');
          throw new Error('Нет сохранённого Google аккаунта');
        }

        // Распаковываем данные пользователя
        const { email, access_token, refresh_token, token_expires } =
          JSON.parse(user.googleCalendar);

        // Создаём OAuth2 клиент
        const oAuth2Client = new google.auth.OAuth2(
          '362002328679-n4uqn1arfofigtuur8po169gds8lrh76.apps.googleusercontent.com',
          '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', // client_secret не нужен для клиентского OAuth
          '',
        );

        oAuth2Client.setCredentials({
          access_token,
          refresh_token,
          expiry_date: token_expires,
        });

        await oAuth2Client.getAccessToken();

        // Обновляем токен, если он истекает
        oAuth2Client.on('tokens', async (tokens) => {
          if (tokens.access_token) {
            console.log('Токен обновлён');
            const updated = {
              email,
              access_token: tokens.access_token,
              refresh_token: refresh_token || tokens.refresh_token,
              token_expires: tokens.expiry_date,
            };

            await this.databaseService.query(
              `UPDATE users SET googleCalendar = ? WHERE name = ?`,
              [JSON.stringify(updated), 'Юлия'],
            );
          }
        });

        // Инициализируем Google Calendar API
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

        // Получаем список событий из календаря
        const now = new Date();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
        );
        const endOfTomorrow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          23,
          59,
          59,
        );

        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startOfToday.toISOString(),
          timeMax: endOfTomorrow.toISOString(),
          maxResults: 100,
          singleEvents: true,
          orderBy: 'startTime',
        });

        // Делаем фильтрацию на два массива: для сегодня и завтра
        let events =
          res.data.items?.map((event) => {
            let eventDate = event.start?.dateTime
              ? new Date(event.start.dateTime)
              : new Date(event.start?.date);
            eventDate.setHours(eventDate.getHours()); // Добавляем 3 часа к времени события
            return {
              summary: event.summary,
              start: eventDate.toISOString(),
              marked: false,
            };
          }) || [];

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const todayEvents = events.filter(
          (event) =>
            new Date(event.start).toDateString() === today.toDateString(),
        );
        const tomorrowEvents = events.filter(
          (event) =>
            new Date(event.start).toDateString() === tomorrow.toDateString(),
        );

        if (!user.events_todayChange || !user.events_tomorrowChange) {
          await this.databaseService.query(
            `UPDATE users SET events_today = ?, events_tomorrow = ?, events_todayChange = ?, events_tomorrowChange = ? WHERE name = ?`,
            [
              JSON.stringify(todayEvents),
              JSON.stringify(tomorrowEvents),
              JSON.stringify(todayEvents),
              JSON.stringify(tomorrowEvents),
              'Юлия',
            ],
          );
        } else {
          const events_todayChange = JSON.parse(user.events_todayChange);
          const events_tomorrowChange = JSON.parse(user.events_tomorrowChange);

          // Проверяем есть ли новые события на сегодня
          const newTodayEventsAdd = todayEvents.filter(
            (event) =>
              !events_todayChange.some(
                (stored) =>
                  stored.summary === event.summary &&
                  stored.start === event.start,
              ),
          );

          // Проверяем есть ли лишние события на сегодня
          const newTodayEventsDelete = events_todayChange.filter(
            (event) =>
              !event.marked &&
              !event?.status &&
              !todayEvents.some(
                (stored) =>
                  stored.summary === event.summary &&
                  stored.start === event.start,
              ),
          );

          // Проверяем есть ли новые события на завтра
          const newTomorrowEventsAdd = tomorrowEvents.filter(
            (event) =>
              !events_tomorrowChange.some(
                (stored) =>
                  stored.summary === event.summary &&
                  stored.start === event.start,
              ),
          );

          // Проверяем есть ли лишние события на завтра
          const newTomorrowEventsDelete = events_tomorrowChange.filter(
            (event) =>
              !event.marked &&
              !event?.status &&
              !tomorrowEvents.some(
                (stored) =>
                  stored.summary === event.summary &&
                  stored.start === event.start,
              ),
          );

          // Объединяем старые и новые события (добавляем новые)
          let updatedTodayEvents = [
            ...events_todayChange,
            ...newTodayEventsAdd,
          ].filter(
            (event) =>
              !newTodayEventsDelete.some(
                (deleted) =>
                  deleted.summary === event.summary &&
                  deleted.start === event.start,
              ),
          );

          let updatedTomorrowEvents = [
            ...events_tomorrowChange,
            ...newTomorrowEventsAdd,
          ].filter(
            (event) =>
              !newTomorrowEventsDelete.some(
                (deleted) =>
                  deleted.summary === event.summary &&
                  deleted.start === event.start,
              ),
          );

          updatedTodayEvents = updatedTodayEvents.filter(
            (event) =>
              new Date(event.start).toDateString() === today.toDateString(),
          );
          updatedTomorrowEvents = updatedTomorrowEvents.filter(
            (event) =>
              new Date(event.start).toDateString() === tomorrow.toDateString(),
          );

          // Обновляем в базе только если что-то изменилось
          const isTodayChanged =
            newTodayEventsAdd.length > 0 || newTodayEventsDelete.length > 0;
          const isTomorrowChanged =
            newTomorrowEventsAdd.length > 0 ||
            newTomorrowEventsDelete.length > 0;

          if (isTodayChanged || isTomorrowChanged) {
            await this.databaseService.query(
              `UPDATE users SET events_todayChange = ?, events_tomorrowChange = ? WHERE name = ?`,
              [
                JSON.stringify(updatedTodayEvents),
                JSON.stringify(updatedTomorrowEvents),
                'Юлия',
              ],
            );
          }

          const clients = (await this.databaseService.query(
            'SELECT * FROM clients',
          )) as any[];

          // Возвращаем два массива: события на сегодня и завтра
          const todayClients = mergeEventsWithClients(
            updatedTodayEvents,
            clients,
          );
          const tomorrowClients = mergeEventsWithClients(
            updatedTomorrowEvents,
            clients,
          );

          return {
            todayClients,
            tomorrowClients,
          };
        }
      });
      return response;
    } catch (err) {
      console.error('Ошибка получения событий:', err.message);
      return { todayClients: [], tomorrowClients: [] }; // Возвращаем пустые массивы в случае ошибки
    }
  }
}

function mergeEventsWithClients(events, clients) {
  return events
    .map((event) => {
      const client = clients.find(
        (c) => c.name === event.summary || isSimilarName(event.summary, c.name),
      );
      if (client && event.marked !== true) {
        return {
          ...client,
          start: event.start,
          marked: event.marked ?? false,
        };
      }
      return null;
    })
    .filter(Boolean); // убираем null
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

  const [clientSurname, clientName] = clientWords;
  const clientInitial = clientName[0];

  // Форматы:
  // 1. Колобов Д
  // 2. Д Колобов
  // 3. Колобов Дмитрий
  // 4. Дмитрий Колобов
  return summaryWords.some((word, i) => {
    const otherWord = summaryWords[1 - i];
    return (
      (word === clientSurname &&
        (!otherWord || otherWord[0] === clientInitial)) ||
      (word === clientInitial && otherWord === clientSurname)
    );
  });
}
