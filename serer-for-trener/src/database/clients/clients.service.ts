import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class ClientsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getAllClients(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.databaseService.getDB().all('SELECT * FROM clients', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  addClient(form: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)`;
      this.databaseService.getDB().run(query,  (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
