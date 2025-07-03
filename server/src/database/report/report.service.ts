import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ReportService {
  async generateMonthlyReport(clientId: string): Promise<Buffer> {
    // Подставные данные
    const data = {
      clientName: 'Иван Иванов',
      period: 'Июнь 2025',
      payments: [
        { date: '2025-06-03', amount: 5000, quantity: 10, status: 'Оплачен' },
        { date: '2025-06-17', amount: 3000, quantity: 5, status: 'Оплачен' },
      ],
      trainings: [
        { date: '2025-06-04', type: 'Персональная', duration: '60 мин' },
        { date: '2025-06-06', type: 'Групповая', duration: '45 мин' },
      ],
      steps: [
        { date: '2025-06-01', steps: 6543 },
        { date: '2025-06-02', steps: 7345 },
        { date: '2025-06-03', steps: 8233 },
      ],
      calories: [
        { date: '2025-06-01', calories: 2200 },
        { date: '2025-06-02', calories: 2100 },
        { date: '2025-06-03', calories: 2300 },
      ],
      tests: [
        { date: '2025-06-05', result: '30 отжиманий, 60 приседаний' },
        { date: '2025-06-25', result: '35 отжиманий, 65 приседаний' },
      ],
    };

    const html = this.buildHtml(data);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private buildHtml(data: any): string {
    return `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; font-size: 12px; }
          h1, h2 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
          .section { margin-bottom: 40px; }
        </style>
      </head>
      <body>
        <h1>Отчет за месяц</h1>
        <p><strong>Клиент:</strong> ${data.clientName}</p>
        <p><strong>Период:</strong> ${data.period}</p>

        <div class="section">
          <h2>Оплаты</h2>
          <table>
            <thead><tr><th>Дата</th><th>Сумма</th><th>Пакет</th><th>Статус</th></tr></thead>
            <tbody>
              ${data.payments.map(p => `
                <tr><td>${p.date}</td><td>${p.amount}</td><td>${p.quantity}</td><td>${p.status}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Тренировки</h2>
          <table>
            <thead><tr><th>Дата</th><th>Тип</th><th>Длительность</th></tr></thead>
            <tbody>
              ${data.trainings.map(t => `
                <tr><td>${t.date}</td><td>${t.type}</td><td>${t.duration}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Шаги по дням</h2>
          <table>
            <thead><tr><th>Дата</th><th>Шаги</th></tr></thead>
            <tbody>
              ${data.steps.map(s => `<tr><td>${s.date}</td><td>${s.steps}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Калории по дням</h2>
          <table>
            <thead><tr><th>Дата</th><th>Калории</th></tr></thead>
            <tbody>
              ${data.calories.map(c => `<tr><td>${c.date}</td><td>${c.calories}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Фитнес-тесты</h2>
          <table>
            <thead><tr><th>Дата</th><th>Результат</th></tr></thead>
            <tbody>
              ${data.tests.map(t => `<tr><td>${t.date}</td><td>${t.result}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    `;
  }
}
