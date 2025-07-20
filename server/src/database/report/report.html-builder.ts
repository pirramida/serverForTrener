// report.html-builder.ts
import {
  ReportDataForHtml,
  ParametrsJson,
  PhotosGroupedEntry,
  TrainingStats,
} from './report.types';

export class ReportHtmlBuilder {
  private readonly blockNamesMap: Record<string, string> = {
    goals: 'Цели клиента',
    problems: 'Проблемы и трудности',
    activity: 'Активность и привычки',
    limits: 'Ограничения и опыт',
  };

  private readonly blockFieldsMap: Record<string, Record<string, string>> = {
    goals: {
      basicGoal: 'Цель базовая',
      weightGoal: 'Цель в кг',
      nonWeightGoal: 'Цель не в кг',
      goalDate: 'Дата цели',
      idealPicture: 'Идеальная картинка',
    },
    problems: {
      currentDislikes: 'Что не нравится сейчас',
      topChallenges: 'Топ-3 трудности',
      pastAttempts: 'Прошлые попытки',
    },
    activity: {
      activityLevel: 'Уровень активности (1-5)',
      stressLevel: 'Уровень стресса (1-5)',
      sleepHours: 'Сон (часов в сутки)',
      sleepQuality: 'Качество сна',
      eatingHabits: 'Пищевые привычки',
      badHabits: 'Вредные привычки',
    },
    limits: {
      injuries: 'Травмы/ограничения',
      trainingExperience: 'Опыт тренировок',
      potentialObstacles: 'Потенциальные препятствия',
    },
  };

  private renderYearCalendar(
    trainingStats: TrainingStats | null = null,
  ): string {
    if (
      !trainingStats ||
      !trainingStats.periodStart ||
      !trainingStats.periodEnd
    ) {
      return `<div>Нет данных для отображения календаря</div>`;
    }

    const months = [
      'Янв',
      'Фев',
      'Мар',
      'Апр',
      'Май',
      'Июн',
      'Июл',
      'Авг',
      'Сен',
      'Окт',
      'Ноя',
      'Дек',
    ];
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const startDate = new Date(trainingStats.periodStart);
    const endDate = new Date(trainingStats.periodEnd);

    // Собираем карту посещаемости (date -> state)
    const attendanceMap = new Map<string, 'success' | 'fail' | 'empty'>();
    trainingStats.weeks.forEach((week) => {
      week.days.forEach((day) => {
        if (day.date) {
          attendanceMap.set(day.date, day.state);
        }
      });
    });

    // Вспомогательные функции
    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const res = new Date(d);
      res.setDate(d.getDate() + diff);
      res.setHours(0, 0, 0, 0);
      return res;
    };
    const getSunday = (d: Date) => {
      const day = d.getDay();
      const diff = day === 0 ? 0 : 7 - day;
      const res = new Date(d);
      res.setDate(d.getDate() + diff);
      res.setHours(0, 0, 0, 0);
      return res;
    };

    const displayStart = getMonday(startDate);
    const displayEnd = getSunday(endDate);

    // Генерируем линейный массив дней
    const days: Date[] = [];
    for (
      let d = new Date(displayStart);
      d <= displayEnd;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }

    // Режем по неделям (каждые 7 дней — одна колонка)
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    // Колонки с днями
    const weekColumns = weeks
      .map((week) => {
        const cells = week
          .map((day) => {
            const yyyy = day.getFullYear();
            const mm = String(day.getMonth() + 1).padStart(2, '0');
            const dd = String(day.getDate()).padStart(2, '0');
            const key = `${yyyy}-${mm}-${dd}`;

            // Вне исходного периода — просто пустая ячейка (прозрачная)
            if (day < startDate || day > endDate) {
              return `<div class="day-cell out-range" title=""></div>`;
            }

            const state = attendanceMap.get(key) || 'empty';
            let stateClass = 'day-empty';
            if (state === 'success') stateClass = 'day-success';
            else if (state === 'fail') stateClass = 'day-fail';

            return `<div class="day-cell ${stateClass}" data-date="${key}" title="${day.toLocaleDateString('ru-RU')}">${day.getDate()}</div>`;
          })
          .join('');

        return `<div class="week-col">${cells}</div>`;
      })
      .join('');

    // Подписи месяцев
    let monthLabels = '';
    let currentMonth = -1;
    weeks.forEach((week) => {
      const firstInside = week.find((d) => d >= startDate && d <= endDate);
      if (firstInside && firstInside.getMonth() !== currentMonth) {
        currentMonth = firstInside.getMonth();
        monthLabels += `<div class="month-label">${months[currentMonth]}</div>`;
      } else {
        monthLabels += `<div class="month-label"></div>`;
      }
    });

