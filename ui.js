/* CTT-SIS Tiến độ học tập - dashboard UI. */
(function () {
  'use strict';

  let hostEl;
  let shadow;
  let panelOpen = false;
  let currentPanelMode = null;
  let assetsPromise;
  let selectedModules = [];
  let selectedThesisType = 'bachelor';
  let copyHandlerBound = false;
  let chartTooltipBound = false;
  const PROGRAM_PATH = '/Students/StudentProgram.aspx';
  const MARKS_PATH = '/Students/StudentCourseMarks.aspx';
  const GENERAL_PATH = MARKS_PATH;
  const SELECTED_MODULE_KEY = 'cttbk_selected_module';

  function fmt(n) {
    return (Math.round(n * 100) / 100).toString();
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[ch]);
  }

  function extensionURL(path) {
    return globalThis.chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL(path)
      : null;
  }

  function setText(id, value) {
    const el = shadow && shadow.getElementById(id);
    if (el) el.textContent = value;
  }

  function summarize(courses) {
    const total = courses.length;
    const done = courses.filter(c => c.taken).length;
    const totalCredit = courses.reduce((s, c) => s + (c.credit || 0), 0);
    const doneCredit = courses.filter(c => c.taken).reduce((s, c) => s + (c.credit || 0), 0);
    return {
      total,
      done,
      totalCredit,
      doneCredit,
      missing: courses.filter(c => !c.taken),
      passed: courses.filter(c => c.taken),
    };
  }

  function statusFor(rule, sum) {
    if (rule === 'all') {
      return sum.done === sum.total
        ? { label: 'Hoàn thành', cls: 'done' }
        : { label: `Thiếu ${sum.total - sum.done} môn · ${sum.totalCredit - sum.doneCredit} TC`, cls: 'todo' };
    }
    return sum.done >= rule
      ? { label: `Đã đủ ${sum.done}/${rule} môn`, cls: 'done' }
      : { label: `Cần thêm ${rule - sum.done} môn`, cls: 'todo' };
  }

  function gradeText(value) {
    return value == null || value === '' || Number.isNaN(value) ? '-' : escapeHTML(value);
  }

  function scoreText(course) {
    if (!course.credit) return '-';
    return gradeText(course.score);
  }

  function codeCell(course) {
    const code = escapeHTML(course.code);
    if (course.taken) return `<td class="code">${code}</td>`;
    return `<td class="code">
      <span class="code-with-copy">
        <span>${code}</span>
        <button class="copy-code-btn" type="button" data-code="${code}" title="Copy mã HP" aria-label="Copy mã HP ${code}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </span>
    </td>`;
  }

  function courseTable(courses, showCredit, showGrades) {
    if (!courses.length) return '<div class="empty-note">Không có môn nào.</div>';
    return `<table class="course-list">
      ${showGrades ? `<thead><tr>
        <th>Mã HP</th>
        <th>Tên học phần</th>
        ${showCredit ? '<th class="credit-head">TC</th>' : ''}
        <th>Điểm chữ</th>
        <th>Điểm số</th>
      </tr></thead>` : ''}
      <tbody>${courses.map(c => `
      <tr>
        ${codeCell(c)}
        <td>${escapeHTML(c.name)}</td>
        ${showCredit ? `<td class="credit">${escapeHTML(c.credit || 0)}</td>` : ''}
        ${showGrades ? `<td class="grade-cell">${gradeText(c.grade)}</td><td class="grade-cell">${scoreText(c)}</td>` : ''}
      </tr>`).join('')}</tbody></table>`;
  }

  function gradeRank(letter) {
    const point = gradePoint(letter);
    return point == null ? -2 : point;
  }

  function gradePoint(letter) {
    const grade = String(letter || '').trim().toUpperCase();
    return {
      'A+': 4,
      A: 4,
      'B+': 3.5,
      B: 3,
      'C+': 2.5,
      C: 2,
      'D+': 1.5,
      D: 1,
      F: 0,
    }[grade] ?? null;
  }

  function gradeBadge(letter) {
    const grade = String(letter || '-').trim().toUpperCase() || '-';
    const cls = grade.replace('+', 'plus').toLowerCase();
    const known = ['a', 'aplus', 'b', 'bplus', 'c', 'cplus', 'd', 'dplus', 'f', 'r'].includes(cls);
    return `<span class="grade-badge grade-${known ? cls : 'unknown'}">${escapeHTML(grade)}</span>`;
  }

  function summaryGrade(letter) {
    const grade = String(letter || '-').trim().toUpperCase() || '-';
    const cls = grade.replace('+', 'plus').toLowerCase();
    const known = ['a', 'aplus', 'b', 'bplus', 'c', 'cplus', 'd', 'dplus', 'f', 'r'].includes(cls);
    return `<span class="summary-grade grade-${known ? cls : 'unknown'}">${escapeHTML(grade)}</span>`;
  }

  function gradePointText(letter) {
    const point = gradePoint(letter);
    return point == null ? '-' : escapeHTML(point);
  }

  function markScoreText(value) {
    return value == null || Number.isNaN(value) ? '-' : escapeHTML(value);
  }

  function sortMarks(rows, direction) {
    const sign = direction === 'worst' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const rankDiff = gradeRank(a.letterGrade) - gradeRank(b.letterGrade);
      if (rankDiff) return rankDiff * sign;
      const examDiff = (a.examScore ?? -1) - (b.examScore ?? -1);
      if (examDiff) return examDiff * sign;
      const processDiff = (a.processScore ?? -1) - (b.processScore ?? -1);
      if (processDiff) return processDiff * sign;
      return a.name.localeCompare(b.name, 'vi');
    });
  }

  function normalizeCourseCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  function isPassingGrade(letter) {
    const point = gradePoint(letter);
    return point != null && point > 0;
  }

  function recalculateTermStats(generalRows, markRows) {
    const terms = Array.from(new Set(generalRows.map(row => row.term).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b)));
    const marks = markRows
      .filter(row => /^\d{5}$/.test(String(row.term || '')) && row.credit > 0 && normalizeCourseCode(row.code))
      .map(row => ({
        ...row,
        code: normalizeCourseCode(row.code),
        point: gradePoint(row.letterGrade),
      }))
      .filter(row => row.point != null);

    const latestPassTermByCode = new Map();
    marks.forEach(row => {
      if (!isPassingGrade(row.letterGrade)) return;
      const current = latestPassTermByCode.get(row.code);
      if (!current || String(row.term).localeCompare(String(current)) > 0) {
        latestPassTermByCode.set(row.code, row.term);
      }
    });

    const stats = new Map();
    terms.forEach(term => {
      const activeAttempts = new Map();
      
      const attemptsByCode = new Map();
      marks.forEach(row => {
        if (String(row.term).localeCompare(String(term)) > 0) return;
        if (!attemptsByCode.has(row.code)) {
          attemptsByCode.set(row.code, []);
        }
        attemptsByCode.get(row.code).push(row);
      });
      
      attemptsByCode.forEach((attempts, code) => {
        const passingAttempts = attempts.filter(row => isPassingGrade(row.letterGrade));
        if (passingAttempts.length > 0) {
          const best = passingAttempts.sort((a, b) => {
            if (b.point !== a.point) return b.point - a.point;
            return String(b.term).localeCompare(String(a.term));
          })[0];
          activeAttempts.set(code, best);
        } else {
          const latest = attempts.sort((a, b) => String(b.term).localeCompare(String(a.term)))[0];
          activeAttempts.set(code, latest);
        }
      });

      let accumulatedCredits = 0;
      let cpaCredits = 0;
      let weightedPoints = 0;
      
      activeAttempts.forEach(row => {
        const isPass = isPassingGrade(row.letterGrade);
        if (isPass) {
          accumulatedCredits += row.credit;
        }
        cpaCredits += row.credit;
        weightedPoints += row.credit * row.point;
      });

      let calculatedDebt = 0;
      activeAttempts.forEach(row => {
        if (row.point === 0) {
          calculatedDebt += row.credit;
        }
      });

      stats.set(term, {
        recalculatedCpa: cpaCredits ? weightedPoints / cpaCredits : null,
        recalculatedAccumulatedCredits: accumulatedCredits,
        calculatedDebt: calculatedDebt
      });
    });

    return stats;
  }

  function effectiveMarkRows(rows) {
    return rows.map(row => {
      const code = normalizeCourseCode(row.code);
      if (!code) return { ...row, oldLetterGrades: [] };
      
      const otherAttempts = rows.filter(r => 
        normalizeCourseCode(r.code) === code && 
        r !== row
      );
      
      const earlierAttempts = otherAttempts.filter(r => 
        String(r.term || '').localeCompare(String(row.term || '')) < 0
      );
      
      const oldLetterGrades = earlierAttempts.map(r => r.letterGrade).filter(Boolean);
      const isImproved = isPassingGrade(row.letterGrade) && earlierAttempts.length > 0;
      
      return {
        ...row,
        oldLetterGrades,
        isImproved: row.isImproved || isImproved,
        originalGrade: row.originalGrade || (earlierAttempts.length > 0 ? earlierAttempts[earlierAttempts.length - 1].letterGrade : null)
      };
    });
  }

  function applyRecalculatedGeneralRows(generalRows, markRows) {
    if (!generalRows.length || !markRows.length) return generalRows;
    const stats = recalculateTermStats(generalRows, markRows);
    return generalRows.map(row => {
      const stat = stats.get(row.term);
      if (!stat) return row;
      return {
        ...row,
        rawCpa: row.cpa,
        rawAccumulatedCredits: row.accumulatedCredits,
        rawDebtCredits: row.debtCredits,
        cpa: stat.recalculatedCpa,
        accumulatedCredits: stat.recalculatedAccumulatedCredits,
        debtCredits: stat.calculatedDebt,
      };
    });
  }

  function arcPath(cx, cy, r, a0, a1) {
    const toRad = a => (a - 90) * Math.PI / 180;
    const x0 = cx + r * Math.cos(toRad(a0));
    const y0 = cy + r * Math.sin(toRad(a0));
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  }

  function gaugeSVG(cpa) {
    const r = 50;
    const cx = 64;
    const cy = 64;
    const start = -220;
    const end = 40;
    const pct = Math.max(0, Math.min(1, cpa / 4));
    const fillEnd = start + (end - start) * pct;
    return `<svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="CPA ${fmt(cpa)} trên 4.0">
      <path d="${arcPath(cx, cy, r, start, end)}" fill="none" stroke="#EEE8E8" stroke-width="10" stroke-linecap="round"/>
      <path d="${arcPath(cx, cy, r, start, fillEnd)}" fill="none" stroke="#9C1010" stroke-width="10" stroke-linecap="round"/>
      <text x="64" y="61" text-anchor="middle" font-weight="700" font-size="28" fill="#101010">${fmt(cpa)}</text>
      <text x="64" y="84" text-anchor="middle" font-size="15" font-weight="700" fill="#666666">/ 4.0</text>
    </svg>`;
  }

  function safeNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value) ? value : null;
  }

  function valueText(value) {
    const n = safeNumber(value);
    return n == null ? '-' : escapeHTML(fmt(n));
  }

  function warningLevel(value) {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function warningClass(value) {
    const level = warningLevel(value);
    if (level === 0) return 'warning-good';
    if (level === 1 || level === 2) return 'warning-warn';
    if (level != null && level >= 3) return 'warning-danger';
    return 'warning-unknown';
  }

  function levelNumber(value) {
    const text = String(value || '').toLowerCase();
    if (/ba|3/.test(text)) return 3;
    if (/hai|2/.test(text)) return 2;
    if (/nhất|mot|một|1/.test(text)) return 1;
    return 0;
  }

  function tooltipText(lines) {
    return escapeHTML(lines.filter(line => line != null && line !== '').join('\n'));
  }

  function latestTermRows(rows) {
    return rows.slice().sort((a, b) => String(b.term).localeCompare(String(a.term)));
  }

  function chartPoints(rows, key, min, max, width, height, pad) {
    const denom = Math.max(1, max - min);
    const count = Math.max(1, rows.length - 1);
    return rows.map((row, index) => {
      const value = safeNumber(row[key]) ?? min;
      const x = pad + (width - pad * 2) * (index / count);
      const y = height - pad - ((value - min) / denom) * (height - pad * 2);
      return { x, y, value, term: row.term };
    });
  }

  function lineChartSVG(rows) {
    if (!rows.length) return '<div class="empty-note">Không có dữ liệu kết quả học tập.</div>';
    const ordered = rows.slice().sort((a, b) => String(a.term).localeCompare(String(b.term)));
    const width = 680;
    const height = 260;
    const pad = 34;
    const gpa = chartPoints(ordered, 'gpa', 0, 4, width, height, pad);
    const cpa = chartPoints(ordered, 'cpa', 0, 4, width, height, pad);
    const polyline = points => points.map(p => `${p.x},${p.y}`).join(' ');
    const labels = ordered.map((row, index) => {
      const x = pad + (width - pad * 2) * (index / Math.max(1, ordered.length - 1));
      return `<text x="${x}" y="${height - 8}" text-anchor="middle">${escapeHTML(row.term)}</text>`;
    }).join('');

    return `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ GPA và CPA theo học kỳ">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="chart-axis"/>
      <text x="8" y="${pad + 4}" class="chart-label">4.0</text>
      <text x="8" y="${height - pad}" class="chart-label">0</text>
      <polyline points="${polyline(gpa)}" class="chart-line chart-line-gpa"/>
      <polyline points="${polyline(cpa)}" class="chart-line chart-line-cpa"/>
      ${gpa.map((p, index) => `<circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot chart-dot-gpa" data-tooltip="${tooltipText([p.term, `GPA: ${valueText(p.value)}`, `CPA: ${valueText(ordered[index].cpa)}`])}"></circle>`).join('')}
      ${cpa.map((p, index) => `<circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot chart-dot-cpa" data-tooltip="${tooltipText([p.term, `CPA: ${valueText(p.value)}`, `GPA: ${valueText(ordered[index].gpa)}`])}"></circle>`).join('')}
      ${labels}
    </svg>
    <div class="chart-legend"><span class="legend-gpa">GPA</span><span class="legend-cpa">CPA</span></div>`;
  }

  function termCreditChartSVG(rows) {
    if (!rows.length) return '<div class="empty-note">Không có dữ liệu tín chỉ.</div>';
    const ordered = rows.slice().sort((a, b) => String(a.term).localeCompare(String(b.term)));
    const width = 680;
    const height = 260;
    const pad = 34;
    const maxValue = Math.max(1, ...ordered.map(row => Math.max(
      safeNumber(row.passedCredits) ?? 0,
      safeNumber(row.debtCredits) ?? 0
    )));
    const slot = (width - pad * 2) / Math.max(1, ordered.length);
    const barW = Math.min(20, Math.max(8, slot / 4));
    const bars = ordered.map((row, index) => {
      const x = pad + slot * index + slot / 2;
      const passed = safeNumber(row.passedCredits) ?? 0;
      const debt = safeNumber(row.debtCredits) ?? 0;
      const passedH = (passed / maxValue) * (height - pad * 2);
      const debtH = (debt / maxValue) * (height - pad * 2);
      return `
        <rect x="${x - barW - 2}" y="${height - pad - passedH}" width="${barW}" height="${passedH}" class="chart-bar chart-bar-passed chart-mark" data-tooltip="${tooltipText([row.term, `TC qua: ${valueText(passed)}`, `TC nợ ĐK: ${valueText(debt)}`])}"></rect>
        <rect x="${x + 2}" y="${height - pad - debtH}" width="${barW}" height="${debtH}" class="chart-bar chart-bar-debt chart-mark" data-tooltip="${tooltipText([row.term, `TC nợ ĐK: ${valueText(debt)}`, `TC qua: ${valueText(passed)}`])}"></rect>
        <text x="${x}" y="${height - 8}" text-anchor="middle">${escapeHTML(row.term)}</text>
      `;
    }).join('');

    return `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ tín chỉ học kỳ">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="chart-axis"/>
      <text x="8" y="${pad + 4}" class="chart-label">${escapeHTML(maxValue)}</text>
      <text x="8" y="${height - pad}" class="chart-label">0</text>
      ${bars}
    </svg>
    <div class="chart-legend"><span class="legend-passed">TC qua</span><span class="legend-debt">TC nợ ĐK</span></div>`;
  }

  function cumulativeCreditChartSVG(rows) {
    if (!rows.length) return '<div class="empty-note">Không có dữ liệu tín chỉ tích lũy.</div>';
    const ordered = rows.slice().sort((a, b) => String(a.term).localeCompare(String(b.term)));
    const width = 680;
    const height = 260;
    const pad = 34;
    const maxValue = Math.max(1, ...ordered.map(row => Math.max(
      safeNumber(row.accumulatedCredits) ?? 0,
      safeNumber(row.registeredCredits) ?? 0
    )));
    const accumulated = chartPoints(ordered, 'accumulatedCredits', 0, maxValue, width, height, pad);
    const registered = chartPoints(ordered, 'registeredCredits', 0, maxValue, width, height, pad);
    const polyline = points => points.map(p => `${p.x},${p.y}`).join(' ');
    const labels = ordered.map((row, index) => {
      const x = pad + (width - pad * 2) * (index / Math.max(1, ordered.length - 1));
      return `<text x="${x}" y="${height - 8}" text-anchor="middle">${escapeHTML(row.term)}</text>`;
    }).join('');

    return `<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ tín chỉ tích lũy">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="chart-axis"/>
      <text x="8" y="${pad + 4}" class="chart-label">${escapeHTML(maxValue)}</text>
      <text x="8" y="${height - pad}" class="chart-label">0</text>
      <polyline points="${polyline(accumulated)}" class="chart-line chart-line-cpa"/>
      <polyline points="${polyline(registered)}" class="chart-line chart-line-registered"/>
      ${accumulated.map((p, index) => `<circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot chart-dot-cpa" data-tooltip="${tooltipText([p.term, `TC tích lũy: ${valueText(p.value)}`, `TC ĐK: ${valueText(ordered[index].registeredCredits)}`])}"></circle>`).join('')}
      ${registered.map((p, index) => `<circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot chart-dot-registered" data-tooltip="${tooltipText([p.term, `TC ĐK: ${valueText(p.value)}`, `TC tích lũy: ${valueText(ordered[index].accumulatedCredits)}`])}"></circle>`).join('')}
      ${labels}
    </svg>
    <div class="chart-legend"><span class="legend-cpa">TC tích lũy</span><span class="legend-registered">TC ĐK</span></div>`;
  }

  function statusTimelineSVG(rows) {
    if (!rows.length) return '<div class="empty-note">Không có dữ liệu trạng thái.</div>';
    const ordered = rows.slice().sort((a, b) => String(a.term).localeCompare(String(b.term)));
    const width = 680;
    const height = 260;
    const pad = 44;
    const count = Math.max(1, ordered.length - 1);
    const levelPoints = ordered.map((row, index) => {
      const level = levelNumber(row.level);
      const x = pad + (width - pad * 2) * (index / count);
      const y = height - pad - (Math.min(3, Math.max(0, level)) / 3) * (height - pad * 2);
      return { x, y, level, row };
    });
    const warningPoints = ordered.map((row, index) => {
      const level = warningLevel(row.warning) ?? 0;
      const x = pad + (width - pad * 2) * (index / count);
      const y = height - pad - (Math.min(3, Math.max(0, level)) / 3) * (height - pad * 2);
      return { x, y, level, row };
    });
    const levelLine = levelPoints.map(p => `${p.x},${p.y}`).join(' ');
    const warningLine = warningPoints.map(p => `${p.x},${p.y}`).join(' ');

    return `<svg class="trend-chart status-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ trình độ và cảnh báo theo học kỳ">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="chart-axis"/>
      ${[0, 1, 2, 3].map(level => {
        const y = height - pad - (level / 3) * (height - pad * 2);
        return `<line x1="${pad}" y1="${y}" x2="${width - pad}" y2="${y}" class="chart-grid-line"/><text x="10" y="${y + 4}" class="chart-label">${level}</text>`;
      }).join('')}
      <polyline points="${levelLine}" class="chart-line chart-line-level"/>
      <polyline points="${warningLine}" class="chart-line chart-line-warning"/>
      ${levelPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" class="chart-dot chart-dot-level" data-tooltip="${tooltipText([p.row.term, `Trình độ: ${p.row.level || '-'}`, `Cảnh báo: ${p.row.warning || '-'}`])}"></circle>`).join('')}
      ${warningPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" class="chart-dot ${warningClass(p.row.warning)}" data-tooltip="${tooltipText([p.row.term, `Cảnh báo: ${p.row.warning || '-'}`, `Trình độ: ${p.row.level || '-'}`])}"></circle>`).join('')}
      ${levelPoints.map(p => `<text x="${p.x}" y="${height - 8}" text-anchor="middle">${escapeHTML(p.row.term)}</text>`).join('')}
    </svg>
    <div class="chart-legend"><span class="legend-level">Trình độ</span><span class="legend-good">Mức 0</span><span class="legend-registered">Mức 1-2</span><span class="legend-gpa">Mức 3+</span></div>`;
  }

  async function loadAssets() {
    if (!assetsPromise) {
      const stylesURL = extensionURL('styles.css');
      const panelURL = extensionURL('panel.html');
      if (!stylesURL || !panelURL) {
        assetsPromise = Promise.reject(new Error('Extension runtime is unavailable. Reload the CTT-SIS tab after reloading the extension.'));
        return assetsPromise;
      }
      assetsPromise = Promise.all([
        fetch(stylesURL).then(r => r.text()),
        fetch(panelURL).then(r => r.text()),
      ]).then(([css, html]) => ({ css, html }));
    }
    return assetsPromise;
  }

  async function getLastModule() {
    try {
      const stored = window.localStorage.getItem(SELECTED_MODULE_KEY);
      if (stored != null && stored !== '') {
        return stored.split(',').map(Number).filter(n => !isNaN(n));
      }
    } catch (e) {}

    try {
      if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) return [];
      const r = await chrome.storage.local.get(SELECTED_MODULE_KEY);
      const stored = r[SELECTED_MODULE_KEY];
      if (stored != null && stored !== '') {
        return stored.split(',').map(Number).filter(n => !isNaN(n));
      }
    } catch (e) {}
    
    return [];
  }

  function setLastModule(nums) {
    const val = nums.join(',');
    try {
      window.localStorage.setItem(SELECTED_MODULE_KEY, val);
    } catch (e) {}

    try {
      if (globalThis.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [SELECTED_MODULE_KEY]: val });
      }
    } catch (e) {}
  }

  const THESIS_TYPE_KEY = 'cttbk_thesis_type';

  async function getThesisType() {
    try {
      const stored = window.localStorage.getItem(THESIS_TYPE_KEY);
      if (stored === 'bachelor' || stored === 'research') return stored;
    } catch (e) {}

    try {
      if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) return 'bachelor';
      const r = await chrome.storage.local.get(THESIS_TYPE_KEY);
      const stored = r[THESIS_TYPE_KEY];
      if (stored === 'bachelor' || stored === 'research') return stored;
    } catch (e) {}
    
    return 'bachelor';
  }

  function setThesisType(val) {
    try {
      window.localStorage.setItem(THESIS_TYPE_KEY, val);
    } catch (e) {}

    try {
      if (globalThis.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [THESIS_TYPE_KEY]: val });
      }
    } catch (e) {}
  }

  function getEffectiveCategories(model) {
    const categories = { ...model.categories };
    if (categories.da) {
      categories.da = categories.da.filter(c => {
        if (selectedThesisType === 'bachelor') {
          return c.credit <= 6;
        } else {
          return c.credit > 6;
        }
      });
    }
    if (selectedThesisType === 'research') {
      delete categories.tt;
    }
    return categories;
  }

  function computeTotals(model) {
    const data = window.CTTBK_DATA;
    let all = [];
    const effCategories = getEffectiveCategories(model);
    Object.values(effCategories).forEach(arr => { all = all.concat(arr); });
    
    Object.values(model.categories).forEach(arr => {
      arr.forEach(c => {
        if (c.taken && !all.some(x => x.code === c.code)) {
          all.push(c);
        }
      });
    });
    
    let selectedModuleCourses = [];
    if (selectedModules && selectedModules.length > 0) {
      selectedModules.forEach(mNum => {
        if (model.modules[mNum]) {
          selectedModuleCourses = selectedModuleCourses.concat(model.modules[mNum].courses);
        }
      });
    }
    const uniqueModCourses = Array.from(new Map(selectedModuleCourses.map(c => [c.code, c])).values());
    all = all.concat(uniqueModCourses);
    all = Array.from(new Map(all.map(c => [c.code, c])).values());

    const gradeable = all.filter(c => c.taken && c.credit > 0 && typeof c.score === 'number' && !isNaN(c.score));
    const totalW = gradeable.reduce((s, c) => s + c.credit * c.score, 0);
    const totalC = gradeable.reduce((s, c) => s + c.credit, 0);
    const cpa = totalC ? totalW / totalC : 0;
    const doneCredit = all.filter(c => c.taken).reduce((s, c) => s + (c.credit || 0), 0);
    let requiredCredit = 0;
    let missingCredit = 0;

    function requiredCreditsFor(meta, courses) {
      if (meta.rule === 'all') return courses.reduce((s, c) => s + (c.credit || 0), 0);
      return courses
        .map(c => c.credit || 0)
        .sort((a, b) => b - a)
        .slice(0, meta.rule)
        .reduce((s, credit) => s + credit, 0);
    }

    function missingCreditsFor(meta, courses) {
      const sum = summarize(courses);
      if (meta.rule === 'all') return Math.max(0, sum.totalCredit - sum.doneCredit);
      if (sum.done >= meta.rule) return 0;
      const passedCredits = sum.passed
        .map(c => c.credit || 0)
        .sort((a, b) => b - a)
        .slice(0, meta.rule)
        .reduce((s, credit) => s + credit, 0);
      return Math.max(0, requiredCreditsFor(meta, courses) - passedCredits);
    }

    Object.entries(effCategories).forEach(([key, courses]) => {
      const meta = data.catMeta[key];
      if (!meta || meta.optional) return;
      requiredCredit += requiredCreditsFor(meta, courses);
    });

    requiredCredit += uniqueModCourses.reduce((s, c) => s + (c.credit || 0), 0);

    data.mandatoryKeys.forEach(k => {
      const meta = data.catMeta[k];
      if (meta) missingCredit += missingCreditsFor(meta, effCategories[k] || []);
    });

    if (uniqueModCourses.length > 0) {
      const modSum = summarize(uniqueModCourses);
      missingCredit += Math.max(0, modSum.totalCredit - modSum.doneCredit);
    }

    return { cpa, doneCredit, requiredCredit, missingCredit };
  }

  function categoryCardHTML(key, model) {
    const meta = window.CTTBK_DATA.catMeta[key];
    const effCategories = getEffectiveCategories(model);
    let courses = effCategories[key] || [];
    const sum = summarize(courses);
    const st = statusFor(meta.rule, sum);
    const requirementMet = st.cls === 'done';
    const pct = meta.rule === 'all'
      ? (sum.totalCredit ? sum.doneCredit / sum.totalCredit * 100 : (sum.total ? sum.done / sum.total * 100 : 100))
      : Math.min(100, sum.done / meta.rule * 100);
    const detailBlocks = [];

    if (sum.total === 0) {
      return `<article class="course-card">
        <div class="card-head"><h4>${escapeHTML(meta.name)}</h4></div>
        <div class="empty-note">Không tìm thấy môn nào thuộc khối này trong bảng hiện tại.</div>
      </article>`;
    }

    if (key === 'da') {
      detailBlocks.push(`
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 13px; font-weight: bold; color: var(--ink);">Loại đồ án:</span>
          <select id="thesisTypeSelect" style="padding: 4px 8px; border: 1px solid var(--line); border-radius: 4px; font-size: 13px; cursor: pointer; background: white; color: var(--ink);">
            <option value="bachelor" ${selectedThesisType === 'bachelor' ? 'selected' : ''}>Cử nhân (6 TC)</option>
            <option value="research" ${selectedThesisType === 'research' ? 'selected' : ''}>Kỹ sư / Nghiên cứu (10-12 TC)</option>
          </select>
        </div>
      `);
    }

    if (key === 'td') {
      courses = sum.passed;
    }

    if (courses.length > 0) {
      detailBlocks.push(`<details>
        <summary>Danh sách học phần</summary>
        ${courseTable(courses, true, true)}
      </details>`);
    }

    return `<article class="course-card">
      <div class="card-head">
        <h4>${escapeHTML(meta.name)}</h4>
        <span class="rule-tag">${meta.rule === 'all' ? 'Bắt buộc' : `Cần qua ${meta.rule} môn`}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill ${st.cls === 'todo' ? 'todo' : ''}" style="--pct:${Math.max(0, Math.min(100, pct))}%"></div></div>
      <div class="meta-line">
        <span>${sum.done}/${sum.total} môn đã qua${sum.totalCredit ? ` · ${sum.doneCredit}/${sum.totalCredit} TC` : ''}</span>
        <span class="badge-status ${st.cls}">${escapeHTML(st.label)}</span>
      </div>
      ${st.cls === 'done' && meta.rule !== 'all' ? `<div class="pass-row">${sum.passed.map(c => `<span class="pass-chip">${escapeHTML(c.code)}</span>`).join('')}</div>` : ''}
      ${detailBlocks.join('')}
    </article>`;
  }

  function moduleLabel(model, n) {
    const m = model.modules[n];
    return m.name ? `Mô đun ${n}: ${m.name}` : `Mô đun ${n}`;
  }

  function moduleBodyHTML(model) {
    if (!selectedModules || selectedModules.length === 0) {
      return '<div class="empty-note">Vui lòng chọn ít nhất một mô đun.</div>';
    }
    
    let combinedCourses = [];
    selectedModules.forEach(mNum => {
      if (model.modules[mNum]) {
        combinedCourses = combinedCourses.concat(model.modules[mNum].courses);
      }
    });
    
    const uniqueCourses = Array.from(new Map(combinedCourses.map(c => [c.code, c])).values())
      .sort((a, b) => a.code.localeCompare(b.code));
      
    if (uniqueCourses.length === 0) {
      return '<div class="empty-note">Không tìm thấy học phần nào trong các mô đun đã chọn.</div>';
    }
    
    const sum = summarize(uniqueCourses);
    const pct = sum.totalCredit ? sum.doneCredit / sum.totalCredit * 100 : 0;
    const done = sum.done === sum.total;
    return `
      <div class="progress-bar" style="margin-top:16px;"><div class="progress-fill ${done ? '' : 'todo'}" style="--pct:${Math.max(0, Math.min(100, pct))}%"></div></div>
      <div class="meta-line">
        <span>${sum.done}/${sum.total} môn đã qua · ${sum.doneCredit}/${sum.totalCredit} TC</span>
        <span class="badge-status ${done ? 'done' : 'todo'}">${done ? 'Hoàn thành' : `Thiếu ${sum.total - sum.done} môn · ${sum.totalCredit - sum.doneCredit} TC`}</span>
      </div>
      <details>
        <summary>Xem danh sách môn và điểm</summary>
        ${courseTable(uniqueCourses, true, true)}
      </details>
    `;
  }

  function fillDashboard(model) {
    const moduleNums = Object.keys(model.modules).map(Number).sort((a, b) => a - b);
    if (!selectedModules || selectedModules.length === 0) {
      selectedModules = moduleNums[0] ? [moduleNums[0]] : [];
    }

    const totals = computeTotals(model);
    shadow.getElementById('gaugeSlot').innerHTML = gaugeSVG(totals.cpa);
    shadow.getElementById('doneCredit').textContent = totals.doneCredit;
    shadow.getElementById('doneCreditCaption').textContent = totals.doneCredit;
    
    const trackedCreditEl = shadow.getElementById('trackedCredit');
    if (trackedCreditEl) {
      trackedCreditEl.textContent = totals.requiredCredit;
    }
    
    const trackedCreditCaptionEl = shadow.getElementById('trackedCreditCaption');
    if (trackedCreditCaptionEl) {
      trackedCreditCaptionEl.textContent = totals.requiredCredit;
    }
    
    shadow.getElementById('missingCredit').textContent = totals.missingCredit;
    
    const missingCaptionEl = shadow.getElementById('missingCreditCaption');
    if (missingCaptionEl) {
      if (selectedModules && selectedModules.length > 0) {
        missingCaptionEl.textContent = `Đã gồm phần thiếu của các mô đun chuyên ngành: ${selectedModules.join(', ')}.`;
      } else {
        missingCaptionEl.textContent = 'Chưa gồm phần thiếu của mô đun chuyên ngành.';
      }
    }

    shadow.getElementById('courseCount').textContent = `${model.raw.length} môn`;
    shadow.getElementById('categoryGrid').innerHTML = Object.keys(window.CTTBK_DATA.catMeta)
      .filter(key => !(selectedThesisType === 'research' && key === 'tt'))
      .map(key => categoryCardHTML(key, model))
      .join('');

    const checkboxesContainer = shadow.getElementById('moduleCheckboxes');
    if (checkboxesContainer) {
      if (moduleNums.length === 0) {
        checkboxesContainer.innerHTML = '<div class="empty-note">Không tìm thấy mô đun nào trong bảng hiện tại.</div>';
      } else {
        checkboxesContainer.innerHTML = moduleNums.map(n => {
          const isChecked = selectedModules.includes(n);
          return `
            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: bold; cursor: pointer; color: var(--ink); margin-bottom: 4px;">
              <input type="checkbox" class="module-checkbox" value="${n}" ${isChecked ? 'checked' : ''} style="cursor: pointer; transform: scale(1.05);" />
              <span>${escapeHTML(moduleLabel(model, n))}</span>
            </label>
          `;
        }).join('');
      }
    }
    shadow.getElementById('moduleBody').innerHTML = moduleBodyHTML(model);

    const otherSection = shadow.getElementById('otherSection');
    if (model.others.length) {
      otherSection.classList.remove('is-hidden');
      shadow.getElementById('otherBody').innerHTML = `<article class="course-card">
        <div class="meta-line"><span>${model.others.length} môn không khớp từ khóa phân loại nào.</span></div>
        <details><summary>Xem danh sách môn và điểm</summary>${courseTable(model.others, true, true)}</details>
      </article>`;
    } else {
      otherSection.classList.add('is-hidden');
    }

    // Render unified missing courses
    const missingList = getMissingCoursesList(model);
    const missingCoursesCount = shadow.getElementById('missingCoursesCount');
    const missingCoursesBody = shadow.getElementById('missingCoursesBody');
    
    if (missingCoursesCount && missingCoursesBody) {
      let totalMissingMon = 0;
      missingList.forEach(item => {
        if (item.type === 'all') {
          totalMissingMon += item.courses.length;
        } else {
          totalMissingMon += item.countNeeded;
        }
      });
      
      missingCoursesCount.textContent = `${totalMissingMon} môn`;
      
      if (missingList.length === 0) {
        missingCoursesBody.innerHTML = '<div class="empty-note">Tuyệt vời! Bạn đã hoàn thành tất cả học phần để tốt nghiệp.</div>';
      } else {
        missingCoursesBody.innerHTML = missingList.map(item => {
          const headerText = item.type === 'all' 
            ? `${escapeHTML(item.categoryName)}` 
            : `${escapeHTML(item.categoryName)} (Cần chọn thêm ${item.countNeeded} môn)`;
          return `
            <div class="missing-cat-block" style="margin-top: 12px; margin-bottom: 12px;">
              <h4 style="margin: 0 0 6px 0; font-size: 14px; color: var(--red); font-weight: bold;">${headerText}</h4>
              ${courseTable(item.courses, true, false)}
            </div>
          `;
        }).join('');
      }
    }
  }

  function getMissingCoursesList(model) {
    const data = window.CTTBK_DATA;
    const missingList = [];
    
    const keyWeights = {
      'triet': 10,
      'dc': 20,
      'qp': 25,
      'en': 28,
      'cs': 30,
      'bt': 35,
      'td': 38,
      'damh': 40,
      'tt': 50,
      'module': 60,
      'da': 100
    };

    const effCategories = getEffectiveCategories(model);
    
    Object.entries(effCategories).forEach(([key, courses]) => {
      const meta = data.catMeta[key];
      if (!meta || meta.optional) return;
      
      const sum = summarize(courses);
      if (sum.done === sum.total) return;
      
      if (meta.rule === 'all') {
        if (sum.missing.length > 0) {
          missingList.push({
            key,
            categoryName: meta.name,
            type: 'all',
            courses: sum.missing
          });
        }
      } else {
        if (sum.done < meta.rule) {
          missingList.push({
            key,
            categoryName: meta.name,
            type: 'select',
            countNeeded: meta.rule - sum.done,
            courses: sum.missing
          });
        }
      }
    });
    
    if (selectedModules && selectedModules.length > 0) {
      selectedModules.forEach(mNum => {
        if (model.modules[mNum]) {
          const mod = model.modules[mNum];
          const sum = summarize(mod.courses);
          if (sum.done < sum.total && sum.missing.length > 0) {
            missingList.push({
              key: 'module',
              categoryName: `Mô đun ${mNum}: ${mod.name || ''}`,
              type: 'all',
              courses: sum.missing
            });
          }
        }
      });
    }

    missingList.sort((a, b) => {
      const wA = keyWeights[a.key] || 99;
      const wB = keyWeights[b.key] || 99;
      return wA - wB;
    });
    
    return missingList;
  }

  function marksGradeChartHTML(rows) {
    const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];
    const counts = Object.fromEntries(grades.map(grade => [grade, 0]));
    rows.forEach(row => {
      const grade = String(row.letterGrade || '').trim().toUpperCase();
      if (counts[grade] == null) counts[grade] = 0;
      counts[grade]++;
    });
    const max = Math.max(1, ...Object.values(counts));

    return `<div class="grade-distribution">${grades.map(grade => {
      const count = counts[grade] || 0;
      return `<div class="grade-bar-row">
        <span class="grade-bar-label">${escapeHTML(grade)}</span>
        <div class="grade-bar-track"><div class="grade-bar-fill grade-${grade.replace('+', 'plus').toLowerCase()}" style="--pct:${count / max * 100}%"></div></div>
        <span class="grade-bar-count">${count}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function updateSelectedMarksCalc() {
    const checkboxes = shadow.querySelectorAll('.mark-select-checkbox');
    const checkedRowsByCode = new Map();
    let selectedCount = 0;
    
    checkboxes.forEach(cb => {
      if (cb.checked) {
        const tr = cb.closest('tr');
        if (!tr) return;
        const code = tr.dataset.code;
        const credit = Number(tr.dataset.credit) || 0;
        const grade = tr.dataset.grade;
        const term = tr.dataset.term;
        const point = gradePoint(grade);
        
        if (!checkedRowsByCode.has(code)) {
          checkedRowsByCode.set(code, []);
        }
        checkedRowsByCode.get(code).push({ code, credit, grade, term, point });
        selectedCount++;
      }
    });
    
    let totalCredits = 0;
    let totalWeightedPoints = 0;
    
    checkedRowsByCode.forEach((attempts, code) => {
      const passingAttempts = attempts.filter(row => isPassingGrade(row.grade));
      let activeAttempt;
      if (passingAttempts.length > 0) {
        activeAttempt = passingAttempts.sort((a, b) => {
          if (b.point !== a.point) return b.point - a.point;
          return String(b.term).localeCompare(String(a.term));
        })[0];
      } else {
        activeAttempt = attempts.sort((a, b) => String(b.term).localeCompare(String(a.term)))[0];
      }
      
      if (activeAttempt && activeAttempt.point != null && activeAttempt.point >= 0 && activeAttempt.credit > 0) {
        totalCredits += activeAttempt.credit;
        totalWeightedPoints += activeAttempt.credit * activeAttempt.point;
      }
    });
    
    const cpa = totalCredits ? totalWeightedPoints / totalCredits : null;
    
    const calcCpaEl = shadow.getElementById('calcCpa');
    const calcCreditsEl = shadow.getElementById('calcCredits');
    const calcCountPill = shadow.getElementById('calcCountPill');
    
    if (calcCpaEl) calcCpaEl.textContent = cpa != null ? fmt(cpa) : '-';
    if (calcCreditsEl) calcCreditsEl.innerHTML = `${totalCredits} <small style="font-size: 14px;">TC</small>`;
    if (calcCountPill) calcCountPill.textContent = `Đã chọn ${selectedCount} môn`;
  }

  function getCheckedCourseCodes() {
    const checkedCodes = new Set();
    shadow.querySelectorAll('.mark-select-checkbox').forEach(cb => {
      if (cb.checked) {
        const tr = cb.closest('tr');
        if (tr && tr.dataset.code) {
          const key = tr.dataset.code + '|' + (tr.dataset.term || '');
          checkedCodes.add(key);
        }
      }
    });
    return checkedCodes;
  }
  const PREDICTED_COURSES_KEY = 'cttbk_predicted_courses';
  const IMPROVED_GRADES_KEY = 'cttbk_improved_grades';

  function getImprovedGrades() {
    try {
      const stored = window.localStorage.getItem(IMPROVED_GRADES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function setImprovedGrades(grades) {
    try {
      window.localStorage.setItem(IMPROVED_GRADES_KEY, JSON.stringify(grades));
    } catch (e) {}
  }

  function getPredictedCourses() {
    try {
      const stored = window.localStorage.getItem(PREDICTED_COURSES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function setPredictedCourses(courses) {
    try {
      window.localStorage.setItem(PREDICTED_COURSES_KEY, JSON.stringify(courses));
    } catch (e) {}
  }

  function fillMarks(rows, direction, checkedCodes = null) {
    const improvedGrades = getImprovedGrades();
    
    const mappedRows = rows.map(row => {
      if (row.isVirtual) return row;
      const key = row.code + '|' + (row.term || '');
      const improved = improvedGrades[key];
      if (improved && improved !== row.letterGrade) {
        return {
          ...row,
          originalGrade: row.originalGrade || row.letterGrade,
          letterGrade: improved,
          isImproved: true
        };
      }
      return row;
    });

    const sorted = sortMarks(mappedRows, direction);

    shadow.getElementById('marksGradeChart').innerHTML = marksGradeChartHTML(mappedRows);
    shadow.getElementById('marksSortLabel').textContent = direction === 'worst' ? 'Tệ nhất trước' : 'Tốt nhất trước';
    shadow.getElementById('marksBody').innerHTML = sorted.map(row => {
      const rowKey = row.code + '|' + (row.term || '');
      const isChecked = checkedCodes ? checkedCodes.has(rowKey) : true;
      
      let gradeCellContent = '';
      if (row.isVirtual) {
        gradeCellContent = gradeBadge(row.letterGrade);
      } else {
        const currentGrade = row.letterGrade;
        const displayBadge = gradeBadge(currentGrade);
        const originalGrade = row.originalGrade || row.letterGrade;
        gradeCellContent = `
          <div class="grade-click-area" data-code="${escapeHTML(row.code)}" data-term="${escapeHTML(row.term || '')}" data-original="${escapeHTML(originalGrade)}" data-current="${escapeHTML(currentGrade)}" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click để dự đoán điểm cải thiện">
            ${displayBadge}
            <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: var(--muted); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; pointer-events: none;">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
            </svg>
          </div>
        `;
      }

      let oldGradeContent = '-';
      if (row.isVirtual) {
        oldGradeContent = `<button class="delete-pred-btn" data-code="${escapeHTML(row.code)}" style="border: 0; background: transparent; color: var(--red); font-size: 18px; font-weight: bold; cursor: pointer; padding: 0 6px;" title="Xóa môn dự kiến">×</button>`;
      } else {
        const oldGrades = row.oldLetterGrades || [];
        if (row.isImproved) {
          const origBadge = `<span class="grade-badge" style="text-decoration: line-through; opacity: 0.5; background: #E7E0E0; color: var(--muted);">${escapeHTML(row.originalGrade)}</span>`;
          const remainingOld = oldGrades.filter(g => g !== row.originalGrade);
          oldGradeContent = `${origBadge} ${remainingOld.length ? remainingOld.map(gradeBadge).join(' ') : ''}`;
        } else if (oldGrades.length) {
          oldGradeContent = oldGrades.map(gradeBadge).join(' ');
        }
      }

      return `
        <tr data-code="${escapeHTML(row.code)}" data-term="${escapeHTML(row.term || '')}" data-credit="${row.credit}" data-grade="${escapeHTML(row.letterGrade)}" class="${row.isVirtual ? 'virtual-row' : ''} ${row.isImproved ? 'improved-row' : ''}">
          <td style="text-align: center;"><input type="checkbox" class="mark-select-checkbox" ${isChecked ? 'checked' : ''} style="cursor: pointer;" /></td>
          <td class="term-cell">${escapeHTML(row.term)}</td>
          <td class="code">${escapeHTML(row.code)}</td>
          <td>
            ${escapeHTML(row.name)}
            ${row.isVirtual ? ' <span class="badge-status todo" style="font-size: 11px; padding: 2px 6px; margin-left: 5px; font-weight: bold; background: var(--info-soft); color: var(--info); border: 1px solid #C9E0F7;">Dự kiến</span>' : ''}
            ${row.isImproved ? ' <span class="badge-status done" style="font-size: 11px; padding: 2px 6px; margin-left: 5px; font-weight: bold; background: #E2F3E7; color: var(--success); border: 1px solid #C4ECD4;">Cải thiện</span>' : ''}
          </td>
          <td class="credit">${escapeHTML(row.credit || 0)}</td>
          <td class="grade-cell">${markScoreText(row.processScore)}</td>
          <td class="grade-cell">${markScoreText(row.examScore)}</td>
          <td class="grade-cell" style="vertical-align: middle;">${gradeCellContent}</td>
          <td class="grade-cell old-grade-cell" style="vertical-align: middle;">${oldGradeContent}</td>
          <td class="grade-cell">${gradePointText(row.letterGrade)}</td>
        </tr>
      `;
    }).join('');

    const selectAllCb = shadow.getElementById('selectAllMarks');
    if (selectAllCb) {
      const allCbs = shadow.querySelectorAll('.mark-select-checkbox');
      const checkedCount = Array.from(allCbs).filter(cb => cb.checked).length;
      selectAllCb.checked = allCbs.length === checkedCount;
    }
  }

  async function renderMarksPanel(rows) {
    let currentSort = 'best';
    let isFirstRender = true;
    const displayRows = effectiveMarkRows(rows);
    let predictedCourses = getPredictedCourses();

    await renderTemplate('marksTemplate');

    const semesters = Array.from(new Set(displayRows.map(row => row.term).filter(Boolean)))
      .sort((a, b) => String(b).localeCompare(String(a)));
    const termSelect = shadow.getElementById('marksFilterTerm');
    if (termSelect) {
      termSelect.innerHTML = '<option value="all">Tất cả học kỳ</option>' +
        semesters.map(term => `<option value="${escapeHTML(term)}">Học kỳ ${escapeHTML(term)}</option>`).join('');
    }

    function applyFiltersAndFill() {
      const searchInput = shadow.getElementById('marksSearchInput');
      const filterTerm = shadow.getElementById('marksFilterTerm');
      const filterGrade = shadow.getElementById('marksFilterGrade');
      const filterStatus = shadow.getElementById('marksFilterStatus');
      
      const searchVal = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';
      const termVal = filterTerm ? filterTerm.value : 'all';
      const gradeVal = filterGrade ? filterGrade.value : 'all';
      const statusVal = filterStatus ? filterStatus.value : 'all';
      
      let checkedCodes = null;
      if (!isFirstRender) {
        checkedCodes = getCheckedCourseCodes();
      } else {
        isFirstRender = false;
      }
      const allRows = displayRows.concat(predictedCourses);
      const improvedGrades = getImprovedGrades();
      
      const filtered = allRows.filter(row => {
        // Search Filter
        if (searchVal) {
          const codeMatch = String(row.code || '').toLowerCase().includes(searchVal);
          const nameMatch = String(row.name || '').toLowerCase().includes(searchVal);
          if (!codeMatch && !nameMatch) return false;
        }

        // Term Filter
        if (termVal !== 'all') {
          if (String(row.term) !== termVal) return false;
        }
        
        // Grade Filter
        if (gradeVal !== 'all') {
          const rowKey = row.code + '|' + (row.term || '');
          const currentGrade = improvedGrades[rowKey] || row.letterGrade || '';
          if (gradeVal === 'F') {
            if (currentGrade !== 'F') return false;
          } else if (gradeVal === 'D') {
            if (currentGrade !== 'D' && currentGrade !== 'D+') return false;
          } else if (gradeVal === 'C') {
            if (currentGrade !== 'C' && currentGrade !== 'C+') return false;
          } else if (gradeVal === 'B') {
            if (currentGrade !== 'B' && currentGrade !== 'B+') return false;
          } else if (gradeVal === 'A') {
            if (currentGrade !== 'A' && currentGrade !== 'A+') return false;
          }
        }
        
        // Status Filter
        if (statusVal !== 'all') {
          const rowKey = row.code + '|' + (row.term || '');
          if (statusVal === 'real') {
            if (row.isVirtual) return false;
          } else if (statusVal === 'predicted') {
            if (!row.isVirtual) return false;
          } else if (statusVal === 'improved') {
            if (row.isVirtual) return false;
            const improved = improvedGrades[rowKey];
            const virtuallyImproved = improved && improved !== row.letterGrade;
            const officiallyImproved = row.isImproved;
            if (!virtuallyImproved && !officiallyImproved) return false;
          } else if (statusVal === 'passed') {
            const currentGrade = improvedGrades[rowKey] || row.letterGrade;
            if (!isPassingGrade(currentGrade)) return false;
          } else if (statusVal === 'failed') {
            const currentGrade = improvedGrades[rowKey] || row.letterGrade;
            if (isPassingGrade(currentGrade)) return false;
          }
        }
        
        return true;
      });
      
      fillMarks(filtered, currentSort, checkedCodes);
      updateSelectedMarksCalc();
    }

    applyFiltersAndFill();
    bindPanelShellEvents();
    
    shadow.getElementById('marksSortToggleBtn').addEventListener('click', () => {
      currentSort = currentSort === 'best' ? 'worst' : 'best';
      applyFiltersAndFill();
    });

    const selectAllCb = shadow.getElementById('selectAllMarks');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', e => {
        const checked = e.target.checked;
        shadow.querySelectorAll('#marksBody .mark-select-checkbox').forEach(cb => {
          cb.checked = checked;
        });
        updateSelectedMarksCalc();
      });
    }

    const marksBody = shadow.getElementById('marksBody');
    if (marksBody) {
      marksBody.addEventListener('change', e => {
        if (e.target.classList.contains('mark-select-checkbox')) {
          updateSelectedMarksCalc();
          const selectAllCb = shadow.getElementById('selectAllMarks');
          if (selectAllCb) {
            const allCbs = shadow.querySelectorAll('#marksBody .mark-select-checkbox');
            const checkedCbs = shadow.querySelectorAll('#marksBody .mark-select-checkbox:checked');
            selectAllCb.checked = allCbs.length === checkedCbs.length;
          }
        }
      });

      marksBody.addEventListener('click', e => {
        const deleteBtn = e.target.closest('.delete-pred-btn');
        if (deleteBtn) {
          const codeToDelete = deleteBtn.dataset.code;
          predictedCourses = predictedCourses.filter(c => c.code !== codeToDelete);
          setPredictedCourses(predictedCourses);
          
          const checkedCodes = getCheckedCourseCodes();
          checkedCodes.delete(codeToDelete);
          
          applyFiltersAndFill();
          return;
        }

        const clickArea = e.target.closest('.grade-click-area');
        if (clickArea) {
          const code = clickArea.dataset.code;
          const term = clickArea.dataset.term;
          const original = clickArea.dataset.original;
          const current = clickArea.dataset.current;
          
          const selectHtml = `
            <select class="improve-select" data-code="${escapeHTML(code)}" data-term="${escapeHTML(term)}" data-original="${escapeHTML(original)}" style="padding: 2px; font-size: 13px; font-weight: bold; border-radius: 4px; border: 1px solid var(--info); cursor: pointer; background: white; color: var(--ink);">
              <option value="${escapeHTML(original)}">Gốc (${original})</option>
              <option value="A+" ${current === 'A+' ? 'selected' : ''}>A+</option>
              <option value="A" ${current === 'A' ? 'selected' : ''}>A</option>
              <option value="B+" ${current === 'B+' ? 'selected' : ''}>B+</option>
              <option value="B" ${current === 'B' ? 'selected' : ''}>B</option>
              <option value="C+" ${current === 'C+' ? 'selected' : ''}>C+</option>
              <option value="C" ${current === 'C' ? 'selected' : ''}>C</option>
              <option value="D+" ${current === 'D+' ? 'selected' : ''}>D+</option>
              <option value="D" ${current === 'D' ? 'selected' : ''}>D</option>
              <option value="F" ${current === 'F' ? 'selected' : ''}>F</option>
            </select>
          `;
          
          const parent = clickArea.parentNode;
          parent.innerHTML = selectHtml;
          
          const selectEl = parent.querySelector('.improve-select');
          if (selectEl) {
            selectEl.focus();
            
            selectEl.addEventListener('change', event => {
              const val = event.target.value;
              const orig = event.target.dataset.original;
              const c = event.target.dataset.code;
              const t = event.target.dataset.term;
              const key = c + '|' + (t || '');
              
              const grades = getImprovedGrades();
              if (val === orig) {
                delete grades[key];
              } else {
                grades[key] = val;
              }
              setImprovedGrades(grades);
              applyFiltersAndFill();
            });
            
            selectEl.addEventListener('blur', event => {
              setTimeout(() => {
                applyFiltersAndFill();
              }, 150);
            });
          }
        }
      });
    }

    const addPredBtn = shadow.getElementById('addPredBtn');
    if (addPredBtn) {
      addPredBtn.addEventListener('click', () => {
        const codeInput = shadow.getElementById('predCode');
        const nameInput = shadow.getElementById('predName');
        const creditInput = shadow.getElementById('predCredit');
        const gradeSelect = shadow.getElementById('predGrade');
        
        const code = (codeInput.value || '').trim().toUpperCase();
        const credit = parseInt(creditInput.value) || 3;
        const letterGrade = gradeSelect.value || 'A';
        
        if (!code) {
          alert('Vui lòng nhập Mã học phần!');
          return;
        }
        
        const codeExists = displayRows.concat(predictedCourses).some(c => c.code === code);
        if (codeExists) {
          alert(`Mã học phần ${code} đã tồn tại!`);
          return;
        }

        const name = (nameInput.value || '').trim() || `Học phần dự kiến ${code}`;
        
        const newCourse = {
          code,
          name,
          credit,
          letterGrade,
          term: 'Dự kiến',
          isVirtual: true,
          processScore: null,
          examScore: null
        };
        
        predictedCourses.push(newCourse);
        setPredictedCourses(predictedCourses);
        
        codeInput.value = '';
        nameInput.value = '';
        creditInput.value = '3';
        
        const checkedCodes = getCheckedCourseCodes();
        checkedCodes.add(code);
        
        applyFiltersAndFill();
      });
    }

    const searchInput = shadow.getElementById('marksSearchInput');
    const filterTerm = shadow.getElementById('marksFilterTerm');
    const filterGrade = shadow.getElementById('marksFilterGrade');
    const filterStatus = shadow.getElementById('marksFilterStatus');
    const clearFiltersBtn = shadow.getElementById('clearFiltersBtn');
    
    if (searchInput) {
      searchInput.addEventListener('input', applyFiltersAndFill);
    }
    if (filterTerm) {
      filterTerm.addEventListener('change', applyFiltersAndFill);
    }
    if (filterGrade) {
      filterGrade.addEventListener('change', applyFiltersAndFill);
    }
    if (filterStatus) {
      filterStatus.addEventListener('change', applyFiltersAndFill);
    }
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (filterTerm) filterTerm.value = 'all';
        if (filterGrade) filterGrade.value = 'all';
        if (filterStatus) filterStatus.value = 'all';
        applyFiltersAndFill();
      });
    }
  }

  function fillGeneral(rows) {
    const latest = latestTermRows(rows)[0];
    setText('generalCount', `${rows.length} học kỳ`);
    setText('latestTerm', latest ? latest.term : '-');
    setText('latestCpa', latest ? valueText(latest.cpa) : '-');
    setText('latestAccumulatedCredits', latest ? valueText(latest.accumulatedCredits) : '-');
    setText('latestWarning', latest && latest.warning ? latest.warning : '-');
    const warningMetric = shadow.getElementById('latestWarningMetric');
    if (warningMetric) {
      warningMetric.className = `metric ${latest ? warningClass(latest.warning) : 'warning-unknown'}`;
    }
    shadow.getElementById('gpaCpaChart').innerHTML = lineChartSVG(rows);
    shadow.getElementById('termCreditChart').innerHTML = termCreditChartSVG(rows);
    shadow.getElementById('cumulativeCreditChart').innerHTML = cumulativeCreditChartSVG(rows);
    shadow.getElementById('statusTimeline').innerHTML = statusTimelineSVG(rows);
    shadow.getElementById('generalBody').innerHTML = latestTermRows(rows).map(row => `
      <tr>
        <td class="grade-cell">${escapeHTML(row.term)}</td>
        <td class="grade-cell">${valueText(row.gpa)}</td>
        <td class="grade-cell">${valueText(row.cpa)}</td>
        <td class="credit">${valueText(row.passedCredits)}</td>
        <td class="credit wide-credit">${valueText(row.accumulatedCredits)}</td>
        <td class="credit wide-credit">${valueText(row.debtCredits)}</td>
        <td class="credit">${valueText(row.registeredCredits)}</td>
        <td>${escapeHTML(row.level || '-')}</td>
        <td class="center-cell"><span class="warning-chip ${warningClass(row.warning)}">${escapeHTML(row.warning || '-')}</span></td>
      </tr>
    `).join('');
  }

  async function renderGeneralPanel(rows) {
    await renderTemplate('generalTemplate');
    fillGeneral(rows);
    bindPanelShellEvents();
    bindChartTooltips();
  }

  async function renderTemplate(templateId) {
    const { css, html } = await loadAssets();
    shadow.innerHTML = `<style>${css}</style>${html}`;
    const template = shadow.getElementById(templateId);
    shadow.innerHTML = `<style>${css}</style>`;
    shadow.appendChild(template.content.cloneNode(true));
  }

  function bindPanelShellEvents() {
    const closeBtn = shadow.getElementById('closeBtn');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    const backdrop = shadow.getElementById('backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', e => {
        if (e.target.id === 'backdrop') closePanel();
      });
    }
  }

  function bindChartTooltips() {
    let tooltip = shadow.getElementById('chartTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltip';
      tooltip.className = 'chart-tooltip';
      (shadow.getElementById('backdrop') || shadow).appendChild(tooltip);
    }

    function moveTooltip(e) {
      const backdrop = shadow.getElementById('backdrop');
      const rect = backdrop ? backdrop.getBoundingClientRect() : { left: 0, top: 0 };
      const scrollLeft = backdrop ? backdrop.scrollLeft : 0;
      const scrollTop = backdrop ? backdrop.scrollTop : 0;
      tooltip.style.left = `${e.clientX - rect.left + scrollLeft + 12}px`;
      tooltip.style.top = `${e.clientY - rect.top + scrollTop + 12}px`;
    }

    if (chartTooltipBound) return;
    chartTooltipBound = true;

    shadow.addEventListener('pointerover', e => {
      const target = e.target.closest && e.target.closest('[data-tooltip]');
      if (!target) return;
      tooltip.textContent = target.dataset.tooltip || '';
      if (tooltip.textContent) {
        moveTooltip(e);
        tooltip.classList.add('is-visible');
      }
    });

    shadow.addEventListener('pointermove', e => {
      if (!tooltip.classList.contains('is-visible')) return;
      if (!(e.target.closest && e.target.closest('[data-tooltip]'))) return;
      moveTooltip(e);
    });

    shadow.addEventListener('pointerout', e => {
      const target = e.target.closest && e.target.closest('[data-tooltip]');
      if (!target) return;
      const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tooltip]');
      if (next === target) return;
      tooltip.classList.remove('is-visible');
    });
  }

  async function renderLoadingPanel() {
    await renderTemplate('loadingTemplate');
    bindPanelShellEvents();
  }

  async function renderPanel(model) {
    let currentModel = model;
    await renderTemplate('dashboardTemplate');

    fillDashboard(currentModel);

    bindPanelShellEvents();
    bindCopyHandler();
    shadow.getElementById('rescanBtn').addEventListener('click', () => {
      currentModel = window.CTTBK_DATA.buildModel();
      fillDashboard(currentModel);
    });

    const checkboxesContainer = shadow.getElementById('moduleCheckboxes');
    if (checkboxesContainer) {
      checkboxesContainer.addEventListener('change', e => {
        if (e.target.classList.contains('module-checkbox')) {
          const checkedCheckboxes = checkboxesContainer.querySelectorAll('.module-checkbox:checked');
          selectedModules = Array.from(checkedCheckboxes).map(cb => Number(cb.value));
          setLastModule(selectedModules);
          fillDashboard(currentModel);
        }
      });
    }

    const categoryGrid = shadow.getElementById('categoryGrid');
    if (categoryGrid) {
      categoryGrid.addEventListener('change', e => {
        if (e.target.id === 'thesisTypeSelect') {
          selectedThesisType = e.target.value;
          setThesisType(selectedThesisType);
          fillDashboard(currentModel);
        }
      });
    }
  }

  function ensureHost() {
    if (hostEl) return;
    hostEl = document.createElement('div');
    hostEl.id = 'cttbk-ext-host';
    document.documentElement.appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: 'open' });
  }

  function bindCopyHandler() {
    if (copyHandlerBound) return;
    copyHandlerBound = true;
    shadow.addEventListener('click', e => {
      const btn = e.target.closest('.copy-code-btn');
      if (!btn) return;
      const code = btn.dataset.code;
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        window.setTimeout(() => { btn.classList.remove('copied'); }, 1200);
      }).catch(() => {
        btn.classList.add('failed');
        window.setTimeout(() => { btn.classList.remove('failed'); }, 1200);
      });
    });
  }

  function closePanel() {
    if (shadow) shadow.innerHTML = '';
    panelOpen = false;
    currentPanelMode = null;
    chartTooltipBound = false;
  }

  function waitForGrid(timeoutMs) {
    const started = Date.now();
    return new Promise(resolve => {
      const poll = window.setInterval(() => {
        if (window.CTTBK_DATA.gridPresent()) {
          window.clearInterval(poll);
          resolve(true);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          window.clearInterval(poll);
          resolve(false);
        }
      }, 350);
    });
  }

  async function ensureProgramGrid() {
    if (window.CTTBK_DATA.gridPresent()) return true;
    if (!window.CTTBK_DATA.showProgramButtonPresent()) return false;
    sessionStorage.setItem('cttbk_auto_open', '1');
    window.CTTBK_DATA.clickShowProgramButton();
    const ready = await waitForGrid(10000);
    if (ready) sessionStorage.removeItem('cttbk_auto_open');
    return ready;
  }

  function openTarget(target) {
    if (target === 'general' && window.CTTBK_DATA.generalResultsPresent()) {
      openPanel('general');
      return;
    }
    if (target === 'marks' && window.CTTBK_DATA.marksPresent()) {
      openPanel('marks');
      return;
    }
    if (target === 'courses' && (window.CTTBK_DATA.gridPresent() || window.CTTBK_DATA.showProgramButtonPresent())) {
      openPanel('courses');
      return;
    }

    const path = {
      courses: PROGRAM_PATH,
      marks: MARKS_PATH,
      general: GENERAL_PATH,
    }[target] || PROGRAM_PATH;
    if (location.pathname !== path) {
      sessionStorage.setItem('cttbk_open_target', target);
      location.href = `${location.origin}${path}`;
      return;
    }
    openPanel(target);
  }

  async function openPanel(target) {
    ensureHost();
    panelOpen = true;
    const mode = target || (window.CTTBK_DATA.generalResultsPresent() ? 'general' : (window.CTTBK_DATA.marksPresent() ? 'marks' : 'courses'));
    currentPanelMode = mode;
    if (mode === 'marks') {
      await renderMarksPanel(window.CTTBK_DATA.scrapeMarks());
      return;
    }
    if (mode === 'general') {
      await renderGeneralPanel(applyRecalculatedGeneralRows(
        window.CTTBK_DATA.scrapeGeneralResults(),
        window.CTTBK_DATA.scrapeMarks()
      ));
      return;
    }
    await renderLoadingPanel();
    const ready = await ensureProgramGrid();
    if (!panelOpen) return;
    selectedModules = await getLastModule();
    selectedThesisType = await getThesisType();
    await renderPanel(ready ? window.CTTBK_DATA.buildModel() : {
      raw: [],
      categories: Object.fromEntries(Object.keys(window.CTTBK_DATA.catMeta).map(key => [key, []])),
      modules: {},
      others: [],
    });
  }

  async function addFab() {
    if (document.getElementById('cttbk-fab-host')) return;
    const { css, html } = await loadAssets();
    const fabHost = document.createElement('div');
    fabHost.id = 'cttbk-fab-host';
    document.documentElement.appendChild(fabHost);
    const fabShadow = fabHost.attachShadow({ mode: 'open' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    fabShadow.innerHTML = `<style>${css}</style>`;
    fabShadow.appendChild(doc.getElementById('fabStack'));
    fabShadow.getElementById('courseFabBtn').addEventListener('click', () => {
      if (panelOpen && currentPanelMode === 'courses') closePanel();
      else openTarget('courses');
    });
    fabShadow.getElementById('marksFabBtn').addEventListener('click', () => {
      if (panelOpen && currentPanelMode === 'marks') closePanel();
      else openTarget('marks');
    });
    fabShadow.getElementById('generalFabBtn').addEventListener('click', () => {
      if (panelOpen && currentPanelMode === 'general') closePanel();
      else openTarget('general');
    });
  }

  window.CTTBK_UI = { addFab, openPanel, openTarget };
})();
