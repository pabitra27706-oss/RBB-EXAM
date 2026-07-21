/* ═══════════════════════════════════════════════════════════════
   ANALYTICS.JS — Stats calculations and chart rendering
   Reads from Storage, uses Scoring for formatting.
   Renders SVG charts and DOM updates for the Analytics page.
═══════════════════════════════════════════════════════════════ */

const Analytics = (() => {

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */

  let _shiftsIndex = [];
  let _taxonomy    = { subjects: [] };

  /* ─────────────────────────────────────────────────────────────
     INITIALISE
  ───────────────────────────────────────────────────────────── */

  async function init() {
    _shiftsIndex = await Storage.loadShiftsIndex();
    _taxonomy    = await Storage.loadTaxonomy();
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 1: OVERALL NUMBERS
  ───────────────────────────────────────────────────────────── */

  function renderOverallNumbers() {
    const stats = Storage.getOverallStats();

    _setText('an-total-attempted',  stats.totalQuestionsAttempted.toLocaleString());
    _setText('an-overall-accuracy', Scoring.formatAccuracy(stats.overallAccuracy));
    _setText('an-total-time',       Scoring.formatTotalTime(stats.totalTimeSpent));
    _setText('an-streak',           stats.currentStreak);
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 2: SCORE TREND (SVG LINE CHART)
  ───────────────────────────────────────────────────────────── */

  function renderScoreTrend() {
    const svg   = document.getElementById('score-trend-svg');
    const empty = document.getElementById('score-trend-empty');
    if (!svg) return;

    const allAttempts = Storage.getAllAttempts(_shiftsIndex);

    if (allAttempts.length < 2) {
      svg.style.display   = 'none';
      empty.style.display = 'block';
      return;
    }

    svg.style.display   = 'block';
    empty.style.display = 'none';

    // Build data points: x = index, y = score %
    const points = allAttempts.map((item, i) => {
      const scorePct = item.attempt.totalQuestions > 0
        ? (item.attempt.finalScore / item.attempt.totalQuestions) * 100
        : 0;
      return { x: i, y: Math.max(0, scorePct) };
    });

    const W         = 400;
    const H         = 140;
    const padL      = 30;
    const padR      = 10;
    const padT      = 10;
    const padB      = 20;
    const chartW    = W - padL - padR;
    const chartH    = H - padT - padB;
    const n         = points.length;

    // Scale functions
    const xScale = i  => padL + (i / Math.max(n - 1, 1)) * chartW;
    const yScale = y  => padT + chartH - (y / 100) * chartH;

    // Build SVG content
    let html = '';

    // Grid lines at 25, 50, 75, 100
    [25, 50, 75, 100].forEach(pct => {
      const y = yScale(pct);
      html += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
        stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>`;
      html += `<text x="${padL - 4}" y="${y + 4}" text-anchor="end"
        font-size="9" fill="var(--text-muted)">${pct}</text>`;
    });

    // Area fill (gradient under line)
    const areaPoints = points
      .map((p, i) => `${xScale(i)},${yScale(p.y)}`)
      .join(' ');
    const firstX     = xScale(0);
    const lastX      = xScale(n - 1);
    const baseY      = yScale(0);

    html += `
      <defs>
        <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="var(--accent-blue)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--accent-blue)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon
        points="${firstX},${baseY} ${areaPoints} ${lastX},${baseY}"
        fill="url(#trend-gradient)"/>
    `;

    // Line path
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.y)}`)
      .join(' ');

    html += `<path d="${linePath}" fill="none"
      stroke="var(--accent-blue)" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>`;

    // Data points (dots)
    points.forEach((p, i) => {
      const cx    = xScale(i);
      const cy    = yScale(p.y);
      const label = `${p.y.toFixed(0)}%`;

      html += `
        <circle cx="${cx}" cy="${cy}" r="4"
          fill="var(--accent-blue)" stroke="var(--bg-secondary)" stroke-width="2"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle"
          font-size="9" fill="var(--text-muted)">${label}</text>
      `;
    });

    // X-axis labels (show every nth to avoid crowding)
    const step = Math.max(1, Math.floor(n / 6));
    points.forEach((p, i) => {
      if (i % step === 0 || i === n - 1) {
        const attempt = allAttempts[i];
        const dateStr = attempt.attempt.attemptDate
          ? attempt.attempt.attemptDate.split('T')[0].slice(5) // MM-DD
          : '';
        html += `<text x="${xScale(i)}" y="${H - 2}" text-anchor="middle"
          font-size="8" fill="var(--text-muted)">${dateStr}</text>`;
      }
    });

    svg.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 3: SUBJECT ACCURACY (BAR CHART)
  ───────────────────────────────────────────────────────────── */

  function renderSubjectAccuracy() {
    const allAttempts = Storage.getAllAttempts(_shiftsIndex);

    // Aggregate subject-wise totals across all attempts
    const totals = {
      'General Awareness':                    { correct: 0, attempted: 0 },
      'Mathematics':                          { correct: 0, attempted: 0 },
      'General Intelligence and Reasoning':   { correct: 0, attempted: 0 },
    };

    allAttempts.forEach(({ attempt }) => {
      if (!attempt.subjectWise) return;
      Object.entries(attempt.subjectWise).forEach(([subject, data]) => {
        if (totals[subject]) {
          totals[subject].correct  += data.correct || 0;
          totals[subject].attempted += (data.correct || 0) + (data.wrong || 0);
        }
      });
    });

    // GA
    const gaAcc = _safeAccuracy(totals['General Awareness']);
    _setStyle('bar-ga',  'width', `${gaAcc}%`);
    _setText('bar-ga-val', `${gaAcc.toFixed(0)}%`);

    // Math
    const mathAcc = _safeAccuracy(totals['Mathematics']);
    _setStyle('bar-math', 'width', `${mathAcc}%`);
    _setText('bar-math-val', `${mathAcc.toFixed(0)}%`);

    // Reasoning
    const rsnAcc = _safeAccuracy(
      totals['General Intelligence and Reasoning']
    );
    _setStyle('bar-reasoning', 'width', `${rsnAcc}%`);
    _setText('bar-reasoning-val', `${rsnAcc.toFixed(0)}%`);
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 4: WEAK AREAS
  ───────────────────────────────────────────────────────────── */

  function renderWeakAreas() {
    const container = document.getElementById('weak-area-list');
    const emptyMsg  = document.getElementById('weak-area-empty');
    if (!container) return;

    const subTopicData = Storage.getSubTopicAccuracy(_shiftsIndex);

    // Filter: attempted >= 3 and accuracy < 60
    const weak = subTopicData
      .filter(st => st.attempted >= 3 && st.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy);

    // Remove only dynamic items (keep empty message)
    Array.from(container.querySelectorAll('.weak-area-item')).forEach(el => el.remove());

    if (weak.length === 0) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    weak.forEach(st => {
      const item = document.createElement('div');
      item.className = 'weak-area-item';
      item.innerHTML = `
        <div class="weak-area-name" title="${_esc(st.subTopic)}">${_esc(st.subTopic)}</div>
        <div class="weak-area-bar-track">
          <div class="weak-area-bar-fill" style="width:${st.accuracy}%"></div>
        </div>
        <div class="weak-area-accuracy">${st.accuracy.toFixed(0)}%</div>
        <div class="badge badge-muted text-xs">${st.attempted} seen</div>
      `;
      container.appendChild(item);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 5: SUBTOPIC COVERAGE MAP
  ───────────────────────────────────────────────────────────── */

  function renderCoverageMap() {
    const container = document.getElementById('coverage-grid');
    if (!container) return;

    container.innerHTML = '';

    const subTopicData  = Storage.getSubTopicAccuracy(_shiftsIndex);
    const subTopicMap   = {};
    subTopicData.forEach(st => {
      subTopicMap[st.subTopic] = st;
    });

    // Iterate all subtopics from taxonomy
    _taxonomy.subjects.forEach(subject => {
      subject.topics.forEach(topic => {
        topic.subTopics.forEach(subTopic => {
          const data    = subTopicMap[subTopic];
          const pct     = data ? Math.min(data.accuracy, 100) : 0;
          const touched = data && data.attempted > 0;

          const cell          = document.createElement('div');
          cell.className      = 'coverage-cell';
          cell.title          = `${subTopic}: ${touched ? `${data.attempted} attempted, ${pct.toFixed(0)}%` : 'Not started'}`;

          const fill          = document.createElement('div');
          fill.className      = 'coverage-cell-fill';
          fill.style.height   = touched ? `${pct}%` : '0%';

          const name          = document.createElement('div');
          name.className      = 'coverage-cell-name';
          name.textContent    = subTopic;

          const pctEl         = document.createElement('div');
          pctEl.className     = 'coverage-cell-pct';
          pctEl.textContent   = touched ? `${pct.toFixed(0)}%` : '--';

          cell.appendChild(fill);
          cell.appendChild(name);
          cell.appendChild(pctEl);
          container.appendChild(cell);
        });
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 6: DIFFICULTY DISTRIBUTION
  ───────────────────────────────────────────────────────────── */

  function renderDifficultyAccuracy() {
    const allAttempts = Storage.getAllAttempts(_shiftsIndex);

    const totals = {
      Easy:   { correct: 0, attempted: 0 },
      Medium: { correct: 0, attempted: 0 },
      Hard:   { correct: 0, attempted: 0 },
    };

    allAttempts.forEach(({ attempt }) => {
      if (!attempt.difficultyWise) return;
      Object.entries(attempt.difficultyWise).forEach(([diff, data]) => {
        if (totals[diff]) {
          totals[diff].correct  += data.correct || 0;
          totals[diff].attempted += (data.correct || 0) + (data.wrong || 0);
        }
      });
    });

    const easyAcc   = _safeAccuracy(totals.Easy);
    const medAcc    = _safeAccuracy(totals.Medium);
    const hardAcc   = _safeAccuracy(totals.Hard);

    _setStyle('bar-easy',   'width', `${easyAcc}%`);
    _setText('bar-easy-val',  `${easyAcc.toFixed(0)}%`);

    _setStyle('bar-medium', 'width', `${medAcc}%`);
    _setText('bar-medium-val',`${medAcc.toFixed(0)}%`);

    _setStyle('bar-hard',   'width', `${hardAcc}%`);
    _setText('bar-hard-val',  `${hardAcc.toFixed(0)}%`);
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 7: STREAK CALENDAR
  ───────────────────────────────────────────────────────────── */

  function renderStreakCalendar() {
    const container = document.getElementById('streak-calendar');
    if (!container) return;

    container.innerHTML = '';

    const stats        = Storage.getOverallStats();
    const practiceDates = new Set(Storage.getPracticeDates(_shiftsIndex));

    // Update streak display
    _setText('an-current-streak', `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`);
    _setText('an-longest-streak', `${stats.longestStreak} day${stats.longestStreak !== 1 ? 's' : ''}`);

    // Build 63-day calendar (9 weeks) ending today
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Go back 62 days from today
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 62);

    // Build per-date attempt counts for intensity
    const dateCount = {};
    Storage.getAllAttempts(_shiftsIndex).forEach(({ attempt }) => {
      if (attempt.attemptDate) {
        const d = attempt.attemptDate.split('T')[0];
        dateCount[d] = (dateCount[d] || 0) + 1;
      }
    });

    for (let i = 0; i < 63; i++) {
      const date    = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const count   = dateCount[dateStr] || 0;

      const cell         = document.createElement('div');
      cell.className     = 'streak-day';
      cell.title         = `${dateStr}: ${count > 0 ? `${count} attempt${count !== 1 ? 's' : ''}` : 'No practice'}`;

      if (dateStr === todayStr) {
        cell.classList.add('today');
      }

      if (count >= 3) {
        cell.classList.add('practiced-high');
      } else if (count === 2) {
        cell.classList.add('practiced-medium');
      } else if (count === 1) {
        cell.classList.add('practiced-low');
      }

      container.appendChild(cell);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     RESULT PAGE: DIFFICULTY CHART
  ───────────────────────────────────────────────────────────── */

  /**
   * Render difficulty bar chart on the result page.
   * @param {Object} difficultyWise  { Easy: {correct,wrong,skipped,total,accuracy}, ... }
   */
  function renderResultDifficultyChart(difficultyWise) {
    const container = document.getElementById('result-difficulty-card');
    if (!container) return;

    const chart = container.querySelector('#result-difficulty-chart');
    if (!chart) return;

    chart.innerHTML = '';

    const levels = [
      { key: 'Easy',   color: 'var(--diff-easy)'   },
      { key: 'Medium', color: 'var(--diff-medium)'  },
      { key: 'Hard',   color: 'var(--diff-hard)'    },
    ];

    levels.forEach(({ key, color }) => {
      const data     = difficultyWise[key] || { correct: 0, wrong: 0, skipped: 0, total: 0, accuracy: 0 };
      const accuracy = data.accuracy || 0;

      const row = document.createElement('div');
      row.className = 'bar-chart-row';
      row.innerHTML = `
        <div class="bar-chart-label">${key}</div>
        <div class="bar-chart-track">
          <div class="bar-chart-fill generic"
               style="width:${accuracy}%;background:${color}"></div>
        </div>
        <div class="bar-chart-value">${data.correct}/${data.total}</div>
      `;
      chart.appendChild(row);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     FULL ANALYTICS PAGE RENDER
  ───────────────────────────────────────────────────────────── */

  async function renderAll() {
    // Ensure index and taxonomy are loaded
    if (_shiftsIndex.length === 0) {
      _shiftsIndex = await Storage.loadShiftsIndex();
    }
    if (_taxonomy.subjects.length === 0) {
      _taxonomy = await Storage.loadTaxonomy();
    }

    renderOverallNumbers();
    renderScoreTrend();
    renderSubjectAccuracy();
    renderWeakAreas();
    renderCoverageMap();
    renderDifficultyAccuracy();
    renderStreakCalendar();
  }

  /* ─────────────────────────────────────────────────────────────
     COMPUTED ANALYTICS DATA (for components and other modules)
  ───────────────────────────────────────────────────────────── */

  /**
   * Get subject accuracy data as plain object.
   * @returns {{ ga: number, math: number, reasoning: number }}
   */
  function getSubjectAccuracyData() {
    const allAttempts = Storage.getAllAttempts(_shiftsIndex);

    const totals = {
      'General Awareness':                    { correct: 0, attempted: 0 },
      'Mathematics':                          { correct: 0, attempted: 0 },
      'General Intelligence and Reasoning':   { correct: 0, attempted: 0 },
    };

    allAttempts.forEach(({ attempt }) => {
      if (!attempt.subjectWise) return;
      Object.entries(attempt.subjectWise).forEach(([subject, data]) => {
        if (totals[subject]) {
          totals[subject].correct  += data.correct  || 0;
          totals[subject].attempted += (data.correct || 0) + (data.wrong || 0);
        }
      });
    });

    return {
      ga:        _safeAccuracy(totals['General Awareness']),
      math:      _safeAccuracy(totals['Mathematics']),
      reasoning: _safeAccuracy(totals['General Intelligence and Reasoning']),
    };
  }

  /**
   * Get score trend data points for external use.
   * @returns {Array<{ date: string, score: number, accuracy: number }>}
   */
  function getScoreTrendData() {
    return Storage.getAllAttempts(_shiftsIndex).map(({ attempt, shiftMeta }) => ({
      date:     attempt.attemptDate ? attempt.attemptDate.split('T')[0] : '',
      shiftId:  shiftMeta.id,
      score:    attempt.finalScore,
      accuracy: attempt.accuracy,
      total:    attempt.totalQuestions,
    }));
  }

  /**
   * Get summary stats for the home dashboard.
   * @returns {Object}
   */
  function getDashboardStats() {
    const stats        = Storage.getOverallStats();
    const allAttempts  = Storage.getAllAttempts(_shiftsIndex);
    const completedIds = new Set();

    allAttempts.forEach(({ shiftId }) => completedIds.add(shiftId));

    // Last 3 attempts
    const recent = allAttempts
      .slice(-3)
      .reverse()
      .map(({ shiftMeta, attempt }) => ({
        shiftId:   shiftMeta.id,
        shiftDate: shiftMeta.date,
        shift:     shiftMeta.shift,
        score:     attempt.finalScore,
        accuracy:  attempt.accuracy,
        mode:      attempt.mode,
        date:      attempt.attemptDate,
      }));

    return {
      shiftsCompleted:         completedIds.size,
      totalShifts:             54,
      overallAccuracy:         stats.overallAccuracy,
      currentStreak:           stats.currentStreak,
      longestStreak:           stats.longestStreak,
      totalQuestionsAttempted: stats.totalQuestionsAttempted,
      totalTimeSpent:          stats.totalTimeSpent,
      recentAttempts:          recent,
    };
  }

  /* ─────────────────────────────────────────────────────────────
     PRIVATE HELPERS
  ───────────────────────────────────────────────────────────── */

  function _safeAccuracy({ correct, attempted }) {
    if (!attempted || attempted === 0) return 0;
    return parseFloat(((correct / attempted) * 100).toFixed(1));
  }

  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function _setStyle(id, prop, value) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = value;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    init,
    renderAll,
    renderOverallNumbers,
    renderScoreTrend,
    renderSubjectAccuracy,
    renderWeakAreas,
    renderCoverageMap,
    renderDifficultyAccuracy,
    renderStreakCalendar,
    renderResultDifficultyChart,
    getSubjectAccuracyData,
    getScoreTrendData,
    getDashboardStats,
  };

})();