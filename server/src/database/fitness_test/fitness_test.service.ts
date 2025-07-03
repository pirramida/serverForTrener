import { HttpException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class FitnessTestService {
  constructor(private readonly databaseService: DatabaseService) { }

  // fitness_test_exercises
  async getFitnessTestsClient(clientId: number, nameColumn: any, table: string): Promise<any> {
    try {
      const params = nameColumn ?? '*';
      const currentTable = table ?? 'fitness_tests'

      const response = await this.databaseService.query(`SELECT ${params} FROM ${currentTable} WHERE client_id = ?`, [clientId]) as any; //sql инъекции

      return { data: response, message: true };
    } catch (err) {
      throw new Error(`Ошибка при получении данных с сервера: ${err.message}`);
    }
  }

  async getFitnessTestsClient_exercises(testId: number, nameColumn: any, table: string): Promise<any> {
    const params = nameColumn ?? '*';
    const currentTable = table ?? 'fitness_test_exercises';
    const response = await this.databaseService.query(
      `SELECT ${params} FROM ${currentTable} WHERE test_id = ?`,
      [testId]
    );
    return { data: response, message: true };
  }



  async changeFitnessTest(payload: {
    clientId: number;
    fitnessTests: any[]; // данные для одной секции
    testId: number;
    section: string; // добавим сюда раздел
  }) {
    try {
      const response = await this.databaseService.runTransaction(async () => {

        // Удаляем упражнения для этого теста и секции
        await this.databaseService.query(
          'DELETE FROM fitness_test_exercises WHERE test_id = $1 AND section = $2',
          [payload.testId, payload.section]
        );

        if (payload.fitnessTests.length === 0) {
          // Если данных нет — просто выходим
          return { success: true };
        }

        // Формируем bulk insert
        const values = payload.fitnessTests
          .map(
            (_, idx) =>
              `($1, $2, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5}, $${idx * 5 + 6}, $${idx * 5 + 7})`
          )
          .join(',');

        // Параметры для вставки:
        // 1 - testId
        // 2 - section
        // Далее - поля упражнений по 5 штук на каждый ряд
        const params = [
          payload.testId,
          payload.section,
          ...payload.fitnessTests.flatMap((item) => [
            item.exercise,
            item.expected,
            item.actual,
            item.feeling,
            item.notes,
          ]),
        ];

        await this.databaseService.query(
          `INSERT INTO fitness_test_exercises 
       (test_id, section, exercise, expected, actual, feeling, notes) 
       VALUES ${values}`,
          params
        );

        return { success: true };
      })
    } catch (err) {
      console.error(err);
      throw new Error('Произошла ошибка при обновлении фитнес теста');
    }
  }

  async deleteExerciseById(id: string): Promise<any> {

    try {
      const response = await this.databaseService.runTransaction(async () => {

        // Проверяем, есть ли упражнение с таким id
        const existing = await this.databaseService.query(
          'SELECT id FROM fitness_test_exercises WHERE id = ?',
          [id]
        );

        if (existing.length === 0) {
          throw new Error('Упражнение не найдено');
        }

        // Удаляем упражнение
        await this.databaseService.query(
          'DELETE FROM fitness_test_exercises WHERE id = ?',
          [id]
        );

        return { success: true };
      })
    } catch (error) {
      // Логируем и пробрасываем ошибку дальше
      console.error('Ошибка при удалении упражнения:', error.message);
      throw new Error(error.message || 'Ошибка при удалении упражнения');
    }
  }

  async changeNameTest(newName: any, id: string): Promise<void> {
    try {
      this.databaseService.query('UPDATE fitness_tests SET name = ? WHERE id = ?', [newName.name, id])
    } catch (err) {
      throw new Error(err.message || 'Ошибка при изменении названия теста');
    }
  }

  async deleteTestById(id: string): Promise<boolean> {
    try {
      return await this.databaseService.runTransaction(async () => {
        // Проверяем, есть ли тест с таким id
        const existingTests = await this.databaseService.query(
          'SELECT id FROM fitness_tests WHERE id = ?',
          [id]
        );

        if (existingTests.length === 0) {
          // Тест не найден — возвращаем false, чтобы контроллер вернул 404
          return false;
        }

        // Удаляем все упражнения, связанные с тестом
        await this.databaseService.query(
          'DELETE FROM fitness_test_exercises WHERE test_id = ?',
          [id]
        );

        // Удаляем сам тест
        await this.databaseService.query(
          'DELETE FROM fitness_tests WHERE id = ?',
          [id]
        );

        return true; // успешное удаление
      });
    } catch (error) {
      console.error('Ошибка при удалении теста:', error);
      throw error; // бросаем дальше, чтобы контроллер вернул 500
    }
  }


  async createNewFitnessTest(payload: any): Promise<any> {
    const { clientId, name } = payload;

    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const createdAt = now.toISOString().slice(0, 19);

    try {
      // Проверка: есть ли уже тест с таким именем для этого клиента
      const existing = await this.databaseService.query(
        'SELECT id FROM fitness_tests WHERE client_id = ? AND name = ?',
        [clientId, name]
      );

      if (existing.length > 0) {
        throw new Error('Фитнес-тест с таким названием уже существует');
      }

      // Транзакция на вставку теста и его секций
      const response = await this.databaseService.runTransaction(async () => {
        const result: any = await this.databaseService.query(
          'INSERT INTO fitness_tests (client_id, name, created_at) VALUES (?, ?, ?)',
          [clientId, name, createdAt]
        );
        const testIdResult = await this.databaseService.query('SELECT id FROM fitness_tests WHERE created_at = ? AND client_id = ?', [createdAt, clientId]) as any;
        const testId = testIdResult[0].id;
        const sections = ["endurance", "strength", "flexibility", "balance", "mobility"];

        for (const section of sections) {
          await this.databaseService.query(
            `INSERT INTO fitness_test_exercises 
            (test_id, section, exercise, expected, actual, feeling, notes)
           VALUES (?, ?, '', '', '', '', '')`,
            [testId, section]
          );
        }

        return {
          success: true,
          newTest: {
            id: testId,
            clientId,
            name,
            createdAt,
          },
        };
      });

      return response;

    } catch (err: any) {
      throw new Error(err.message || 'Произошла ошибка при создании фитнес-теста');
    }
  }



}
