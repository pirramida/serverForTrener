import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';

@Injectable()
export class UsersService {
    constructor(private readonly databaseService: DatabaseService) {}

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
              [JSON.stringify(tokenData), 'Юлия']
            );
    
            return { message: true };
          } else if (action === 'delete') {
            await this.databaseService.query(
              `UPDATE users SET googleCalendar = NULL WHERE name = ?`,
              ['Юлия']
            );
            return { message: true };
          } else {
            return { message: false, error: 'Неизвестное действие' };
          }
        } catch (err) {
          console.error('Ошибка при работе с Google аккаунтом:', err);
          return { message: false };
        }
      }
    

      async getGoogleCalendarEvents(): Promise<any> {
        try {
            console.log('Получаем данные пользователя из базы...');
            
            // Получаем данные пользователя из базы
            const [user] = await this.databaseService.query(
                `SELECT googleCalendar, events_today, events_tomorrow, events_todayChange, events_tomorrowChange FROM users WHERE name = ?`,
                ['Юлия']
            ) as any[];
    
            if (!user || !user.googleCalendar) {
                console.error('Ошибка: Нет сохранённого Google аккаунта');
                throw new Error('Нет сохранённого Google аккаунта');
            }
    
            console.log('Данные пользователя загружены:', user);
    
            // Распаковываем данные пользователя
            const { email, access_token, refresh_token, token_expires } = JSON.parse(user.googleCalendar);
    
            // Создаём OAuth2 клиент
            const oAuth2Client = new google.auth.OAuth2(
                '362002328679-n4uqn1arfofigtuur8po169gds8lrh76.apps.googleusercontent.com',
                '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', // client_secret не нужен для клиентского OAuth
                ''
            );
    
            oAuth2Client.setCredentials({
                access_token,
                refresh_token,
                expiry_date: token_expires,
            });
    
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
                        [JSON.stringify(updated), 'Юлия']
                    );
                    console.log('Токены обновлены в базе данных.');
                }
            });
    
            // Инициализируем Google Calendar API
            const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
            // Получаем список событий из календаря
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    
            console.log('Запрашиваем события для периода: сегодня и завтра...');
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startOfToday.toISOString(),
                timeMax: endOfTomorrow.toISOString(),
                maxResults: 100,
                singleEvents: true,
                orderBy: 'startTime',
            });
    
            // Делаем фильтрацию на два массива: для сегодня и завтра
            let events = res.data.items?.map(event => {
                let eventDate = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date);
                eventDate.setHours(eventDate.getHours() + 3); // Добавляем 3 часа к времени события
                return {
                    summary: event.summary,
                    start: eventDate.toISOString(),
                };
            }) || [];
    
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
    
            const todayEvents = events.filter(event => new Date(event.start).toDateString() === today.toDateString());
            const tomorrowEvents = events.filter(event => new Date(event.start).toDateString() === tomorrow.toDateString());
    
            console.log('События на сегодня:', todayEvents);
            console.log('События на завтра:', tomorrowEvents);
    
            // Если колонки пустые, записываем новые события
            const response = await this.databaseService.query('SELECT * FROM users WHERE name = ?', ['Юлия']) as any[];

            if (!response[0].events_today || !response[0].events_tomorrow || !response[0].events_todayChange || !response[0].events_tomorrowChange) {
                console.log('Колонки в базе данных пустые, записываем новые события...');
                await this.databaseService.query(
                    `UPDATE users SET events_today = ?, events_tomorrow = ?, events_todayChange = ?, events_tomorrowChange = ? WHERE name = ?`,
                    [JSON.stringify(todayEvents), JSON.stringify(tomorrowEvents), JSON.stringify(todayEvents), JSON.stringify(tomorrowEvents), 'Юлия']
                );
                console.log('Записали новые события в базу данных.');
            } else {
                console.log('Загружаем текущие события из базы данных...');
                // Загружаем текущие события из базы данных
                const storedTodayEvents = JSON.parse(response[0].events_today || '[]');
                const storedTomorrowEvents = JSON.parse(response[0].events_tomorrow || '[]');
                const storedTodayChange = JSON.parse(response[0].events_todayChange || '[]');
                const storedTomorrowChange = JSON.parse(response[0].events_tomorrowChange || '[]');
    
                // 1. Находим новые события, которые пришли из Google, но отсутствуют в базе
                const newTodayEvents = todayEvents.filter(event => !storedTodayEvents.some(stored => stored.summary === event.summary));
                const newTomorrowEvents = tomorrowEvents.filter(event => !storedTomorrowEvents.some(stored => stored.summary === event.summary));
    
                console.log('Новые события для добавления:');
                console.log('Сегодня:', newTodayEvents);
                console.log('Завтра:', newTomorrowEvents);
    
                // 2. Находим события, которые есть в базе, но их нет в новых данных (удаляем их)
                const removedTodayEvents = storedTodayEvents.filter(event => !todayEvents.some(e => e.summary === event.summary));
                const removedTomorrowEvents = storedTomorrowEvents.filter(event => !tomorrowEvents.some(e => e.summary === event.summary));
    
                console.log('События, которые нужно удалить:');
                console.log('Сегодня:', removedTodayEvents);
                console.log('Завтра:', removedTomorrowEvents);
    
                // 3. Добавляем недостающие события
                if (newTodayEvents.length > 0) {
                    console.log('Добавляем новые события на сегодня...');
                    await this.databaseService.query(
                        `UPDATE users SET events_today = ?, events_todayChange = ? WHERE name = ?`,
                        [JSON.stringify([...storedTodayEvents, ...newTodayEvents]), JSON.stringify([...storedTodayChange, ...newTodayEvents]), 'Юлия']
                    );
                    console.log('Новые события на сегодня добавлены в базу.');
                }
    
                if (newTomorrowEvents.length > 0) {
                    console.log('Добавляем новые события на завтра...');
                    await this.databaseService.query(
                        `UPDATE users SET events_tomorrow = ?, events_tomorrowChange = ? WHERE name = ?`,
                        [JSON.stringify([...storedTomorrowEvents, ...newTomorrowEvents]), JSON.stringify([...storedTomorrowChange, ...newTomorrowEvents]), 'Юлия']
                    );
                    console.log('Новые события на завтра добавлены в базу.');
                }
    
                // 4. Удаляем лишние события
                if (removedTodayEvents.length > 0) {
                    console.log('Удаляем лишние события на сегодня...');
                    const updatedTodayChange = storedTodayChange.filter(event => !removedTodayEvents.some(removed => removed.summary === event.summary));
                    await this.databaseService.query(
                        `UPDATE users SET events_todayChange = ? WHERE name = ?`,
                        [JSON.stringify(updatedTodayChange), 'Юлия']
                    );
                    console.log('Лишние события на сегодня удалены из базы.');
                }
    
                if (removedTomorrowEvents.length > 0) {
                    console.log('Удаляем лишние события на завтра...');
                    const updatedTomorrowChange = storedTomorrowChange.filter(event => !removedTomorrowEvents.some(removed => removed.summary === event.summary));
                    await this.databaseService.query(
                        `UPDATE users SET events_tomorrowChange = ? WHERE name = ?`,
                        [JSON.stringify(updatedTomorrowChange), 'Юлия']
                    );
                    console.log('Лишние события на завтра удалены из базы.');
                }
    
                console.log('Обновили события в базе данных.');
            }
    
            // Возвращаем два массива: события на сегодня и завтра
            return { todayEvents, tomorrowEvents };
        } catch (err) {
            console.error('Ошибка получения событий:', err.message);
            return { todayEvents: [], tomorrowEvents: [] }; // Возвращаем пустые массивы в случае ошибки
        }
    }
    

    
}