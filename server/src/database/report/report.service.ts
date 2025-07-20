import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { DatabaseService } from '../database.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  ReportDataForHtml,
  ParametrsJson,
  PhotosGroupedEntry,
  SessionHistoryRow,
  SessionReportsStats,
  TrainingStats,
  ClientRow,
  PhotoRow,
} from './report.types';
import { ReportHtmlBuilder } from './report.html-builder';
import * as sharp from 'sharp';

@Injectable()
export class ReportService {
  constructor(private readonly databaseService: DatabaseService) {}
  /**
   * @param clientId  - обязателен
   * @param startDate - опционально (фильтр пользователя для посещаемости и шагов/калорий)
   * @param endDate   - опционально
   */
  async generateMonthlyReport(
    clientId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Buffer> {
    if (!clientId) {
      throw new HttpException('clientId is required', HttpStatus.BAD_REQUEST);
    }
    // ---- Клиент
    const clientRows = (await this.databaseService.query(
      `SELECT id, name, birthDate, clientInfo, stepsAndCalories, parametrs, sessions, createdAt
         FROM clients WHERE id = ?`,
      [clientId],
    )) as any[];
    if (!clientRows || clientRows.length === 0) {
      throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
    }
    const clientRow = clientRows[0];
    // Определяем, задал ли пользователь фильтр вручную
    const userProvidedRange = Boolean(startDate || endDate); // >>> ключевой флаг
    // ---- Определяем фактический полный период существования клиента
    // Если пользователь не передал — вычисляем "полный" диапазон
    if (!userProvidedRange) {
      const createdAt = clientRow.createdAt as string; // формат "YYYY-MM-DD HH:MM:SS"
      // Максимальная дата из посещений
      const maxSessionDateRow = (await this.databaseService.query(
        `SELECT MAX(COALESCE(trainingTime, date)) as maxDate
           FROM session_history WHERE clientId = ?`,
        [clientId],
      )) as { maxDate: string }[];
      let maxDate = maxSessionDateRow?.[0]?.maxDate ?? null;
      // Fallback — шаги
      if (!maxDate) {
        const steps = this.safeParse(clientRow.stepsAndCalories);
        if (steps && steps.length) {
          maxDate = steps
            .map((s: any) => s.date)
            .sort()
            .pop();
        }
      }
      // Fallback — параметры (если вообще нужно)
      if (!maxDate) {
        maxDate = new Date().toISOString().slice(0, 10);
      }
      startDate =
        createdAt?.split(' ')[0] || new Date().toISOString().slice(0, 10);
      endDate = maxDate?.split(' ')[0] || new Date().toISOString().slice(0, 10);
    } else {
      // Если фильтр задан частично — нормализуем
      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        startDate = startDate.slice(0, 10);
      }
      if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        endDate = endDate.slice(0, 10);
      }
    }
    // ---- JSON поля
    const clientInfo = this.safeParse(clientRow.clientInfo);
    const stepsAndCaloriesAll =
      this.safeParse(clientRow.stepsAndCalories) || [];
    const parametrsRaw = this.safeParse(clientRow.parametrs);
    // ---- Обработка параметров тела: берём последние 5 коррекций независимо от диапазона
    let parametrs = parametrsRaw;
    if (parametrs?.corrections?.length) {
      // Сортируем коррекции по дате
      parametrs.corrections.sort((a: any[], b: any[]) => {
        const da = this.extractCorrectionDate(a);
        const db = this.extractCorrectionDate(b);
        return da.getTime() - db.getTime(); // по возрастанию
      });
      // Берём последние 5
      if (parametrs.corrections.length > 5) {
        parametrs.corrections = parametrs.corrections.slice(-5);
      }
    }
    // ---- Фото

    type PrimaryFoto = {
      url: string;
      uploaded_at: string;
      is_primary: number;
      type: string;
    };

    type CorrectionFoto = {
      url: string;
      uploaded_at: string;
      is_primary: number;
      type: string;
      folderId: number;
      folder_created_at: string;
    };

