import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = path.resolve(__dirname, '..', '..', 'database.db');
    const dbExists = fs.existsSync(dbPath);

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка подключения к БД:', err.message);
      } else {
        console.log('Подключено к SQLite');
      }
    });

    if (!dbExists) {
      this.createTables();
    }
  }

  onModuleInit() {
    console.log('База данных готова');
  }

  onModuleDestroy() {
    this.db.close((err) => {
      if (err) console.error('Ошибка при закрытии БД:', err.message);
      else console.log('Соединение с БД закрыто');
    });
  }

  private createTables() {
    const createClientsTable = `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        age INTEGER,
        gender TEXT,
        photo BLOB,
        goal TEXT,
        activityLevel TEXT,
        injuries TEXT,
        trainingHistory TEXT,
        weight INTEGER,
        height INTEGER,
        chest INTEGER,
        waist INTEGER,
        hips INTEGER,
        bodyFat REAL,
        trainingHistory TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        date DATE NOT NULL,
        type TEXT, -- например, кардио, силовая тренировка
        duration INTEGER, -- продолжительность в минутах
        caloriesBurned REAL,
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );


      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        amount REAL,
        date DATE NOT NULL,
        method TEXT, -- например, наличными, картой, через приложение
        status TEXT, -- например, успешный, отменен
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );


      CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        reminderText TEXT,
        date DATE NOT NULL,
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );

      CREATE TABLE progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        date DATE NOT NULL,
        weight REAL,
        chest REAL,
        waist REAL,
        hips REAL,
        bodyFat REAL,
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );

      CREATE TABLE trainingPlans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        planDetails TEXT, -- описание плана, может быть в формате JSON или текст
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );

      CREATE TABLE feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainerPhone TEXT, -- если это отзыв о тренере
        clientPhone TEXT, -- если это отзыв о клиенте
        feedbackText TEXT,
        date DATE NOT NULL,
        FOREIGN KEY (trainerPhone) REFERENCES clients(phone), -- если это отзыв о тренере
        FOREIGN KEY (clientPhone) REFERENCES clients(phone)  -- если это отзыв о клиенте
      );

      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        notificationText TEXT,
        date DATE NOT NULL,
        type TEXT, -- например, напоминание о тренировке
        FOREIGN KEY (phone) REFERENCES clients(phone)
      );

      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, -- хранить в зашифрованном виде
        role TEXT NOT NULL, -- например, 'trainer' или 'admin'
        email TEXT
      );

      CREATE TABLE payment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT, -- привязка к клиенту
        action TEXT NOT NULL, -- тип операции (оплата, возврат и т.п.)
        amount REAL,
        description TEXT, -- например, "Оплата пакета 8 тренировок"
        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        method TEXT, -- наличные, карта и т.п.
        status TEXT -- успешный, отменен и т.д.
      );

      CREATE TABLE activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT, -- привязка к клиенту
        action TEXT NOT NULL, -- тип действия (created, updated, deleted и т.п.)
        description TEXT, -- дополнительная информация (например, "Изменен возраст с 22 на 23")
        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        performedBy TEXT -- кто совершил действие (если нужно)
      );

    `;

    this.db.run(createClientsTable, (err) => {
      if (err) {
        console.error('Ошибка создания таблицы clients:', err.message);
      } else {
        console.log('Таблица clients создана');
      }
    });
  }

  public getDB(): sqlite3.Database {
    return this.db;
  }

  // Универсальный метод для запроса
  public query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: T[]) => { // Здесь указываем тип T для массива rows
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }


  // Универсальный метод для изменения данных (INSERT, UPDATE, DELETE)
  public run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async runTransaction<T>(operations: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            return reject(new HttpException('Transaction start error', HttpStatus.INTERNAL_SERVER_ERROR));
          }

          operations()
            .then((result) => {
              this.db.run('COMMIT', (err) => {
                if (err) {
                  this.db.run('ROLLBACK', () => {
                    return reject(new HttpException('Commit error', HttpStatus.INTERNAL_SERVER_ERROR));
                  });
                } else {
                  resolve(result);
                }
              });
            })
            .catch((error) => {
              this.db.run('ROLLBACK', () => {
                console.error('Откат транзакции по причине ошибки: ', error);
                reject(error);
              });
            });
        });
      });
    });
  }

}
