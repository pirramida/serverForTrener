// report.types.ts

/** Строка из таблицы clients */
export interface ClientRow {
  id: number;
  name: string;
  birthDate: string | null;
  clientInfo: string | null;
  stepsAndCalories: string | null;
  parametrs: string | null;
  sessions: number | null;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"
}

/** Строка из session_history */
export interface SessionHistoryRow {
  action: string;
  trainingTime?: string | null;
  date?: string | null;
  report?: string | null;
}

/** Фото клиента */
export interface PhotoRow {
  url: string;
  uploaded_at: string;
  is_primary: number;
  type: string;
  folderId?: number | null;
  folder_created_at?: string;
}


/** Элемент первичных параметров тела */
export interface ParamPrimaryItem {
  param: string;
  primary: string | number;
}

/** Элемент одной коррекции */
export interface ParamCorrectionItem {
  param: string;
  corr: string | number;
}

/** JSON поле parametrs */
export interface ParametrsJson {
  primary: ParamPrimaryItem[];
  corrections?: ParamCorrectionItem[][]; // массив "групп" коррекций
}

/** Фото, подготовленное для вставки в HTML */
export interface PhotosGroupedEntry {
  type: string;
  primaryBase64: string;
  prevBase64: string;
  lastBase64: string;
}

/** Статистика посещаемости */
export interface TrainingStats {
  successCount: number;
  missCount: number;
  total: number;
  successPercent: number;
  rating: string;
  weeks: { days: { date: string; state: 'success' | 'fail' | 'empty' }[] }[];
  periodStart: string | null;
  periodEnd: string | null;
}

/** Распределения по отчётам сессий */
export interface SessionReportDistributionRow {
  label: string;
  count: number;
  percent: number;
}

/** Сводные данные по отчётам сессий (настроение, интенсивность и т.д.) */
export interface SessionReportsStats {
  avgRating: number;
  improvementPercent: number;
  withCommentCount: number;
  withCommentPercent: number;
  moodsBefore: SessionReportDistributionRow[];
  moodsAfter: SessionReportDistributionRow[];
  intensityDist: SessionReportDistributionRow[];
  typeDist: SessionReportDistributionRow[];
  rawCounts: any;
}

/** Итоговая структура, которую целиком получает HTML‑билдер */
export interface ReportDataForHtml {
  clientName: string;
  birthDate: string | null;
  clientInfo: any; // можно уточнить позже (массив блоков)
  stepsAndCalories: { date: string; steps?: number; calories?: number }[];
  parametrs: ParametrsJson | null;
  totalSuccessSessions: number;
  period: string;
  photosForHtml: PhotosGroupedEntry[];
  trainingStatsTotal: TrainingStats;
  trainingStatsPeriod: TrainingStats | null;
  userProvidedRange: boolean;
  sessionReportsTotal: SessionReportsStats | null;
  sessionReportsPeriod: SessionReportsStats | null;
}