    // 1) Первичные фото (как есть)
    const primaryPhotos = (await this.databaseService.query(
      `SELECT url, uploaded_at, is_primary, type
   FROM clients_fotos
   WHERE clientsId = ? AND is_primary = 1
   ORDER BY type, uploaded_at ASC`,
      [clientId],
    )) as PrimaryFoto[];

    // 2) Получаем уникальные папки коррекций (по дате)
    const correctionFolders = (await this.databaseService.query(
      `SELECT DISTINCT fol.id as folderId, fol.created_at
   FROM clients_fotos f
   JOIN folders fol ON fol.id = f.folderId
   WHERE f.clientsId = ? AND f.is_primary = 0
   ORDER BY fol.created_at ASC`,
      [clientId],
    )) as { folderId: number; created_at: string }[];

    // Если нет папок — просто не будет коррекций
    let lastFolderId: number | null = null;
    let prevFolderId: number | null = null;

    if (correctionFolders.length > 0) {
      lastFolderId = correctionFolders[correctionFolders.length - 1].folderId;
      if (correctionFolders.length > 1) {
        prevFolderId = correctionFolders[correctionFolders.length - 2].folderId;
      }
    }

    // 3) Забираем фото ТОЛЬКО из последних двух папок (если есть)
    let correctionsPhotos: CorrectionFoto[] = [];
    if (lastFolderId !== null) {
      const ids: number[] =
        prevFolderId !== null ? [prevFolderId, lastFolderId] : [lastFolderId];
      const placeholders = ids.map(() => '?').join(',');
      correctionsPhotos = (await this.databaseService.query(
        `SELECT f.url,
            f.uploaded_at,
            f.is_primary,
            f.type,
            f.folderId,
            fol.created_at as folder_created_at
     FROM clients_fotos f
     JOIN folders fol ON fol.id = f.folderId
     WHERE f.clientsId = ?
       AND f.is_primary = 0
       AND f.folderId IN (${placeholders})
     ORDER BY fol.created_at ASC, f.type ASC, f.uploaded_at ASC`,
        [clientId, ...ids],
      )) as CorrectionFoto[];
    }

    // 4) Группируем: type → { primary, prev?, last? }
    const photosByType: Record<
      string,
      {
        primary?: PrimaryFoto;
        prev?: CorrectionFoto | null;
        last?: CorrectionFoto | null;
      }
    > = {};

    // Помещаем первичные
    primaryPhotos.forEach((p) => {
      if (!photosByType[p.type]) photosByType[p.type] = {};
      if (!photosByType[p.type].primary) photosByType[p.type].primary = p;
    });

    // Разбиваем коррекции по папкам
    const prevMap: Record<string, CorrectionFoto | null> = {};
    const lastMap: Record<string, CorrectionFoto | null> = {};

    for (const c of correctionsPhotos) {
      if (!photosByType[c.type]) photosByType[c.type] = {};
      if (c.folderId === prevFolderId) {
        // Берём первый по типу (либо реши брать последний: тогда перезаписывай)
        if (!prevMap[c.type]) prevMap[c.type] = c;
      }
      if (c.folderId === lastFolderId) {
        if (!lastMap[c.type]) lastMap[c.type] = c;
      }
    }

    // Записываем prev/last
    Object.keys(photosByType).forEach((type) => {
      photosByType[type].prev = prevMap[type] || null;
      photosByType[type].last = lastMap[type] || null;
    });

    // 5) Формируем окончательный массив для билда
    const photosForHtml: PhotosGroupedEntry[] = await Promise.all(
      Object.entries(photosByType).map(async ([type, group]) => {
        const primaryBase64 = group.primary
          ? await this.imageToBase64(group.primary.url)
          : '';
        const prevBase64 =
          group.prev && prevFolderId !== null
            ? await this.imageToBase64(group.prev.url)
            : '';
        const lastBase64 =
          group.last && lastFolderId !== null
            ? await this.imageToBase64(group.last.url)
            : '';
        // Если вообще нет ни одного — можно отфильтровать позже
        return { type, primaryBase64, prevBase64, lastBase64 };
      }),
    );

