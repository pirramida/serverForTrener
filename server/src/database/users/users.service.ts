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
            // Получаем данные пользователя из базы
            const [user] = await this.databaseService.query(
                `SELECT googleCalendar FROM users WHERE name = ?`,
                ['Юлия']
            ) as any[];

            if (!user || !user.googleCalendar) {
                throw new Error('Нет сохранённого Google аккаунта');
            }

            // Распаковываем данные пользователя
            const { email, access_token, refresh_token, token_expires } = JSON.parse(user.googleCalendar);

            // Создаём OAuth2 клиент
            const oAuth2Client = new google.auth.OAuth2(
                '362002328679-n4uqn1arfofigtuur8po169gds8lrh76.apps.googleusercontent.com',
                '', // client_secret не нужен для клиентского OAuth
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
                0, 0, 0
            );

            const endOfTomorrow = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                23, 59, 59
            );
              

            const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfToday.toISOString(),   // 00:00:00 сегодня
            timeMax: endOfTomorrow.toISOString(),  // 00:00:00 послезавтра, чтобы покрыть весь завтрашний день
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
            });

            // Делаем фильтрацию на два массива: для сегодня и завтра
            const events = res.data.items?.map(event => ({
                summary: event.summary,
                start: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : event.start?.date,
            })) || [];

            // Получаем сегодняшнюю дату
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            // Разделяем события на два массива
            const todayEvents = events.filter(event => {
                const eventDate = new Date(event.start);
                return eventDate.toDateString() === today.toDateString(); // События на сегодня
            });

            const tomorrowEvents = events.filter(event => {
                const eventDate = new Date(event.start);
                return eventDate.toDateString() === tomorrow.toDateString(); // События на завтра
            });

            // Возвращаем два массива: события на сегодня и завтра
            return { todayEvents, tomorrowEvents };
        } catch (err) {
            console.error('Ошибка получения событий:', err.message);
            return { todayEvents: [], tomorrowEvents: [] }; // Возвращаем пустые массивы в случае ошибки
        }
    }

    
}