    return `
  <div class="calendar-block">
    <h2 class="section-title">
      Календарь активности (${startDate.toLocaleDateString('ru-RU')} – ${endDate.toLocaleDateString('ru-RU')})
    </h2>
    <style>
      /* ==== Календарь посещаемости (локальные стили) ==== */
      .attendance-calendar {
        font-size: 0; /* убираем межстрочные зазоры между inline-block (если появятся) */
        display: inline-block;
      }
      .attendance-calendar .month-row {
        display: flex;
        margin-left: 42px; /* ширина колонки дней недели + отступ */
        gap: 2px;
      }
      .attendance-calendar .month-label {
        width: 22px;
        font-size: 11px;
        font-weight: 600;
        text-align: left;
        color: #555;
        line-height: 1;
        user-select: none;
      }
      .attendance-calendar .calendar-body {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
      }
      .attendance-calendar .weekdays {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        margin-right: 6px;
        user-select: none;
      }
      .attendance-calendar .weekdays > div {
        width: 26px;
        height: 26px;
        margin: 2px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: #555;
      }

      .attendance-calendar .week-col {
        display: flex;
        flex-direction: column;
      }

      /* Базовая ячейка */
      .attendance-calendar .day-cell {
        width: 26px;
        height: 26px;
        margin: 2px;
        border-radius: 6px;
        background: #e0e0e4;
        font-size: 11px;
        font-weight: 700;
        line-height: 26px;
        text-align: center;
        color: #333;
        box-sizing: border-box;
        transition: background .15s, transform .15s;
      }
      .attendance-calendar .day-cell.out-range {
        background: transparent;
        color: transparent;
        pointer-events: none;
      }

      /* ВАЖНО: состояние идет ПОСЛЕ базового .day-cell */
      .attendance-calendar .day-cell.day-success {
        background: #38b000; /* зелёный */
        color: #fff;
      }
      .attendance-calendar .day-cell.day-fail {
        background: #d00000; /* красный */
        color: #fff;
      }
      .attendance-calendar .day-cell.day-empty {
        background: #ebedf0;
        color: #444;
        font-weight: 500;
      }

      .attendance-calendar .day-cell:hover {
        transform: scale(1.12);
        z-index: 2;
        position: relative;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }

      /* Легенда */
      .attendance-legend {
        display: flex;
        gap: 14px;
        margin-top: 10px;
        flex-wrap: wrap;
        font-size: 11px;
        color: #555;
      }
      .attendance-legend .leg-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .attendance-legend .leg-color {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        background: #ccc;
      }
      .attendance-legend .leg-success { background:#38b000; }
      .attendance-legend .leg-fail { background:#d00000; }
      .attendance-legend .leg-empty { background:#ebedf0; }
    </style>

    <div class="attendance-calendar">
      <div class="month-row">${monthLabels}</div>
      <div class="calendar-body">
        <div class="weekdays">
          ${weekDays.map((d) => `<div>${d}</div>`).join('')}
        </div>
        ${weekColumns}
      </div>
      <div class="attendance-legend">
        <div class="leg-item"><span class="leg-color leg-success"></span> Посещение</div>
        <div class="leg-item"><span class="leg-color leg-fail"></span> Пропуск</div>
        <div class="leg-item"><span class="leg-color leg-empty"></span> Нет данных</div>
      </div>
    </div>
  </div>
  `;
  }

  // ===== Клиентские карточки =====
  private renderClientInfoCards(clientInfo: any[]) {
    if (!clientInfo || !clientInfo.length) return '';
    return `
      <div>
        <h3 class="section-title">О клиенте</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;">
          ${clientInfo
            .map((block) => {
              const fields = Object.entries(block.data || {})
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => {
                  let value: any = v;
                  if (k === 'weightGoal') value = `${v} кг`;
                  if (k === 'sleepHours') value = `${v} часов`;
                  return `<div><strong>${this.blockFieldsMap[block.blockName]?.[k] || k}:</strong> ${value}</div>`;
                })
                .join('');
              return `
                <div style="background:rgba(123,44,191,0.05);padding:15px;border-radius:var(--border-radius);">
                  <h4 style="margin:0 0 10px;color:var(--primary);">${this.blockNamesMap[block.blockName] || block.blockName}</h4>
                  <div style="font-size:14px;line-height:1.6;">${fields || '<em>Нет данных</em>'}</div>
                </div>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // ===== Фотографии =====
  private renderPhotosPage(photos: PhotosGroupedEntry[]) {
    if (!photos || !photos.length) return '';

    const types = ['front', 'side', 'back'];
    // Группируем по типу (берём первый элемент для каждого типа)
    const grouped: Record<string, PhotosGroupedEntry | null> = {
      front: null,
      side: null,
      back: null,
    };
    photos.forEach((p) => {
      if (types.includes(p.type)) grouped[p.type] = p;
    });

    const renderTypeRow = (type: string) => {
      const entry = grouped[type];
      if (
        !entry ||
        (!entry.primaryBase64 && !entry.prevBase64 && !entry.lastBase64)
      ) {
        return '';
      }

      const photosHtml = [];

      if (entry.primaryBase64) {
        photosHtml.push(`
        <div class="photo-card">
          <img src="${entry.primaryBase64}" class="photo-img"/>
          <div class="photo-label">Первичная (${type})</div>
        </div>`);
      }
      if (entry.prevBase64) {
        photosHtml.push(`
        <div class="photo-card">
          <img src="${entry.prevBase64}" class="photo-img"/>
          <div class="photo-label">Пред. коррекция (${type})</div>
        </div>`);
      }
      if (entry.lastBase64) {
        photosHtml.push(`
        <div class="photo-card">
          <img src="${entry.lastBase64}" class="photo-img"/>
          <div class="photo-label">Послед. коррекция (${type})</div>
        </div>`);
      }

      return `<div class="photo-row">${photosHtml.join('')}</div>`;
    };

    // ... стили, контент и итоговый рендер без изменений

    const styles = ``;
    const content = types.map(renderTypeRow).filter(Boolean).join('');
    if (!content) return '';

    return `
    <div class="page">
      ${styles}
      <h2 class="section-title">Фотографии для сравнения</h2>
      <div class="photo-section">
        ${content}
      </div>
    </div>
  `;
  }

  private renderAttendanceSummary(
    periodStats: TrainingStats | null,
    totalStats: TrainingStats,
    userProvidedRange: boolean,
  ): string {
    const current = periodStats || totalStats;
    if (!current) return '';

    const assess = (p: number) => {
      if (p >= 85)
        return {
          label: 'Отлично',
          cls: 'excellent',
          note: 'Отличная дисциплина – держим курс',
        };
      if (p >= 70)
        return {
          label: 'Хорошо',
          cls: 'good',
          note: 'Уверенный прогресс – можно слегка усилить',
        };
      if (p >= 55)
        return {
          label: 'Неплохо',
          cls: 'ok',
          note: 'База есть – стабилизируй регулярность',
        };
      if (p >= 40)
        return {
          label: 'Нужно подтянуть',
          cls: 'warn',
          note: 'Повышаем приоритет тренировок',
        };
      return {
        label: 'Плохо',
        cls: 'bad',
        note: 'Нужен новый план и контроль привычек',
      };
    };

    const curEval = assess(current.successPercent);
    const totalEval = assess(totalStats.successPercent);

    const block = (
      s: TrainingStats,
      caption: string,
      evalObj: { label: string; cls: string; note: string },
    ) => {
      const missPercent = s.total
        ? Math.round((s.missCount / s.total) * 100)
        : 0;
      return `
        <div class="as-col">
          <div class="as-col-caption">${caption}</div>
          <div class="as-main-line">
            <div class="as-percent">${s.successPercent}%</div>
            <div class="as-badge ${evalObj.cls}">${evalObj.label}</div>
          </div>
            <div class="as-bar">
              <div class="as-bar-fill" style="width:${s.successPercent}%;"></div>
            </div>
          <div class="as-metrics">
            <div class="as-metric"><span>Состоялось</span><strong>${s.successCount}</strong></div>
            <div class="as-metric"><span>Пропущено</span><strong>${s.missCount}</strong></div>
            <div class="as-metric"><span>Всего</span><strong>${s.total}</strong></div>
          </div>
          <div class="as-extra">
            <span class="as-extra-item ok">Успех: ${s.successPercent}%</span>
            <span class="as-extra-item fail">Пропуск: ${missPercent}%</span>
          </div>
          <div class="as-note">${evalObj.note}</div>
        </div>
      `;
    };

    return `
      <div class="attendance-summary">
        <h3 class="as-title">Итоги посещаемости</h3>
        <div class="as-grid ${userProvidedRange && periodStats ? 'dual' : 'single'}">
          ${block(current, userProvidedRange && periodStats ? 'За выбранный период' : 'Текущий период', curEval)}
          ${userProvidedRange && periodStats ? block(totalStats, 'За всё время', totalEval) : ''}
        </div>
      </div>
    `;
  }

  private renderSessionReports(
    total: ReportDataForHtml['sessionReportsTotal'],
    period: ReportDataForHtml['sessionReportsPeriod'],
  ): string {
    const src = period || total; // приоритет диапазону, если он выбран
    if (!src) return ''; // нет данных — ничего не выводим

    function blockRows(
      rows: { label: string; count: number; percent: number }[] | undefined,
      emptyMsg = 'Нет данных',
    ) {
      if (!rows || !rows.length)
        return `<div class="dist-empty">${emptyMsg}</div>`;
      return rows
        .map(
          (r) => `
        <div class="dist-row">
          <div class="dist-label">${r.label}</div>
          <div class="dist-bar-wrap">
            <div class="dist-bar" style="width:${Math.max(2, r.percent)}%;"></div>
            <div class="dist-val">${r.count} • ${r.percent}%</div>
          </div>
        </div>
      `,
        )
        .join('');
    }

    return `
      <div class="session-reports-panel">
        <h2 class="section-title">Отчёты о сессиях</h2>

        <div class="sr-head-metrics">
          
        </div>

        <div class="sr-grids">
          <div class="sr-group">
            <div class="sr-group-title">Настроение до</div>
            ${blockRows(src.moodsBefore, 'Нет настроений')}
          </div>
          <div class="sr-group">
            <div class="sr-group-title">Настроение после</div>
            ${blockRows(src.moodsAfter, 'Нет данных')}
          </div>
          <div class="sr-group">
            <div class="sr-group-title">Интенсивность</div>
            ${blockRows(src.intensityDist, 'Нет данных')}
          </div>
          <div class="sr-group">
            <div class="sr-metric">
            <div class="sr-m-val">${src.avgRating?.toFixed(1) ?? '-'}</div>
            <div class="sr-m-cap">Средний рейтинг</div>
          </div>
          </div>
        </div>

      </div>
    `;
  }

  // ===== Активность (шаги / калории) =====
  private renderStepsAndCalories(data: ReportDataForHtml) {
    if (!data.stepsAndCalories || !data.stepsAndCalories.length) return '';
    const avgSteps = Math.round(
      data.stepsAndCalories.reduce((sum, s) => sum + (s.steps || 0), 0) /
        data.stepsAndCalories.length,
    ).toLocaleString('ru-RU');
    const avgCalories = Math.round(
      data.stepsAndCalories.reduce((sum, s) => sum + (s.calories || 0), 0) /
        data.stepsAndCalories.length,
    );

    return `
      <h2 class="section-title">Активность: шаги и калории</h2>
      <div class="panel panel-chart">
        <div class="chart-container" id="stepsChart"></div>
        <div class="chart-labels" id="stepsLabels"></div>
        <div class="two-col-metrics" style="margin-top:24px;">
          <div class="metric-box">
            <div class="metric-caption">Среднее за период</div>
            <div class="metric-value">${avgSteps}<span>шагов/день</span></div>
          </div>
          <div class="metric-box">
            <div class="metric-caption">Среднее за период</div>
            <div class="metric-value">${avgCalories}<span>ккал/день</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== Параметры тела =====
  private renderBodyParams(parametrs: ParametrsJson | null) {
    if (!parametrs) return '';
    const corrections = parametrs.corrections || [];
    const corrCount = corrections.length;

    return `
      <h2 class="section-title">Параметры тела (динамика)</h2>
      <div class="params-table-wrapper">
        <table class="params-table">
          <thead>
            <tr>
              <th class="col-param">Параметр</th>
              <th>Начальное</th>
              ${Array.from({ length: corrCount }, (_, i) => `<th>Коррекция ${i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${parametrs.primary
              .map((primaryItem) => {
                const base = Number(primaryItem.primary);
                const rowCorrs = corrections.map((group) => {
                  const found = group.find(
                    (p) => p.param === primaryItem.param,
                  );
                  if (!found) return { val: '-', diff: '', cls: 'neutral' };
                  const valNum = Number(found.corr);
                  if (isNaN(base) || isNaN(valNum))
                    return { val: found.corr, diff: '', cls: 'neutral' };
                  const diff = +(valNum - base).toFixed(1);
                  const cls =
                    diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'neutral';
                  const sign = diff > 0 ? '+' : '';
                  return {
                    val: found.corr,
                    diff: diff === 0 ? '' : `(${sign}${diff})`,
                    cls,
                  };
                });

                return `
                  <tr>
                    <td class="param-name-cell">${primaryItem.param}</td>
                    <td class="base-cell">${primaryItem.primary}</td>
                    ${rowCorrs
                      .map(
                        (c) => `
                          <td class="corr-cell ${c.cls}">
                            <div class="corr-value">${c.val}</div>
                            ${c.diff ? `<div class="corr-diff">${c.diff}</div>` : `<div class="corr-diff empty"></div>`}
                          </td>`,
                      )
                      .join('')}
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="params-legend">
        <span><span class="leg-box leg-inc"></span> Рост</span>
        <span><span class="leg-box leg-dec"></span> Снижение</span>
        <span><span class="leg-box leg-neu"></span> Без изменений / нет данных</span>
      </div>
    `;
  }

  // ===== Основной build =====

  build(data: ReportDataForHtml): string {
    const activityBlock = data.clientInfo?.find(
      (b: any) => b.blockName === 'activity',
    );
    const activityLevel = Number(activityBlock?.data?.activityLevel) || 0;
    const stressLevel = Number(activityBlock?.data?.stressLevel) || 0;

    // Страница 1
    const firstPage = `
      <div class="page">
        <div class="header">
          <div>
            <h1 class="report-title">
          Отчет YouFit
          <span class="logo-icon">
            <svg viewBox="0 0 640 512">
              <path d="M104 96H56c-13.3 0-24 10.7-24 24v104H8c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h24v104c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V120c0-13.3-10.7-24-24-24zm528 128h-24V120c0-13.3-10.7-24-24-24h-48c-13.3 0-24 10.7-24 24v272c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V288h24c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM456 32h-48c-13.3 0-24 10.7-24 24v168H256V56c0-13.3-10.7-24-24-24h-48c-13.3 0-24 10.7-24 24v400c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V288h128v168c0 13.3 10.7 24 24 24h48c13.3 0 24-10.7 24-24V56c0-13.3-10.7-24-24-24z"/>
            </svg>
          </span>
        </h1>
            <div class="date-str">${new Date().toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}</div>
          </div>
          <div class="logo">
            <div class="social-links">
            <div class="social-item"><span style={{  font-family: 'Segoe UI', Roboto, sans-serif; font-weight: 800; color: "black"}}>Тренер: Юлия Прудникова</span></div>
            <a class="social-item social-btn whatsapp" href="https://wa.me/79316299596" target="_blank" rel="noopener">
                WhatsApp
            </a>
            <a class="social-item social-btn telegram" href="https://t.me/Julie_trully" target="_blank" rel="noopener">
                Telegram (@Julie_trully)
            </a>
            </div>
          </div>
        </div>

        <div class="client-card">
          <h2 class="client-name">${data.clientName}</h2>
          <div class="client-meta">
            ${data.birthDate ? `<div class="meta-item"><strong>Дата рождения</strong> ${data.birthDate}</div>` : ''}
            <div class="meta-item"><strong>Период анализа</strong> ${data.period}</div>
            <div class="meta-item"><strong>Успешных тренировок</strong> ${data.totalSuccessSessions}</div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${data.trainingStatsTotal.successPercent}%</div>
              <div class="stat-label">Посещаемость</div>
            </div>

            ${
              activityBlock
                ? `<div class="stat-card">
                     <div class="stat-value">${activityBlock.data.activityLevel || '-'}</div>
                     <div class="stat-label">Уровень активности</div>
                     <div class="progress-level">
                       ${[1, 2, 3, 4, 5].map((i) => `<div class="level-dot ${i <= activityLevel ? 'active' : ''}"></div>`).join('')}
                     </div>
                   </div>`
                : ''
            }

            ${
              activityBlock
                ? `<div class="stat-card">
                     <div class="stat-value">${activityBlock.data.stressLevel || '-'}</div>
                     <div class="stat-label">Уровень стресса</div>
                     <div class="progress-level">
                       ${[1, 2, 3, 4, 5].map((i) => `<div class="level-dot ${i <= stressLevel ? 'active' : ''}"></div>`).join('')}
                     </div>
                   </div>`
                : ''
            }

            ${
              data.parametrs &&
              data.parametrs.primary.find((p) => p.param === 'Вес')
                ? `<div class="stat-card">
                     <div class="stat-value">${data.parametrs.primary.find((p) => p.param === 'Вес')!.primary}</div>
                     <div class="stat-label">Начальный вес</div>
                   </div>`
                : ''
            }
          </div>

          ${data.clientInfo ? this.renderClientInfoCards(data.clientInfo) : ''}
        </div>
      </div>
    `;

    // Страница 2 (фото)
    const secondPage =
      data.photosForHtml && data.photosForHtml.length
        ? this.renderPhotosPage(data.photosForHtml)
        : '';

    // Страница 3 (активность + параметры)
    const thirdPage = `
  <div class="page">
    ${this.renderYearCalendar(
      data.trainingStatsPeriod || data.trainingStatsTotal,
    )}
    ${this.renderAttendanceSummary(
      data.trainingStatsPeriod || data.trainingStatsTotal,
      data.trainingStatsTotal,
      data.userProvidedRange,
    )}
  </div>
`;

    // Страница 3 (активность + параметры)
    const thirdPage2 = `
  <div class="page">
    ${this.renderBodyParams(data.parametrs)}
  </div>
`;

    const fourPage = `
      <div class="page">
              ${this.renderStepsAndCalories(data)}
${this.renderSessionReports(data.sessionReportsTotal, data.sessionReportsPeriod)}

        <div class="footer">
          Отчет сгенерирован в YouFit • ${new Date().toLocaleDateString(
            'ru-RU',
            {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            },
          )}
        </div>
      </div>
    `;

    // Скрипт для графика шагов / калорий
    const stepsScript = `
      <script>
      document.addEventListener('DOMContentLoaded', function() {
        const stepsData = ${JSON.stringify(data.stepsAndCalories || [])};
        if (!stepsData.length) return;

        const container = document.getElementById('stepsChart');
        const labels = document.getElementById('stepsLabels');

        const step = Math.max(1, Math.floor(stepsData.length / 10));
        const filtered = stepsData.filter((_, i) => i % step === 0);
        const maxSteps = Math.max(...stepsData.map(s => s.steps || 0), 0);
        const maxCalories = Math.max(...stepsData.map(s => s.calories || 0), 0);
        const maxValue = Math.max(maxSteps, maxCalories, 1);

        filtered.forEach((s, i) => {
          const offset = (i / filtered.length) * 100;
          const stepsBar = document.createElement('div');
          stepsBar.className = 'chart-bar primary-bar';
          stepsBar.style.left = offset + '%';
          stepsBar.style.height = ((s.steps || 0) / maxValue) * 100 + '%';
          container.appendChild(stepsBar);

          const calBar = document.createElement('div');
          calBar.className = 'chart-bar secondary-bar';
          calBar.style.left = (offset + 3) + '%';
          calBar.style.height = ((s.calories || 0) / maxValue) * 100 + '%';
          calBar.style.width = '14px';
          container.appendChild(calBar);

          if (i % 3 === 0 || i === filtered.length - 1) {
            const label = document.createElement('div');
            label.textContent = s.date.split('-').reverse().join('.');
            label.className = 'chart-x-label';
            label.style.left = offset + '%';
            labels.appendChild(label);
          }
        });

        const legend = document.createElement('div');
        legend.className = 'chart-legend';
        legend.innerHTML =
          '<div><span class="legend-color primary"></span>Шаги</div>' +
          '<div><span class="legend-color secondary"></span>Калории</div>';
        container.parentNode?.appendChild(legend);
      });
      </script>
    `;

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Отчет</title>
<style>
:root {
  --primary: #5A189A;
  --primary-light: #7B2CBF;
  --primary-extra-light: #E0AAFF;
  --secondary: #9D4EDD;
  --success: #38B000;
  --danger: #D00000;
  --light: #F8F9FA;
  --dark: #212529;
  --gray: #E9ECEF;
  --border-radius: 8px;
  --shadow: 0 2px 8px rgba(90, 24, 154, 0.1);
    --white: #ffffff;
}

body {
  font-family: 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  color: var(--dark);
  background: #fff;
  line-height: 1.5;
}
.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
    flex-shrink: 0;            /* чтобы не сжималась */

}

.logo-icon svg {
  width: 20px;
  height: 20px;
}

.logo-icon svg path {
  fill: var(--white); /* Белый цвет для гантели */
}
.page {
  padding: 30px;
  page-break-after: always;
  box-sizing: border-box;
  max-width: 1000px;
  margin: 0 auto;
}


.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--primary-extra-light);
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
}

.social-links {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--dark);
}

.social-item {
  text-align: right;
  font-size: 20px;
}

.report-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  color: var(--primary);
  display: flex;            /* добавляем */
  align-items: center;       /* центрируем по вертикали */
  gap: 10px;                 /* отступ между логотипом и текстом */
}

.date-str {
  font-size: 14px;
  color: #6c757d;
  margin-top: 5px;
}

/* ===== Attendance Summary ===== */
.attendance-summary {
  margin-top:28px;
  background:#fff;
  border:1px solid var(--primary-extra-light);
  border-radius:var(--border-radius);
  padding:22px 22px 28px;
  page-break-inside:avoid;
}

.attendance-summary .as-title {
  margin:0 0 18px;
  font-size:18px;
  font-weight:700;
  color:var(--primary);
  border-bottom:2px solid #f1e4ff;
  padding-bottom:6px;
}

.as-grid {
  display:grid;
  gap:26px;
}
.as-grid.dual {
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
}
.photo-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.photo-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.photo-card.empty {
  border: 1px dashed #ccc;
  background: #fafafa;
}
.social-btn {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  color: #fff;
  transition: background 0.2s;
  text-align: center;
}

.social-btn.whatsapp {
  background: #25D366;
}

.social-btn.whatsapp:hover {
  background: #1da851;
}

.social-btn.telegram {
  background: #0088cc;
}

.social-btn.telegram:hover {
  background: #0075aa;
}

.as-col {
  position:relative;
  display:flex;
  flex-direction:column;
  gap:10px;
  background:#f9f5ff;
  border:1px solid var(--primary-extra-light);
  border-radius:14px;
  padding:16px 16px 20px;
  overflow:hidden;
}
.as-col:before {
  content:"";
  position:absolute;
  top:-40px; right:-50px;
  width:160px; height:160px;
  background:radial-gradient(circle at 30% 30%, #e0aaff55, transparent 70%);
  filter:blur(6px);
  pointer-events:none;
}

.as-col-caption {
  font-size:11px;
  font-weight:700;
  letter-spacing:.9px;
  text-transform:uppercase;
  color:#6b5685;
}

.as-main-line {
  display:flex;
  align-items:center;
  gap:14px;
  flex-wrap:wrap;
}

.as-percent {
  font-size:40px;
  font-weight:800;
  line-height:1;
  background:linear-gradient(90deg,var(--secondary),var(--primary));
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}

.as-badge {
  font-size:12px;
  font-weight:700;
  padding:6px 10px 6px;
  border-radius:30px;
  letter-spacing:.5px;
  text-transform:uppercase;
  position:relative;
}
.as-badge:before {
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  background:linear-gradient(120deg,#ffffffaa,#ffffff00);
}
.as-badge.excellent { background:linear-gradient(120deg,#38b000,#2c8900); color:#fff; }
.as-badge.good { background:linear-gradient(120deg,#5cb85c,#409e40); color:#fff; }
.as-badge.ok { background:linear-gradient(120deg,#ffbf3c,#ff9e00); color:#462e00; }
.as-badge.warn { background:linear-gradient(120deg,#ff7f3c,#ff5a2c); color:#fff; }
.as-badge.bad { background:linear-gradient(120deg,#d00035,#a10024); color:#fff; }

.as-bar {
  height:10px;
  border-radius:6px;
  background:#e8daf8;
  overflow:hidden;
  position:relative;
  box-shadow:inset 0 1px 2px #0002;
}
.as-bar-fill {
  position:absolute;
  top:0; left:0; bottom:0;
  background:linear-gradient(90deg,var(--secondary),var(--primary));
  border-radius:inherit;
  box-shadow:0 0 0 1px #ffffff55 inset;
  transition:width .4s;
}

.as-metrics {
  display:flex;
  gap:14px;
  flex-wrap:wrap;
  margin-top:2px;
}
.as-metric {
  font-size:12px;
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:90px;
}
.as-metric span {
  font-size:10px;
  letter-spacing:.7px;
  text-transform:uppercase;
  font-weight:600;
  color:#6d5d7c;
}
.as-metric strong {
  font-size:16px;
  font-weight:700;
  color:#3e2e55;
}

.as-extra {
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:2px;
}
.as-extra-item {
  font-size:10.5px;
  font-weight:600;
  background:#fff;
  border:1px solid #e3d4f5;
  padding:4px 8px 4px;
  border-radius:30px;
  letter-spacing:.4px;
  display:inline-flex;
  align-items:center;
  gap:6px;
}
.as-extra-item.ok { color:#226b00; background:#e3f9e3; border-color:#c5ebc5; }
.as-extra-item.fail { color:#941d2f; background:#ffe5ea; border-color:#ffd2db; }

.as-note {
  margin-top:4px;
  font-size:11.5px;
  font-weight:500;
  color:#4b3d5b;
  background:#fff;
  border:1px solid #eadcf6;
  padding:8px 10px;
  border-radius:10px;
  line-height:1.35;
}

/* Уплотнение при печати */
@media print {
  .attendance-summary { padding:16px 16px 18px; }
  .as-percent { font-size:32px; }
  .as-badge { font-size:11px; padding:4px 8px; }
}

.client-card {
  background: #fff;
  border-radius: var(--border-radius);
  padding: 25px;
  margin-bottom: 30px;
  border: 1px solid var(--primary-extra-light);
}

.client-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary);
  margin: 0 0 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--primary-extra-light);
}

.client-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 25px;
}

.meta-item strong {
  display: block;
  font-size: 12px;
  color: var(--primary);
  margin-bottom: 3px;
  font-weight: 600;
}

.meta-item {
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border: 1px solid var(--primary-extra-light);
  border-radius: var(--border-radius);
  padding: 15px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 5px;
  color: var(--primary);
}

.stat-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.progress-level {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 10px;
}

.level-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gray);
}

.level-dot.active {
  background: var(--primary);
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
  margin: 30px 0 15px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--primary-extra-light);
}

.session-reports-panel {
  margin-top:40px;
  background:#fff;
  border:1px solid var(--primary-extra-light);
  border-radius:var(--border-radius);
  padding:24px 22px 30px;
  page-break-inside: avoid;
}

.sr-head-metrics {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:14px;
  margin:10px 0 26px;
}

.sr-metric {
  background:#f9f5ff;
  border:1px solid var(--primary-extra-light);
  border-radius:10px;
  padding:10px 12px 12px;
  text-align:center;
  position:relative;
  overflow:hidden;
  margin-top: 20px;
}

.sr-metric:before {
  content:"";
  position:absolute;
  top:-30px; right:-40px;
  width:120px; height:120px;
  filter:blur(4px);
}

.sr-m-val {
  font-size:30px;
  font-weight:700;
  color:var(--primary);
  line-height:1;
  margin-bottom:4px;
}
.sr-m-cap {
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.5px;
  font-weight:600;
  color:#6c5a7e;
}

.sr-grids {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  gap:26px 32px;
}

.sr-group {
  display:flex;
  flex-direction:column;
  gap:10px;
}

.sr-group-title {
  font-size:13px;
  font-weight:700;
  letter-spacing:.5px;
  text-transform:uppercase;
  color:var(--primary);
  position:relative;
  padding-left:6px;
}
.sr-group-title:before {
  content:"";
  position:absolute;
  left:0; top:4px;
  width:3px; height:14px;
  background:var(--primary-light);
  border-radius:2px;
}

.dist-row {
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
}

.dist-label {
  flex:0 0 90px;
  font-weight:600;
  color:#4b3b60;
  word-break:break-word;
}

.dist-bar-wrap {
  flex:1;
  position:relative;
  background:#f3e9ff;
  border:1px solid #e7d5f9;
  border-radius:20px;
  height:18px;
  display:flex;
  align-items:center;
  overflow:hidden;
  padding-right:6px;
}

.dist-bar {
  position:absolute;
  left:0; top:0; bottom:0;
  background:linear-gradient(90deg, var(--secondary), var(--primary));
  border-radius:inherit;
  box-shadow:0 0 0 1px #ffffff55 inset, 0 2px 6px -2px rgba(90,24,154,0.6);
}

.dist-val {
  position:relative;
  margin-left:auto;
  font-size:11px;
  font-weight:600;
  color:#3a2f4d;
  letter-spacing:.3px;
  background:#ffffffd9;
  padding:2px 4px;
  border-radius:6px;
  box-shadow:0 0 0 1px #ece1f4;
}

.dist-empty {
  font-size:11px;
  font-style:italic;
  color:#7a6d87;
  background:#faf6ff;
  border:1px dashed #e2d3f5;
  padding:6px 10px;
  border-radius:8px;
}

.panel {
  background: #fff;
  border-radius: var(--border-radius);
  padding: 20px;
  margin-bottom: 25px;
  border: 1px solid var(--primary-extra-light);
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 15px;
}

.photo-card {
  border-radius: var(--border-radius);
  background: #fff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--primary-extra-light);
}

.photo-img {
  width: 100%;
  height: 220px;
  object-fit: contain;
  background: #f9f5ff;
  border-radius: var(--border-radius);
  margin-bottom: 10px;
}

.photo-label {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.chart-container {
  height: 200px;
  position: relative;
  margin-top: 15px;
  background: #f9f5ff;
  border-radius: var(--border-radius);
  overflow: hidden;
  border: 1px solid var(--primary-extra-light);
}

.chart-bar {
  position: absolute;
  bottom: 0;
  border-radius: 3px 3px 0 0;
}

.primary-bar {
  background: var(--primary);
  width: 16px;
}

.secondary-bar {
  background: var(--secondary);
  width: 12px;
}

.chart-labels {
  position: relative;
  height: 20px;
  margin-top: 5px;
}

.chart-x-label {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  color: #5c5c66;
  font-size: 10px;
}

.chart-legend {
  display: flex;
  gap: 15px;
  font-size: 12px;
  margin-top: 10px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
  margin-right: 5px;
}

.legend-color.primary {
  background: var(--primary);
}

.legend-color.secondary {
  background: var(--secondary);
}

.two-col-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.metric-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  background: #f9f5ff;
  border-radius: var(--border-radius);
  border: 1px solid var(--primary-extra-light);
}

.metric-caption {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
}

.metric-value span {
  font-size: 12px;
  font-weight: 500;
  color: #6c757d;
}

.params-table-wrapper {
  overflow-x: auto;
  background: #fff;
  border-radius: var(--border-radius);
  padding: 10px;
  border: 1px solid var(--primary-extra-light);
  margin-bottom: 25px;
}

.params-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
  font-size: 12px;
}

.params-table thead tr {
  background: var(--primary);
  color: #fff;
}

.params-table th, .params-table td {
  padding: 8px 10px;
  text-align: center;
  border: 1px solid var(--primary-extra-light);
}

.params-table th {
  font-weight: 600;
  font-size: 11px;
}

.col-param {
  min-width: 150px;
}

.params-table tbody tr:nth-child(even) {
  background: #f9f5ff;
}

.param-name-cell {
  text-align: left;
  font-weight: 600;
  color: var(--primary);
}

.base-cell {
  font-weight: 600;
  background: #f3e9ff;
}

.corr-cell .corr-value {
  font-weight: 600;
  font-size: 13px;
}

.corr-diff {
  font-size: 11px;
  margin-top: 3px;
}

.corr-diff.empty {
  visibility: hidden;
}
.corr-cell.increase {
    background: rgba(208, 0, 0, 0.12); /* мягкий красный */

    color: #5e0000;
}

.corr-cell.decrease {
  background: rgba(56, 176, 0, 0.15); /* мягкий зелёный */
    color: #2b5e00;
}

.corr-cell.neutral {
  background: #f9f9f9;
  color: #333;
}
.params-legend {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  font-size: 12px;
  color: #555;
}

.leg-box {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
  margin-right: 5px;
}

.leg-inc {
  background: var(--danger);
}

.leg-dec {
  background: var(--success);
}

.leg-neu {
  background: #c8c8d0;
}

.footer {
  text-align: center;
  font-size: 12px;
  color: #6c757d;
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid var(--primary-extra-light);
}

@media print {
  body {
    font-size: 12px;
  }
  .page {
    padding: 20px;
  }
  .report-title {
    font-size: 24px;
  }
  .client-name {
    font-size: 20px;
  }
  .stat-value {
    font-size: 20px;
  }
}
</style>
</head>
<body>
  ${firstPage}
  ${secondPage}
  ${thirdPage}
        ${thirdPage2}
  ${fourPage}
  ${stepsScript}
</body>
</html>
    `;
  }
}