    // (опционально) убираем полностью пустые типы:
    const cleanedPhotosForHtml = photosForHtml.filter(
      (p) => p.primaryBase64 || p.prevBase64 || p.lastBase64,
    );

    // ---- Сессии (всегда ограничиваем выбранным (или вычисленным) диапазоном)
    const allSessionsRows = (await this.databaseService.query(
      `SELECT action, trainingTime, date, report
   FROM session_history
   WHERE clientId = ?
   ORDER BY COALESCE(trainingTime, date) ASC`,
      [clientId],
    )) as {
      action: string;
      trainingTime?: string;
      date?: string;
      report?: string;
    }[];
    let filteredSessionsRows: typeof allSessionsRows = allSessionsRows;
    if (userProvidedRange) {
      filteredSessionsRows = allSessionsRows.filter((r) => {
        const raw =
          r.trainingTime && r.trainingTime.trim()
            ? r.trainingTime.trim()
            : (r.date || '').trim();
        if (!raw) return false;
        let iso = raw.replace(' ', 'T');
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) iso += ':00';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return false;
        const dateKey = d.toISOString().slice(0, 10);
        return dateKey >= startDate! && dateKey <= endDate!;
      });
    }
    const trainingStatsTotal = this.processSessionHistory(allSessionsRows); // полный период
    const trainingStatsPeriod = userProvidedRange
      ? this.processSessionHistory(allSessionsRows, startDate, endDate) // пробрасываем даты, не только отфильтрованные rows
      : null;
    const totalSuccessSessions = trainingStatsTotal.successCount;
    // ---- Шаги и калории: фильтруем только если пользователь задал период
    const parseDate = (d: string | Date) => {
      if (d instanceof Date) return d;
      // d в формате DD.MM.YYYY
      const [day, month, year] = d.split('.');
      return new Date(`${year}-${month}-${day}`);
    };

    const stepsAndCalories = userProvidedRange
      ? stepsAndCaloriesAll.filter((s: any) => {
          const date = parseDate(s.date).getTime();
          const start = parseDate(startDate!).getTime();
          const end = parseDate(endDate!).getTime();
          console.log(
            `Проверка записи: ${s.date} -> ${date >= start} ${date <= end}`,
          );
          return date >= start && date <= end;
        })
      : stepsAndCaloriesAll;

    console.log(
      'stepsAndCalories (после фильтра):',
      stepsAndCalories.map((s: any) => s.date),
    );

    const sessionReportsTotal = this.processSessionReports(allSessionsRows);
    const sessionReportsPeriod = userProvidedRange
      ? this.processSessionReports(allSessionsRows, startDate, endDate)
      : null;
    // ---- Формируем данные для HTML
    const data: ReportDataForHtml = {
      clientName: clientRow.name || 'Без имени',
      birthDate: clientRow.birthDate || null,
      clientInfo: clientInfo || null,
      stepsAndCalories,
      parametrs: parametrs || null,
      totalSuccessSessions,
      period: `${startDate} — ${endDate}`,
      photosForHtml: cleanedPhotosForHtml,
      trainingStatsPeriod,
      trainingStatsTotal,
      userProvidedRange,
      sessionReportsTotal,
      sessionReportsPeriod,
    };

    data.period = `${this.formatDateHuman(startDate)} — ${this.formatDateHuman(endDate)}`;
    data.birthDate = this.formatDateHuman(data.birthDate);
    data.stepsAndCalories = this.formatAllDates(data.stepsAndCalories);
    data.parametrs = this.formatAllDates(data.parametrs);

    const html = new ReportHtmlBuilder().build(data);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private normalizeDate(raw?: string | null): string | null {
    if (!raw) return null;
    // Отсекаем время, если есть
    const base = raw.trim().split(/[ T]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  private formatDateHuman(raw?: string | null): string {
    const iso = this.normalizeDate(raw);
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  private formatAllDates(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.formatAllDates(v));
    } else if (obj && typeof obj === 'object') {
      const res: any = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = this.formatAllDates(v);
      }
      return res;
    } else if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj)) {
      return this.formatDateHuman(obj);
    }
    return obj;
  }

  private async optimizeImage(filePath: string): Promise<Buffer> {
    try {
      const optimizedBuffer = await sharp(filePath)
        .rotate() // <-- вот эта строка исправит ориентацию фото по EXIF
        .resize({ width: 1200 }) // уменьшаем ширину до 1200px, сохраняя пропорции
        .jpeg({ quality: 75 }) // сжимаем JPEG с качеством 75
        .toBuffer();
      return optimizedBuffer;
    } catch (err) {
      console.error('[ReportService] Error optimizing image:', filePath, err);
      // Если не удалось оптимизировать — возвращаем оригинал
      return fs.promises.readFile(filePath);
    }
  }

  // --- Вспомогательная: достать дату из группы коррекции
  private extractCorrectionDate(group: any[]): Date {
    const dateItem = group.find((g) => g.param === 'Дата');
    const val = dateItem?.corr || dateItem?.primary;
    const d = new Date(val || '1970-01-01');
    return isNaN(d.getTime()) ? new Date('1970-01-01') : d;
  }
  private processSessionReports(
    rows: {
      report?: string;
      action: string;
      trainingTime?: string;
      date?: string;
    }[],
    startDate?: string,
    endDate?: string,
  ) {
    // Нормализуем диапазон (если дан) для фильтра
    const dateInRange = (isoDay: string) =>
      (!startDate || isoDay >= startDate) && (!endDate || isoDay <= endDate);
    interface Counters {
      before: Record<string, number>;
      after: Record<string, number>;
      intensity: Record<string, number>;
      type: Record<string, number>;
      ratingSum: number;
      ratingCount: number;
      improvements: number;
      totalMoodPairs: number;
      withComment: number;
    }
    const c: Counters = {
      before: {},
      after: {},
      intensity: {},
      type: {},
      ratingSum: 0,
      ratingCount: 0,
      improvements: 0,
      totalMoodPairs: 0,
      withComment: 0,
    };
    const moodScale: Record<string, number> = {
      Плохо: 1,
      Устал: 2,
      Нормально: 3,
      Хорошо: 4,
      Отлично: 5,
    };
    const intensityScale: Record<string, number> = {
      Низкая: 1,
      Средняя: 2,
      Высокая: 3,
    };
    for (const r of rows) {
      if (!r.report) continue;
      let rep: any;
      try {
        rep = JSON.parse(r.report);
      } catch {
        continue;
      }
      // Дата сессии (берём trainingTime/date/report.sessionDate)
      let raw =
        (r.trainingTime && r.trainingTime.trim()) ||
        (r.date && r.date.trim()) ||
        (rep.sessionDate && rep.sessionDate.trim()) ||
        '';
      if (!raw) continue;
      let iso = raw.replace(' ', 'T');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) iso += ':00';
      let d = new Date(iso);
      if (isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10);
      if (!dateInRange(dayKey)) continue;
      const before = rep.conditionBefore?.trim();
      const after = rep.conditionAfter?.trim();
      const intensity = rep.intensity?.trim();
      const type = rep.type?.trim();
      const rating = rep.rating;
      const comment = rep.comment?.trim();
      if (before) c.before[before] = (c.before[before] || 0) + 1;
      if (after) c.after[after] = (c.after[after] || 0) + 1;
      if (intensity) c.intensity[intensity] = (c.intensity[intensity] || 0) + 1;
      if (type) c.type[type] = (c.type[type] || 0) + 1;
      if (comment) c.withComment++;
      if (typeof rating === 'number' && !isNaN(rating)) {
        c.ratingSum += rating;
        c.ratingCount++;
      }
      if (before && after && moodScale[before] && moodScale[after]) {
        c.totalMoodPairs++;
        if (moodScale[after] > moodScale[before]) c.improvements++;
      }
    }
    const avgRating = c.ratingCount
      ? +(c.ratingSum / c.ratingCount).toFixed(2)
      : 0;
    const improvementPercent = c.totalMoodPairs
      ? +((c.improvements / c.totalMoodPairs) * 100).toFixed(2)
      : 0;
    // Преобразуем в массивы для удобного рендера (и считаем проценты)
    function toDist(obj: Record<string, number>) {
      const total = Object.values(obj).reduce((s, v) => s + v, 0) || 1;
      return Object.entries(obj)
        .map(([k, v]) => ({
          label: k,
          count: v,
          percent: +((v / total) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);
    }
    return {
      avgRating,
      improvementPercent,
      withCommentCount: c.withComment,
      withCommentPercent: c.ratingCount
        ? +((c.withComment / (c.ratingCount || 1)) * 100).toFixed(1)
        : 0,
      moodsBefore: toDist(c.before),
      moodsAfter: toDist(c.after),
      intensityDist: toDist(c.intensity),
      typeDist: toDist(c.type),
      rawCounts: c,
    };
  }
  // =========================================================================== Session history
  private processSessionHistory(
    rows: {
      action: string;
      trainingTime?: string | null;
      date?: string | null;
    }[],
    startDate?: string,
    endDate?: string,
  ) {
    interface Normalized {
      dateKey: string; // YYYY-MM-DD
      success: boolean; // была ли хотя бы одна "Списание тренировки" в этот день
    }
    // --- 1. Нормализация исходных записей к дням
    const perDay: Record<string, { success: boolean; actions: string[] }> = {};
    for (const r of rows) {
      const rawBase =
        r.trainingTime && r.trainingTime.trim()
          ? r.trainingTime.trim()
          : (r.date || '').trim();
      if (!rawBase) continue;
      // Приводим к ISO-подобному (если формат 'YYYY-MM-DD HH:MM')
      let iso = rawBase.replace(' ', 'T');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) {
        iso += ':00';
      }
      let d = new Date(iso);
      if (isNaN(d.getTime())) {
        d = new Date(rawBase); // вторая попытка
        if (isNaN(d.getTime())) continue;
      }
      const dateKey = d.toISOString().slice(0, 10); // UTC день
      if (!perDay[dateKey]) {
        perDay[dateKey] = { success: false, actions: [] };
      }
      perDay[dateKey].actions.push(r.action);
      if (r.action === 'Списание тренировки') {
        perDay[dateKey].success = true;
      }
    }
    const allDates = Object.keys(perDay).sort();
    // --- 2. Определяем фактические границы периода
    if (allDates.length === 0) {
      // Нет данных — возвращаем пустую структуру
      return {
        successCount: 0,
        missCount: 0,
        total: 0,
        successPercent: 0,
        rating: this.classifySuccess(0),
        weeks: [] as {
          days: { date: string; state: 'success' | 'fail' | 'empty' }[];
        }[],
        periodStart: startDate || null,
        periodEnd: endDate || null,
      };
    }
    let periodStart =
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? startDate
        : allDates[0];
    let periodEnd =
      endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        ? endDate
        : allDates[allDates.length - 1];
    // Если случайно перепутаны местами
    if (periodStart > periodEnd) {
      [periodStart, periodEnd] = [periodEnd, periodStart];
    }
    // --- 3. Считаем статистику ТОЛЬКО внутри периода (на случай, если rows шире)
    const consideredDates = allDates.filter(
      (d) => d >= periodStart && d <= periodEnd,
    );
    const successCount = consideredDates.filter(
      (d) => perDay[d].success,
    ).length;
    const missCount = consideredDates.filter((d) => !perDay[d].success).length;
    const total = successCount + missCount;
    const successPercent =
      total === 0 ? 0 : +((successCount / total) * 100).toFixed(2);
    const rating = this.classifySuccess(successPercent);
    // --- 4. Генерируем список всех дней периода (включительно)
    const startObj = new Date(periodStart + 'T00:00:00');
    const endObj = new Date(periodEnd + 'T00:00:00');
    startObj.setHours(0, 0, 0, 0);
    endObj.setHours(0, 0, 0, 0);
    // --- 5. Подготовка календаря (GitHub-стиль: столбец — неделя, строки — Пн..Вс)
    // Найдём понедельник недели, в которую попадает periodStart
    const startWeek = new Date(startObj);
    const wd = (startWeek.getDay() + 6) % 7; // Преобразуем так, что Пн=0
    if (wd !== 0) {
      startWeek.setDate(startWeek.getDate() - wd);
    }
    // Конец — воскресенье недели, содержащей periodEnd
    const endWeek = new Date(endObj);
    const wdEnd = (endWeek.getDay() + 6) % 7; // Пн=0
    if (wdEnd !== 6) {
      endWeek.setDate(endWeek.getDate() + (6 - wdEnd));
    }
    const weeks: {
      days: { date: string; state: 'success' | 'fail' | 'empty' }[];
    }[] = [];
    for (
      let cursor = new Date(startWeek);
      cursor.getTime() <= endWeek.getTime();
      cursor.setDate(cursor.getDate() + 7)
    ) {
      const week: { date: string; state: 'success' | 'fail' | 'empty' }[] = [];
      for (let i = 0; i < 7; i++) {
        const cellDate = new Date(cursor);
        cellDate.setDate(cursor.getDate() + i);
        const key = cellDate.toISOString().slice(0, 10);
        if (key < periodStart || key > periodEnd) {
          // Вне анализируемого диапазона — "empty"
          week.push({ date: '', state: 'empty' });
          continue;
        }
        if (perDay[key]) {
          week.push({
            date: key,
            state: perDay[key].success ? 'success' : 'fail',
          });
        } else {
          week.push({ date: key, state: 'empty' });
        }
      }
      weeks.push({ days: week });
    }
    return {
      successCount,
      missCount,
      total,
      successPercent,
      rating,
      weeks,
      periodStart,
      periodEnd,
    };
  }
  private classifySuccess(percent: number): string {
    if (percent <= 25)
      return 'Низкая вовлечённость (риск отсутствия прогресса)';
    if (percent <= 50) return 'Недостаточно — нужно повысить регулярность';
    if (percent <= 75) return 'Средний уровень — есть прогресс, но можно лучше';
    if (percent <= 90) return 'Хорошо — стабильное посещение';
    return 'Отлично — высокая дисциплина';
  }
  // ==== JSON helper
  private safeParse(json: string | null) {
    try {
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }
  // ==== Images
  private resolveImagePath(rawUrl: string): string | null {
    if (!rawUrl) return null;
    const cwd = process.cwd();
    const ROOT_UPLOADS = path.join(cwd, 'uploads');
    const norm = rawUrl.trim().replace(/\\/g, '/');
    if (path.isAbsolute(norm)) {
      if (fs.existsSync(norm)) return norm;
      const alt = path.normalize(norm);
      if (fs.existsSync(alt)) return alt;
    }
    const idx = norm.toLowerCase().indexOf('uploads/');
    if (idx >= 0) {
      const tail = norm.slice(idx + 'uploads/'.length);
      const candidate = path.join(ROOT_UPLOADS, tail);
      if (fs.existsSync(candidate)) return candidate;
    }
    const noLead = norm.replace(/^\/+/, '');
    const candidate2 = path.join(ROOT_UPLOADS, noLead);
    if (fs.existsSync(candidate2)) return candidate2;
    const fileName = path.basename(norm);
    const found = this.findFileByName(ROOT_UPLOADS, fileName, 6);
    if (found) return found;
    console.warn('[ReportService] Image not found (resolve failed):', rawUrl);
    return null;
  }
  private findFileByName(
    dir: string,
    fileName: string,
    maxDepth: number,
    depth = 0,
  ): string | null {
    if (depth > maxDepth) return null;
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return null;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        const found = this.findFileByName(full, fileName, maxDepth, depth + 1);
        if (found) return found;
      } else if (stat.isFile() && entry === fileName) {
        return full;
      }
    }
    return null;
  }
  private async imageToBase64(rawUrl: string): Promise<string> {
    const fullPath = this.resolveImagePath(rawUrl);
    if (!fullPath) return '';
    try {
      // Используем оптимизацию
      const buffer = await this.optimizeImage(fullPath);
      const mimeType = this.getMimeType(fullPath);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.error(
        '[ReportService] Error reading or optimizing image file:',
        fullPath,
        err,
      );
      return '';
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }
}
