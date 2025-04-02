import { Injectable, OnModuleInit } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = 'database.db';
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

  private createTables() {
    const createClientsTable = `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
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
}
