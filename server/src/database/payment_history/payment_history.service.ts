import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { rejects } from 'assert';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class PaymentService {
    constructor(private readonly databaseService: DatabaseService) {}

    getAllPaymentHistory(): Promise<any[]> {
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
}