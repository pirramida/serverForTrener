import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class FitnessTestService {
  constructor(private readonly databaseService: DatabaseService) {}

  // === LIST TESTS ===
  async getFitnessTestsClient(
    clientId: number,
    nameColumn?: string,
    table?: string,
  ): Promise<any> {
    try {
      const params = nameColumn ?? '*';
      const currentTable = table ?? 'fitness_tests';
      const response = (await this.databaseService.query(
        `SELECT ${params} FROM ${currentTable} WHERE client_id = ?`,
        [clientId],
      )) as any;
      return { data: response, message: true };
    } catch (err) {
      throw new Error(`Ошибка при получении данных с сервера: ${err.message}`);
    }
  }

  // === LIST EXERCISES OF TEST ===
  async getFitnessTestsClient_exercises(
    testId: number,
    nameColumn?: string,
    table?: string,
  ): Promise<any> {
    const params = nameColumn ?? '*';
    const currentTable = table ?? 'fitness_test_exercises';
    const response = await this.databaseService.query(
      `SELECT ${params} FROM ${currentTable} WHERE test_id = ?`,
      [testId],
    );
    return { data: response, message: true };
  }

  // ====== NEW: CREATE SINGLE EXERCISE ======
  async createExercise(payload: {
    testId: number;
    section: string;
    exercise?: string;
    expected?: string;
    actual?: string;
    feeling?: string;
    notes?: string;
  }) {
    const {
      testId,
      section,
      exercise = '',
      expected = '',
      actual = '',
      feeling = '',
      notes = '',
    } = payload;

    try {
      const result: any = await this.databaseService.query(
        `INSERT INTO fitness_test_exercises
         (test_id, section, exercise, expected, actual, feeling, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [testId, section, exercise, expected, actual, feeling, notes],
      );

      // Получаем новый id (MySQL: result.insertId; адаптируй под свою DB)
      const insertedId = result?.insertId;

      const rows = await this.databaseService.query(
        `SELECT id, test_id, section, exercise, expected, actual, feeling, notes
         FROM fitness_test_exercises WHERE id = ?`,
        [insertedId],
      );

      return {
        success: true,
        exercise: rows?.[0] ?? null,
      };
    } catch (err) {
      console.error('createExercise error:', err);
      throw new Error('Ошибка при добавлении упражнения');
    }
  }

  // ====== NEW: UPDATE SINGLE EXERCISE ======
  async updateExercise(
    id: number,
    payload: Partial<{
      exercise: string;
      expected: string;
      actual: string;
      feeling: string;
      notes: string;
    }>,
  ) {
    try {
      // Собираем динамический апдейт
      const fields: string[] = [];
      const values: any[] = [];
      if (payload.exercise !== undefined) {
        fields.push('exercise = ?');
        values.push(payload.exercise);
      }
      if (payload.expected !== undefined) {
        fields.push('expected = ?');
        values.push(payload.expected);
      }
      if (payload.actual !== undefined) {
        fields.push('actual = ?');
        values.push(payload.actual);
      }
      if (payload.feeling !== undefined) {
        fields.push('feeling = ?');
        values.push(payload.feeling);
      }
      if (payload.notes !== undefined) {
        fields.push('notes = ?');
        values.push(payload.notes);
      }

      if (fields.length === 0) {
        return { success: true, exercise: null }; // нечего обновлять
      }

      values.push(id);

      await this.databaseService.query(
        `UPDATE fitness_test_exercises SET ${fields.join(', ')} WHERE id = ?`,
        values,
      );

      const rows = await this.databaseService.query(
        `SELECT id, test_id, section, exercise, expected, actual, feeling, notes
         FROM fitness_test_exercises WHERE id = ?`,
        [id],
      );

      return {
        success: true,
        exercise: rows?.[0] ?? null,
      };
    } catch (err) {
      console.error('updateExercise error:', err);
      throw new Error('Ошибка при сохранении упражнения');
    }
  }

  // ====== DELETE SINGLE EXERCISE ======
  async deleteExerciseById(id: string): Promise<{ success: boolean }> {
    try {
      const existing = await this.databaseService.query(
        'SELECT id FROM fitness_test_exercises WHERE id = ?',
        [id],
      );
      if (!existing || existing.length === 0) {
        // Не нашли — возвращаем success:false, пусть контроллер решает что отвечать
        return { success: false };
      }

      await this.databaseService.query(
        'DELETE FROM fitness_test_exercises WHERE id = ?',
        [id],
      );
      return { success: true };
    } catch (error: any) {
      console.error('Ошибка при удалении упражнения:', error?.message);
      throw new Error(error?.message || 'Ошибка при удалении упражнения');
    }
  }

  // ====== (Старое) Bulk change ======
  async changeFitnessTest(payload: {
    clientId: number;
    fitnessTests: any[];
    testId: number;
    section: string;
  }) {
    try {
      const response = await this.databaseService.runTransaction(async () => {
        await this.databaseService.query(
          'DELETE FROM fitness_test_exercises WHERE test_id = ? AND section = ?',
          [payload.testId, payload.section],
        );

        if (payload.fitnessTests.length === 0) {
          return { success: true, updatedRows: [] };
        }

        // bulk insert
        const values = payload.fitnessTests
          .map(() => '(?, ?, ?, ?, ?, ?, ?)')
          .join(',');

        const params = [
          ...payload.fitnessTests.flatMap((item) => [
            payload.testId,
            payload.section,
            item.exercise ?? '',
            item.expected ?? '',
            item.actual ?? '',
            item.feeling ?? '',
            item.notes ?? '',
          ]),
        ];

        // Вставляем
        await this.databaseService.query(
          `INSERT INTO fitness_test_exercises
           (test_id, section, exercise, expected, actual, feeling, notes)
           VALUES ${values}`,
          params,
        );

        // Возвращаем свежие строки секции
        const insertedRows = await this.databaseService.query(
          `SELECT id, section, exercise, expected, actual, feeling, notes
           FROM fitness_test_exercises
           WHERE test_id = ? AND section = ?`,
          [payload.testId, payload.section],
        );

        return { success: true, updatedRows: insertedRows };
      });

      return response;
    } catch (err) {
      console.error(err);
      throw new Error('Произошла ошибка при обновлении фитнес-теста');
    }
  }

  // ====== Остальные методы (name/test CRUD) — без изменений ======
  async changeNameTest(newName: any, id: string): Promise<void> {
    try {
      await this.databaseService.query(
        'UPDATE fitness_tests SET name = ? WHERE id = ?',
        [newName.name, id],
      );
    } catch (err: any) {
      throw new Error(err.message || 'Ошибка при изменении названия теста');
    }
  }

  async deleteTestById(id: string): Promise<boolean> {
    try {
      return await this.databaseService.runTransaction(async () => {
        const existingTests = await this.databaseService.query(
          'SELECT id FROM fitness_tests WHERE id = ?',
          [id],
        );
        if (!existingTests || existingTests.length === 0) {
          return false;
        }
        await this.databaseService.query(
          'DELETE FROM fitness_test_exercises WHERE test_id = ?',
          [id],
        );
        await this.databaseService.query(
          'DELETE FROM fitness_tests WHERE id = ?',
          [id],
        );
        return true;
      });
    } catch (error) {
      console.error('Ошибка при удалении теста:', error);
      throw error;
    }
  }

  async createNewFitnessTest(payload: any): Promise<any> {
    const { clientId, name } = payload;
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const createdAt = now.toISOString().slice(0, 19);
    try {
      const existing = await this.databaseService.query(
        'SELECT id FROM fitness_tests WHERE client_id = ? AND name = ?',
        [clientId, name],
      );
      if (existing.length > 0) {
        throw new Error('Фитнес-тест с таким названием уже существует');
      }

      const response = await this.databaseService.runTransaction(async () => {
        await this.databaseService.query(
          'INSERT INTO fitness_tests (client_id, name, created_at) VALUES (?, ?, ?)',
          [clientId, name, createdAt],
        );
        const testIdResult = (await this.databaseService.query(
          'SELECT id FROM fitness_tests WHERE created_at = ? AND client_id = ?',
          [createdAt, clientId],
        )) as any;
        const testId = testIdResult[0].id;

        const sections = ['endurance', 'strength', 'flexibility', 'balance', 'mobility'];
        for (const section of sections) {
          await this.databaseService.query(
            `INSERT INTO fitness_test_exercises
             (test_id, section, exercise, expected, actual, feeling, notes)
             VALUES (?, ?, '', '', '', '', '')`,
            [testId, section],
          );
        }

        return {
          success: true,
          newTest: { id: testId, clientId, name, createdAt },
        };
      });

      return response;
    } catch (err: any) {
      throw new Error(err.message || 'Произошла ошибка при создании фитнес-теста');
    }
  }
}
