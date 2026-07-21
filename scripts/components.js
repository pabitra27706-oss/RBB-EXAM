/* ═══════════════════════════════════════════════════════════════
   COMPONENTS.JS — All UI component builder functions
   Pure functions that return HTML strings or DOM elements.
   No direct page routing. No storage writes.
═══════════════════════════════════════════════════════════════ */

const Components = (() => {

  /* ─────────────────────────────────────────────────────────────
     UTILITY HELPERS
  ───────────────────────────────────────────────────────────── */

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _icon(name, sizeClass = '') {
    return `<svg class="icon ${sizeClass}" aria-hidden="true">
              <use href="#icon-${name}"/>
            </svg>`;
  }

  function _el(tag, attrs = {}, innerHTML = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v);
    });
    el.innerHTML = innerHTML;
    return el;
  }

  /* ─────────────────────────────────────────────────────────────
     ICON COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Render an SVG icon element.
   * @param {string} name       Icon ID (without "icon-" prefix)
   * @param {string} sizeClass  'icon-xs'|'icon-sm'|'icon-md'|'icon-lg'|'icon-xl'
   * @param {string} extraClass Additional CSS classes
   * @returns {string} HTML string
   */
  function Icon(name, sizeClass = 'icon-md', extraClass = '') {
    return `<svg class="icon ${sizeClass} ${extraClass}" aria-hidden="true">
              <use href="#icon-${name}"/>
            </svg>`;
  }

  /* ─────────────────────────────────────────────────────────────
     BADGE COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Render a badge pill.
   * @param {string} text
   * @param {string} variant  CSS class suffix e.g. 'blue','green','ga','easy'
   * @param {string} iconName Optional icon name
   * @returns {string} HTML string
   */
  function Badge(text, variant = 'muted', iconName = '') {
    const icon = iconName ? _icon(iconName, 'icon-xs') : '';
    return `<span class="badge badge-${variant}">${icon}${_esc(text)}</span>`;
  }

  /**
   * Get badge variant for a subject name.
   */
  function subjectBadgeVariant(subject) {
    if (subject === 'General Awareness')                  return 'ga';
    if (subject === 'Mathematics')                        return 'math';
    if (subject === 'General Intelligence and Reasoning') return 'reasoning';
    return 'muted';
  }

  /**
   * Get badge variant for difficulty.
   */
  function difficultyBadgeVariant(difficulty) {
    if (difficulty === 'Easy')   return 'easy';
    if (difficulty === 'Medium') return 'medium';
    if (difficulty === 'Hard')   return 'hard';
    return 'muted';
  }

  /**
   * Get badge variant for shift status.
   */
  function statusBadgeVariant(status) {
    if (status === 'completed')   return 'completed';
    if (status === 'in-progress') return 'in-progress';
    return 'not-started';
  }

  /**
   * Get display text for shift status.
   */
  function statusLabel(status) {
    if (status === 'completed')   return 'Completed';
    if (status === 'in-progress') return 'In Progress';
    return 'Not Started';
  }

  /* ─────────────────────────────────────────────────────────────
     SHIFT CARD COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Build a shift card element.
   * @param {Object} shiftMeta   From shifts-index.json
   * @param {string} status      'not-started'|'in-progress'|'completed'
   * @param {Object|null} bestAttempt  Best attempt object or null
   * @param {number} attemptCount
   * @returns {HTMLElement}
   */
  function ShiftCard(shiftMeta, status, bestAttempt, attemptCount) {
    const card       = document.createElement('button');
    card.className   = `shift-card status-${status}`;
    card.dataset.shiftId = shiftMeta.id;

    const dateStr    = Scoring.formatDate(shiftMeta.date);
    const variant    = statusBadgeVariant(status);
    const label      = statusLabel(status);

    let statsHtml = '';
    if (bestAttempt) {
      const scoreColor = Scoring.getScoreColor(
        bestAttempt.finalScore,
        bestAttempt.totalQuestions
      );
      statsHtml = `
        <div class="shift-card-stats">
          <div class="shift-stat">
            <span class="shift-stat-value" style="color:${scoreColor}">
              ${Scoring.formatScore(bestAttempt.finalScore)}
            </span>
            <span class="shift-stat-label">Best Score</span>
          </div>
          <div class="shift-stat">
            <span class="shift-stat-value">${Scoring.formatAccuracy(bestAttempt.accuracy)}</span>
            <span class="shift-stat-label">Accuracy</span>
          </div>
          <div class="shift-stat">
            <span class="shift-stat-value">${attemptCount}</span>
            <span class="shift-stat-label">${attemptCount === 1 ? 'Attempt' : 'Attempts'}</span>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="shift-card-header">
        <div>
          <div class="shift-card-title">Shift ${shiftMeta.shift}</div>
          <div class="shift-card-meta">
            ${_icon('clock', 'icon-xs')}
            ${_esc(shiftMeta.shiftTime)}
            &nbsp;&middot;&nbsp;
            ${_icon('paper', 'icon-xs')}
            pp. ${shiftMeta.startPage}–${shiftMeta.endPage}
          </div>
        </div>
        <span class="badge badge-${variant}">${_esc(label)}</span>
      </div>
      ${statsHtml}
    `;

    return card;
  }

  /* ─────────────────────────────────────────────────────────────
     DATE GROUP HEADER COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Build a date group header element for Browse page.
   * @param {string} dateStr  ISO date string e.g. '2025-08-07'
   * @returns {HTMLElement}
   */
  function DateGroupHeader(dateStr) {
    const div        = document.createElement('div');
    div.className    = 'date-group-header';
    div.textContent  = Scoring.formatDate(dateStr);
    return div;
  }

  /* ─────────────────────────────────────────────────────────────
     QUESTION CARD / QUESTION RENDERER
  ───────────────────────────────────────────────────────────── */

  /**
   * Render question badges row into a container.
   * @param {HTMLElement} container  The .question-badges element
   * @param {Object}      question
   * @param {Object}      settings   App settings (showBadges)
   */
  function renderQuestionBadges(container, question, settings) {
    container.innerHTML = '';
    if (!settings.showBadges) return;

    const subjectVariant    = subjectBadgeVariant(question.subject);
    const difficultyVariant = difficultyBadgeVariant(question.difficulty);

    container.innerHTML = `
      ${Badge(question.subject,   subjectVariant)}
      ${Badge(question.topic,     'muted')}
      ${Badge(question.difficulty, difficultyVariant)}
    `;
  }

  /**
   * Render the question text into a container.
   * Handles MathJax trigger for Mathematics subject.
   * @param {HTMLElement} container
   * @param {Object}      question
   */
  function renderQuestionText(container, question) {
    container.innerHTML = _esc(question.question);
  }

  /**
   * Render options list for a question.
   * @param {HTMLElement} container   The .options-list element
   * @param {Object}      question
   * @param {number|null} selectedAnswer  Currently selected option index (0-based)
   * @param {boolean}     disabled        Whether options are clickable
   * @param {number|null} correctAnswer   Show correct answer (review mode)
   * @param {number|null} userAnswer      User's answer (review mode)
   * @param {Function}    onSelect        Callback(optionIndex)
   */
  function renderOptions(
    container,
    question,
    selectedAnswer,
    disabled,
    correctAnswer,
    userAnswer,
    onSelect
  ) {
    container.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];

    question.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-item';
      btn.disabled  = disabled;

      // Determine state classes
      let labelStyle = '';

      if (correctAnswer !== null && correctAnswer !== undefined) {
        // Review mode
        if (idx === correctAnswer && idx === userAnswer) {
          btn.classList.add('option-correct');
          labelStyle = 'background:var(--status-correct);color:#fff';
        } else if (idx === correctAnswer) {
          btn.classList.add('option-correct-highlight');
          labelStyle = 'background:var(--status-correct);color:#fff';
        } else if (idx === userAnswer && userAnswer !== correctAnswer) {
          btn.classList.add('option-wrong');
          labelStyle = 'background:var(--status-wrong);color:#fff';
        }
      } else {
        // Quiz / exam mode
        if (idx === selectedAnswer) {
          btn.classList.add('option-selected');
          labelStyle = 'background:var(--accent-blue);color:#fff';
        }
      }

      // Status icon for review mode
      let statusIcon = '';
      if (correctAnswer !== null && correctAnswer !== undefined) {
        if (idx === correctAnswer) {
          statusIcon = `<svg class="icon icon-sm" style="color:var(--status-correct);flex-shrink:0;">
                          <use href="#icon-check"/>
                        </svg>`;
        } else if (idx === userAnswer && userAnswer !== correctAnswer) {
          statusIcon = `<svg class="icon icon-sm" style="color:var(--status-wrong);flex-shrink:0;">
                          <use href="#icon-cross"/>
                        </svg>`;
        }
      }

      btn.innerHTML = `
        <span class="option-label" style="${labelStyle}">${labels[idx]}</span>
        <span class="option-text">${_esc(optText)}</span>
        ${statusIcon}
      `;

      if (!disabled && onSelect) {
        btn.addEventListener('click', () => onSelect(idx));
      }

      container.appendChild(btn);
    });
  }

  /**
   * Render explanation box.
   * @param {HTMLElement} boxEl    The .explanation-box element
   * @param {HTMLElement} textEl   The .explanation-text element
   * @param {Object}      question
   * @param {boolean}     show
   */
  function renderExplanation(boxEl, textEl, question, show) {
    if (!boxEl || !textEl) return;
    if (!show) {
      boxEl.style.display = 'none';
      return;
    }
    boxEl.style.display = 'block';
    textEl.innerHTML    = _esc(question.explanation || 'No explanation available.');
  }

  /* ─────────────────────────────────────────────────────────────
     PALETTE BUTTON BUILDER
  ───────────────────────────────────────────────────────────── */

  /**
   * Get the CSS class for a palette button based on question state.
   * @param {string}  questionId
   * @param {number}  currentIndex  Current question index
   * @param {number}  questionIndex This button's question index
   * @param {Object}  answers       { questionId: selectedIndex|null }
   * @param {Object}  visited       { questionId: boolean }
   * @param {Object}  flagged       { questionId: boolean }
   * @returns {string} CSS class name
   */
  function getPaletteButtonClass(
    questionId,
    currentIndex,
    questionIndex,
    answers,
    visited,
    flagged
  ) {
    const isAnswered = answers[questionId] !== null &&
                       answers[questionId] !== undefined;
    const isFlagged  = !!flagged[questionId];
    const isVisited  = !!visited[questionId];
    const isCurrent  = questionIndex === currentIndex;

    let cls = 'palette-btn';
    if (isFlagged)       cls += ' flagged';
    else if (isAnswered) cls += ' answered';
    else if (isVisited)  cls += ' visited';
    else                 cls += ' not-visited';

    if (isCurrent) cls += ' current';
    return cls;
  }

  /**
   * Build the full palette grid.
   * @param {HTMLElement} gridEl    The #palette-grid element
   * @param {Array}       questions
   * @param {number}      currentIndex
   * @param {Object}      answers
   * @param {Object}      visited
   * @param {Object}      flagged
   * @param {Function}    onJump    Callback(questionIndex)
   */
  function buildPaletteGrid(
    gridEl,
    questions,
    currentIndex,
    answers,
    visited,
    flagged,
    onJump
  ) {
    gridEl.innerHTML = '';

    questions.forEach((q, idx) => {
      const btn       = document.createElement('button');
      btn.className   = getPaletteButtonClass(
        q.id, currentIndex, idx, answers, visited, flagged
      );
      btn.textContent = idx + 1;
      btn.title       = `Question ${idx + 1}`;
      btn.addEventListener('click', () => onJump(idx));
      gridEl.appendChild(btn);
    });
  }

  /**
   * Update palette summary counts.
   * @param {Array}  questions
   * @param {Object} answers
   * @param {Object} flagged
   * @param {Object} visited
   */
  function updatePaletteSummary(questions, answers, flagged, visited) {
    let answered  = 0;
    let flaggedCt = 0;
    let visitedCt = 0;

    questions.forEach(q => {
      const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
      const isFlagged  = !!flagged[q.id];
      const isVisited  = !!visited[q.id] && !isAnswered;

      if (isAnswered) answered++;
      if (isFlagged)  flaggedCt++;
      if (isVisited)  visitedCt++;
    });

    const remaining = questions.length - answered;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('palette-count-answered',  answered);
    setText('palette-count-flagged',   flaggedCt);
    setText('palette-count-visited',   visitedCt);
    setText('palette-count-remaining', remaining);
  }

  /* ─────────────────────────────────────────────────────────────
     TIMER DISPLAY
  ───────────────────────────────────────────────────────────── */

  /**
   * Update the timer display element.
   * @param {HTMLElement} timerEl       The .quiz-timer element
   * @param {HTMLElement} timerDisplay  The span with time text
   * @param {number}      remainingSeconds
   */
  function updateTimerDisplay(timerEl, timerDisplay, remainingSeconds) {
    if (!timerEl || !timerDisplay) return;

    const timeStr = Scoring.formatTime(remainingSeconds);
    timerDisplay.textContent = timeStr;

    if (Scoring.isTimerWarning(remainingSeconds)) {
      timerEl.classList.add('warning');
      // Swap icon to warning variant
      const useEl = timerEl.querySelector('use');
      if (useEl) useEl.setAttribute('href', '#icon-timer-warning');
    } else {
      timerEl.classList.remove('warning');
      const useEl = timerEl.querySelector('use');
      if (useEl) useEl.setAttribute('href', '#icon-timer');
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SCORE CARD (Result Page)
  ───────────────────────────────────────────────────────────── */

  /**
   * Populate the result page score card.
   * @param {Object} result  Complete attempt object from Scoring.generateResult()
   */
  function renderScoreCard(result) {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const scoreColor = Scoring.getScoreColor(result.finalScore, result.totalQuestions);

    const scoreEl = document.getElementById('result-score-main');
    if (scoreEl) {
      scoreEl.textContent  = Scoring.formatScore(result.finalScore);
      scoreEl.style.color  = scoreColor;
    }

    setText('result-total-marks',  result.totalQuestions);
    setText('result-correct',      result.correct);
    setText('result-wrong',        result.wrong);
    setText('result-skipped',      result.skipped);
    setText('result-negative',     `-${Scoring.formatScore(result.negativeMarks)}`);
    setText('result-accuracy',     Scoring.formatAccuracy(result.accuracy));
    setText('result-time-taken',   Scoring.formatTime(result.timeTaken));
  }

  /**
   * Render the comparison banner (improved / declined / same).
   * @param {Object|null} comparison  From Scoring.compareWithBest()
   */
  function renderComparisonBanner(comparison) {
    const banner  = document.getElementById('comparison-banner');
    const iconEl  = document.getElementById('comparison-icon');
    const textEl  = document.getElementById('comparison-text');
    if (!banner) return;

    if (!comparison) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';

    const { type, delta, bestPrevious } = comparison;
    const absD  = Math.abs(delta).toFixed(2);
    const prev  = Scoring.formatScore(bestPrevious.finalScore);

    if (type === 'improved') {
      iconEl.className = 'comparison-icon improved';
      iconEl.innerHTML = Icon('improvement-up', 'icon-md');
      textEl.innerHTML = `<strong>Improved by +${absD}</strong> over your best of ${prev}`;
    } else if (type === 'declined') {
      iconEl.className = 'comparison-icon declined';
      iconEl.innerHTML = Icon('improvement-down', 'icon-md');
      textEl.innerHTML = `<strong>Down by ${absD}</strong> from your best of ${prev}`;
    } else {
      iconEl.className = 'comparison-icon same';
      iconEl.innerHTML = Icon('target', 'icon-md');
      textEl.innerHTML = `<strong>Same score</strong> as your best of ${prev}`;
    }
  }

  /**
   * Render subject-wise breakdown table on result page.
   * @param {Object} subjectWise  { subjectName: { correct, wrong, skipped, score, accuracy } }
   */
  function renderSubjectTable(subjectWise) {
    const tbody = document.getElementById('result-subject-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const subjects = [
      { name: 'General Awareness',                  short: 'Gen. Awareness' },
      { name: 'Mathematics',                         short: 'Mathematics'    },
      { name: 'General Intelligence and Reasoning',  short: 'Reasoning'      },
    ];

    subjects.forEach(({ name, short }) => {
      const d   = subjectWise[name] || { correct: 0, wrong: 0, skipped: 0, score: 0, accuracy: 0 };
      const tr  = document.createElement('tr');
      const scoreColor = d.score >= 0
        ? 'var(--accent-green)'
        : 'var(--accent-red)';

      tr.innerHTML = `
        <td>${_esc(short)}</td>
        <td style="color:var(--status-correct)">${d.correct}</td>
        <td style="color:var(--status-wrong)">${d.wrong}</td>
        <td style="color:var(--text-muted)">${d.skipped}</td>
        <td style="color:${scoreColor};font-weight:600">
          ${Scoring.formatScore(d.score)}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     HISTORY ITEM COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Build a history list item element.
   * @param {Object} item   { shiftId, shiftMeta, attempt }
   * @param {Function} onClick
   * @returns {HTMLElement}
   */
  function HistoryItem(item, onClick) {
    const { shiftMeta, attempt } = item;
    const el       = document.createElement('div');
    el.className   = 'history-item';

    const scoreColor = Scoring.getScoreColor(
      attempt.finalScore,
      attempt.totalQuestions
    );
    const modeLabel  = attempt.mode === 'exam' ? 'Exam' : 'Quiz';
    const dateStr    = Scoring.formatDateTime(attempt.attemptDate);

    el.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-title">
          ${_esc(Scoring.formatDate(shiftMeta.date))} &mdash; Shift ${shiftMeta.shift}
          &nbsp;${Badge(modeLabel, attempt.mode === 'exam' ? 'purple' : 'blue')}
        </div>
        <div class="history-item-meta">
          Attempt #${attempt.attemptNumber} &nbsp;&middot;&nbsp; ${_esc(dateStr)}
          &nbsp;&middot;&nbsp; ${Scoring.formatTime(attempt.timeTaken)}
        </div>
      </div>
      <div class="history-item-score">
        <span class="history-score-value" style="color:${scoreColor}">
          ${Scoring.formatScore(attempt.finalScore)}
        </span>
        <span class="history-score-acc">${Scoring.formatAccuracy(attempt.accuracy)}</span>
      </div>
      ${_icon('chevron-right', 'icon-sm text-muted')}
    `;

    el.addEventListener('click', onClick);
    return el;
  }

  /* ─────────────────────────────────────────────────────────────
     BOOKMARK ITEM COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Build a bookmark list item element (collapsible).
   * @param {Object}   question         Full question object
   * @param {boolean}  isFlagged
   * @param {Function} onRemove         Callback()
   * @param {Function} onFlagToggle     Callback()
   * @returns {HTMLElement}
   */
  function BookmarkItem(question, isFlagged, onRemove, onFlagToggle) {
    const el      = document.createElement('div');
    el.className  = 'bookmark-item';
    el.dataset.questionId = question.id;

    const subjectVariant    = subjectBadgeVariant(question.subject);
    const difficultyVariant = difficultyBadgeVariant(question.difficulty);
    const correctLetter     = ['A', 'B', 'C', 'D'][question.correctAnswer];
    const correctText       = question.options[question.correctAnswer] || '';

    el.innerHTML = `
      <div class="bookmark-item-header">
        <div class="bookmark-item-info">
          <div class="bookmark-question-preview">${_esc(question.question)}</div>
          <div class="bookmark-item-badges">
            ${Badge(question.subject,    subjectVariant)}
            ${Badge(question.difficulty, difficultyVariant)}
            ${Badge(question.subTopic,   'muted')}
          </div>
        </div>
        <button class="btn-icon bookmark-toggle-btn" aria-label="Expand question" title="Expand">
          ${_icon('chevron-down', 'icon-sm')}
        </button>
      </div>
      <div class="bookmark-item-body">
        <div class="question-text mb-3" style="font-size:var(--font-size-sm)">
          ${_esc(question.question)}
        </div>
        <div class="options-list bm-options-list mb-3"></div>
        <div class="bookmark-correct-answer">
          ${_icon('check', 'icon-sm')}
          Correct Answer: <strong>(${correctLetter}) ${_esc(correctText)}</strong>
        </div>
        <div class="explanation-box mt-3">
          <div class="explanation-title">
            ${_icon('info', 'icon-sm')} Explanation
          </div>
          <div class="explanation-text">${_esc(question.explanation || '')}</div>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-ghost btn-sm bm-flag-btn">
            ${_icon(isFlagged ? 'flag-filled' : 'flag', 'icon-sm')}
            ${isFlagged ? 'Unflag' : 'Flag'}
          </button>
          <button class="btn btn-danger btn-sm bm-remove-btn">
            ${_icon('bookmark-filled', 'icon-sm')}
            Remove Bookmark
          </button>
        </div>
      </div>
    `;

    // Build options inside body
    const optsList = el.querySelector('.bm-options-list');
    renderOptions(
      optsList,
      question,
      null,
      true,
      question.correctAnswer,
      null,
      null
    );

    // Toggle expand/collapse
    const header    = el.querySelector('.bookmark-item-header');
    const body      = el.querySelector('.bookmark-item-body');
    const toggleBtn = el.querySelector('.bookmark-toggle-btn');
    const chevron   = toggleBtn.querySelector('use');

    header.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      chevron.setAttribute('href', isOpen ? '#icon-chevron-up' : '#icon-chevron-down');
      toggleBtn.setAttribute('aria-label', isOpen ? 'Collapse question' : 'Expand question');

      // Trigger MathJax if math subject
      if (isOpen && question.subject === 'Mathematics') {
        _triggerMathJax(body);
      }
    });

    // Flag button
    const flagBtn = el.querySelector('.bm-flag-btn');
    flagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onFlagToggle();
      // Update button state
      const nowFlagged = Storage.isFlagged(question.id);
      const useEl      = flagBtn.querySelector('use');
      if (useEl) useEl.setAttribute('href', nowFlagged ? '#icon-flag-filled' : '#icon-flag');
      flagBtn.innerHTML = `
        ${_icon(nowFlagged ? 'flag-filled' : 'flag', 'icon-sm')}
        ${nowFlagged ? 'Unflag' : 'Flag'}
      `;
    });

    // Remove bookmark button
    const removeBtn = el.querySelector('.bm-remove-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove();
      // Animate out
      el.style.transition = 'opacity 0.2s, transform 0.2s';
      el.style.opacity    = '0';
      el.style.transform  = 'translateX(10px)';
      setTimeout(() => el.remove(), 220);
    });

    return el;
  }

  /* ─────────────────────────────────────────────────────────────
     ATTEMPT HISTORY TABLE ROW
  ───────────────────────────────────────────────────────────── */

  /**
   * Build an attempt history table row.
   * @param {Object}   attempt
   * @param {Function} onClick
   * @returns {HTMLElement} <tr>
   */
  function AttemptTableRow(attempt, onClick) {
    const tr        = document.createElement('tr');
    tr.style.cursor = 'pointer';

    const modeLabel  = attempt.mode === 'exam' ? 'Exam' : 'Quiz';
    const scoreColor = Scoring.getScoreColor(
      attempt.finalScore,
      attempt.totalQuestions
    );

    tr.innerHTML = `
      <td>${attempt.attemptNumber}</td>
      <td>${_esc(Scoring.formatDate(attempt.attemptDate))}</td>
      <td>${Badge(modeLabel, attempt.mode === 'exam' ? 'purple' : 'blue')}</td>
      <td style="color:${scoreColor};font-weight:600">
        ${Scoring.formatScore(attempt.finalScore)}
      </td>
      <td>${Scoring.formatAccuracy(attempt.accuracy)}</td>
      <td>${Scoring.formatTime(attempt.timeTaken)}</td>
    `;

    tr.addEventListener('click', onClick);
    return tr;
  }

  /* ─────────────────────────────────────────────────────────────
     TOAST NOTIFICATION
  ───────────────────────────────────────────────────────────── */

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {string} type    'success'|'error'|'warning'|'info'
   * @param {number} duration  Milliseconds (default 3000)
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
      success: 'success',
      error:   'error',
      warning: 'warning',
      info:    'info',
    };

    const toast       = document.createElement('div');
    toast.className   = `toast toast-${type}`;
    toast.innerHTML   = `
      ${_icon(iconMap[type] || 'info', 'icon-sm')}
      <span>${_esc(message)}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ─────────────────────────────────────────────────────────────
     MODAL (Shared dialog)
  ───────────────────────────────────────────────────────────── */

  /**
   * Show the shared modal dialog.
   * @param {Object} options
   * @param {string}   options.title
   * @param {string}   options.body
   * @param {Array}    options.actions  [{ label, variant, onClick, closeAfter }]
   */
  function showModal({ title, body, actions = [] }) {
    const overlay     = document.getElementById('modal-overlay');
    const titleEl     = document.getElementById('modal-title');
    const bodyEl      = document.getElementById('modal-body');
    const actionsEl   = document.getElementById('modal-actions');

    if (!overlay) return;

    titleEl.textContent   = title;
    bodyEl.textContent    = body;
    actionsEl.innerHTML   = '';

    actions.forEach(action => {
      const btn       = document.createElement('button');
      btn.className   = `btn btn-${action.variant || 'secondary'} btn-block`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.closeAfter !== false) hideModal();
        if (action.onClick) action.onClick();
      });
      actionsEl.appendChild(btn);
    });

    overlay.classList.add('open');

    // Close on overlay click
    const handleOverlayClick = (e) => {
      if (e.target === overlay) {
        hideModal();
        overlay.removeEventListener('click', handleOverlayClick);
      }
    };
    overlay.addEventListener('click', handleOverlayClick);
  }

  /**
   * Hide the shared modal.
   */
  function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  /* ─────────────────────────────────────────────────────────────
     PROGRESS RING (Home Page)
  ───────────────────────────────────────────────────────────── */

  /**
   * Update the home page progress ring.
   * @param {number} completed  Number of completed shifts
   * @param {number} total      Total shifts (54)
   */
  function updateProgressRing(completed, total) {
    const ring   = document.getElementById('progress-ring-fill');
    const value  = document.getElementById('progress-ring-value');
    const desc   = document.getElementById('progress-desc');
    if (!ring) return;

    const circumference = 2 * Math.PI * 42; // r=42
    const pct           = total > 0 ? completed / total : 0;
    const offset        = circumference * (1 - pct);

    ring.style.strokeDasharray  = circumference.toFixed(1);
    ring.style.strokeDashoffset = offset.toFixed(1);

    if (value) value.textContent = completed;

    if (desc) {
      if (completed === 0) {
        desc.textContent = 'Start your first shift to begin tracking progress across all 54 exam papers.';
      } else if (completed === total) {
        desc.textContent = 'All 54 shifts completed! You can retake any shift to improve your score.';
      } else {
        const remaining  = total - completed;
        desc.textContent = `${completed} of ${total} shifts done. ${remaining} remaining.`;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     RECENT ACTIVITY LIST (Home Page)
  ───────────────────────────────────────────────────────────── */

  /**
   * Render recent activity items on the home page.
   * @param {Array} recentAttempts  From Analytics.getDashboardStats().recentAttempts
   * @param {Function} onClick      Callback(shiftId)
   */
  function renderRecentActivity(recentAttempts, onClick) {
    const container = document.getElementById('home-recent-list');
    if (!container) return;

    container.innerHTML = '';

    if (!recentAttempts || recentAttempts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="icon" style="width:56px;height:56px;"><use href="#icon-history"/></svg>
          </div>
          <div class="empty-state-title">No attempts yet</div>
          <div class="empty-state-desc">Complete a shift to see your recent activity here.</div>
        </div>
      `;
      return;
    }

    recentAttempts.forEach(item => {
      const scoreColor = Scoring.getScoreColor(item.score, 100);
      const el         = document.createElement('div');
      el.className     = 'recent-item';

      el.innerHTML = `
        <div class="recent-item-info">
          <div class="recent-item-title">
            ${_esc(Scoring.formatDate(item.shiftDate))} — Shift ${item.shift}
          </div>
          <div class="recent-item-meta">
            ${_esc(Scoring.formatDateTime(item.date))}
            &nbsp;&middot;&nbsp;
            ${Scoring.formatAccuracy(item.accuracy)} accuracy
          </div>
        </div>
        <div class="recent-item-score" style="color:${scoreColor}">
          ${Scoring.formatScore(item.score)}
        </div>
        ${_icon('chevron-right', 'icon-sm text-muted')}
      `;

      el.addEventListener('click', () => onClick(item.shiftId));
      container.appendChild(el);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     HOME PAGE STATS
  ───────────────────────────────────────────────────────────── */

  /**
   * Update home page stat cards.
   * @param {Object} stats  From Analytics.getDashboardStats()
   */
  function updateHomeStats(stats) {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('home-shifts-attempted', stats.shiftsCompleted);
    setText('home-accuracy',
      stats.totalQuestionsAttempted > 0
        ? Scoring.formatAccuracy(stats.overallAccuracy)
        : '0%'
    );
    setText('home-streak', stats.currentStreak);

    updateProgressRing(stats.shiftsCompleted, stats.totalShifts);
    renderRecentActivity(stats.recentAttempts, (shiftId) => {
      if (typeof App !== 'undefined') App.navigateTo('shift-detail', { shiftId });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     EMPTY STATE COMPONENT
  ───────────────────────────────────────────────────────────── */

  /**
   * Build an empty state element.
   * @param {string} title
   * @param {string} desc
   * @param {string} iconName
   * @returns {HTMLElement}
   */
  function EmptyState(title, desc, iconName = 'info') {
    const el      = document.createElement('div');
    el.className  = 'empty-state';
    el.innerHTML  = `
      <div class="empty-state-icon">
        <svg class="icon" style="width:56px;height:56px;"><use href="#icon-${iconName}"/></svg>
      </div>
      <div class="empty-state-title">${_esc(title)}</div>
      <div class="empty-state-desc">${_esc(desc)}</div>
    `;
    return el;
  }

  /* ─────────────────────────────────────────────────────────────
     SKELETON LOADER
  ───────────────────────────────────────────────────────────── */

  /**
   * Build skeleton loading placeholders.
   * @param {number} count  Number of skeleton cards to render
   * @returns {string} HTML string
   */
  function SkeletonList(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="card mb-3">
          <div class="skeleton skeleton-title" style="width:50%"></div>
          <div class="skeleton skeleton-text" style="width:70%"></div>
          <div class="skeleton skeleton-text" style="width:40%"></div>
        </div>
      `;
    }
    return html;
  }

  /* ─────────────────────────────────────────────────────────────
     SHIFT DETAIL PAGE COMPONENTS
  ───────────────────────────────────────────────────────────── */

  /**
   * Populate the shift detail page header.
   * @param {Object} shiftMeta
   * @param {string} status
   */
  function renderShiftDetailHeader(shiftMeta, status) {
    const titleEl  = document.getElementById('detail-title');
    const metaEl   = document.getElementById('detail-meta');
    const statusEl = document.getElementById('detail-status-row');

    if (titleEl) {
      titleEl.textContent = `${Scoring.formatDate(shiftMeta.date)} — Shift ${shiftMeta.shift}`;
    }

    if (metaEl) {
      metaEl.innerHTML = `
        <div class="shift-detail-meta-item">
          ${_icon('clock', 'icon-xs')}
          ${_esc(shiftMeta.shiftTime)}
        </div>
        <div class="shift-detail-meta-item">
          ${_icon('paper', 'icon-xs')}
          Pages ${shiftMeta.startPage}–${shiftMeta.endPage}
        </div>
        <div class="shift-detail-meta-item">
          ${_icon('timer', 'icon-xs')}
          90 minutes
        </div>
      `;
    }

    if (statusEl) {
      const variant = statusBadgeVariant(status);
      const label   = statusLabel(status);
      statusEl.innerHTML = Badge(label, variant);
    }
  }

  /**
   * Populate attempt history table on shift detail page.
   * @param {Array}    attempts
   * @param {Function} onRowClick  Callback(attempt)
   */
  function renderAttemptHistory(attempts, onRowClick) {
    const section = document.getElementById('detail-attempts-section');
    const tbody   = document.getElementById('detail-attempts-tbody');

    if (!section || !tbody) return;

    if (attempts.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    tbody.innerHTML       = '';

    // Show most recent first
    [...attempts].reverse().forEach(attempt => {
      const row = AttemptTableRow(attempt, () => onRowClick(attempt));
      tbody.appendChild(row);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CUSTOM QUIZ BUILDER COMPONENTS
  ───────────────────────────────────────────────────────────── */

  /**
   * Build subject filter checkboxes for the builder.
   * @param {Array}    subjects  From taxonomy
   * @param {Array}    selected  Currently selected subject names
   * @param {Function} onChange  Callback(selectedSubjects)
   * @returns {HTMLElement}
   */
  function buildSubjectFilterGroup(subjects, selected, onChange) {
    const group   = document.createElement('div');
    group.className = 'toggle-group';

    subjects.forEach(subject => {
      const isChecked = selected.includes(subject.name);
      const row       = document.createElement('label');
      row.className   = 'toggle-row';
      row.style.cursor = 'pointer';

      row.innerHTML = `
        <input type="checkbox" name="builder-subject"
               value="${_esc(subject.name)}"
               ${isChecked ? 'checked' : ''}
               style="display:none;">
        <div class="toggle-row-info">
          <div class="toggle-row-label">${_esc(subject.name)}</div>
          <div class="toggle-row-desc">${subject.questionCount} questions per shift</div>
        </div>
        ${_icon(isChecked ? 'checkbox-filled' : 'checkbox-empty', 'icon-md')}
      `;

      const input  = row.querySelector('input');
      const iconEl = row.querySelector('svg use');

      input.addEventListener('change', () => {
        iconEl.setAttribute(
          'href',
          input.checked ? '#icon-checkbox-filled' : '#icon-checkbox-empty'
        );
        const checked = Array.from(
          document.querySelectorAll('input[name="builder-subject"]:checked')
        ).map(el => el.value);
        onChange(checked);
      });

      group.appendChild(row);
    });

    return group;
  }

  /**
   * Build the settings summary card for builder step 4.
   * @param {Object} config  Builder configuration object
   * @returns {string} HTML string
   */
  function buildBuilderSummary(config) {
    const subjects = config.subjects.length > 0
      ? config.subjects.join(', ')
      : 'All Subjects';

    const sourceLabel = config.source === 'all'
      ? 'All 54 Shifts'
      : config.source === 'date-range'
        ? `${config.dateFrom} to ${config.dateTo}`
        : `${config.specificShifts.length} shift(s) selected`;

    const timerLabel = config.timerEnabled
      ? `${config.timerMins} minutes`
      : 'No timer';

    const rows = [
      { label: 'Source',     value: sourceLabel },
      { label: 'Subjects',   value: subjects },
      { label: 'Difficulty', value: config.difficulty === 'all' ? 'All' : config.difficulty },
      { label: 'Timer',      value: timerLabel },
      { label: 'Shuffle',    value: config.shuffle ? 'Yes' : 'No' },
    ];

    return rows.map(r => `
      <div class="flex-between mb-2">
        <span class="text-sm text-muted">${_esc(r.label)}</span>
        <span class="text-sm font-medium text-primary">${_esc(r.value)}</span>
      </div>
    `).join('');
  }

  /* ─────────────────────────────────────────────────────────────
     MATHJAX HELPER
  ───────────────────────────────────────────────────────────── */

  /**
   * Trigger MathJax typesetting on a container element.
   * Only runs if MathJax is loaded.
   * @param {HTMLElement} container
   */
  function _triggerMathJax(container) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([container]).catch(err =>
        console.warn('[MathJax] Typeset error:', err)
      );
    }
  }

  /**
   * Load MathJax CDN script if not already loaded.
   * Called only when a Mathematics question is encountered.
   */
  function loadMathJax() {
    if (window.MathJax && window.MathJax.typesetPromise) return Promise.resolve();
    if (document.getElementById('mathjax-script')) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script    = document.createElement('script');
      script.id       = 'mathjax-script';
      script.src      = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
      script.async    = true;
      script.onload   = resolve;
      script.onerror  = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Typeset a question's math content.
   * Loads MathJax on demand, then typesets the question area.
   * @param {Object}      question
   * @param {HTMLElement} container  Element containing question text and options
   */
  async function typesetQuestion(question, container) {
    if (question.subject !== 'Mathematics') return;

    try {
      await loadMathJax();
      if (window.MathJax && window.MathJax.typesetPromise) {
        await window.MathJax.typesetPromise([container]);
      }
    } catch (e) {
      console.warn('[MathJax] Failed to typeset:', e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     QUIZ HEADER UPDATER
  ───────────────────────────────────────────────────────────── */

  /**
   * Update the quiz header with current question info.
   * @param {Object} shiftMeta
   * @param {number} currentIndex  0-based
   * @param {number} total
   */
  function updateQuizHeader(shiftMeta, currentIndex, total) {
    const nameEl    = document.getElementById('quiz-shift-name');
    const counterEl = document.getElementById('quiz-question-counter');

    if (nameEl) {
      nameEl.textContent = shiftMeta
        ? `${Scoring.formatDate(shiftMeta.date)} — Shift ${shiftMeta.shift}`
        : 'Custom Quiz';
    }

    if (counterEl) {
      counterEl.textContent = `Q ${currentIndex + 1} / ${total}`;
    }
  }

  /**
   * Update bookmark and flag button states in quiz bottom bar.
   * @param {string}  questionId
   */
  function updateQuizActionButtons(questionId) {
    const bmBtn   = document.getElementById('quiz-bookmark-btn');
    const flagBtn = document.getElementById('quiz-flag-btn');

    if (bmBtn) {
      const isBookmarked = Storage.isBookmarked(questionId);
      const useEl        = bmBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href',
          isBookmarked ? '#icon-bookmark-filled' : '#icon-bookmark'
        );
      }
      bmBtn.classList.toggle('active', isBookmarked);
      bmBtn.title = isBookmarked ? 'Remove bookmark' : 'Bookmark';
    }

    if (flagBtn) {
      const isFlagged = Storage.isFlagged(questionId);
      const useEl     = flagBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href',
          isFlagged ? '#icon-flag-filled' : '#icon-flag'
        );
      }
      flagBtn.classList.toggle('active', isFlagged);
      flagBtn.title = isFlagged ? 'Remove flag' : 'Flag for review';
    }
  }

  /**
   * Update review mode bookmark and flag buttons.
   * @param {string} questionId
   */
  function updateReviewActionButtons(questionId) {
    const bmBtn   = document.getElementById('review-bookmark-btn');
    const flagBtn = document.getElementById('review-flag-btn');

    if (bmBtn) {
      const isBookmarked = Storage.isBookmarked(questionId);
      const useEl        = bmBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href',
          isBookmarked ? '#icon-bookmark-filled' : '#icon-bookmark'
        );
      }
      bmBtn.classList.toggle('active', isBookmarked);
    }

    if (flagBtn) {
      const isFlagged = Storage.isFlagged(questionId);
      const useEl     = flagBtn.querySelector('use');
      if (useEl) {
        useEl.setAttribute('href',
          isFlagged ? '#icon-flag-filled' : '#icon-flag'
        );
      }
      flagBtn.classList.toggle('active', isFlagged);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     NAVIGATION BUTTON STATE
  ───────────────────────────────────────────────────────────── */

  /**
   * Update prev/next/skip button states.
   * @param {number} currentIndex
   * @param {number} total
   * @param {string} mode  'quiz'|'exam'
   */
  function updateNavButtons(currentIndex, total, mode) {
    const prevBtn = document.getElementById('quiz-prev-btn');
    const nextBtn = document.getElementById('quiz-next-btn');
    const skipBtn = document.getElementById('quiz-skip-btn');

    if (prevBtn) {
      prevBtn.disabled         = currentIndex === 0 || mode === 'exam';
      prevBtn.style.display    = mode === 'exam' ? 'none' : '';
    }

    if (nextBtn) {
      const isLast             = currentIndex === total - 1;
      nextBtn.textContent      = '';
      if (isLast) {
        nextBtn.innerHTML = `${_icon('submit', 'icon-sm')} Submit`;
        nextBtn.className = 'btn btn-danger btn-sm';
      } else {
        nextBtn.innerHTML = `Next ${_icon('next', 'icon-sm')}`;
        nextBtn.className = 'btn btn-primary btn-sm';
      }
    }

    if (skipBtn) {
      skipBtn.style.display = mode === 'exam' ? 'none' : '';
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    // Core
    Icon,
    Badge,
    EmptyState,
    SkeletonList,

    // Badge helpers
    subjectBadgeVariant,
    difficultyBadgeVariant,
    statusBadgeVariant,
    statusLabel,

    // Shift components
    ShiftCard,
    DateGroupHeader,
    renderShiftDetailHeader,
    renderAttemptHistory,
    AttemptTableRow,

    // Question rendering
    renderQuestionBadges,
    renderQuestionText,
    renderOptions,
    renderExplanation,

    // Palette
    getPaletteButtonClass,
    buildPaletteGrid,
    updatePaletteSummary,

    // Timer
    updateTimerDisplay,

    // Result page
    renderScoreCard,
    renderComparisonBanner,
    renderSubjectTable,

    // History
    HistoryItem,

    // Bookmarks
    BookmarkItem,

    // Home page
    updateProgressRing,
    renderRecentActivity,
    updateHomeStats,

    // Custom quiz builder
    buildSubjectFilterGroup,
    buildBuilderSummary,

    // Quiz UI
    updateQuizHeader,
    updateQuizActionButtons,
    updateReviewActionButtons,
    updateNavButtons,

    // Toast and Modal
    showToast,
    showModal,
    hideModal,

    // MathJax
    loadMathJax,
    typesetQuestion,
  };

})();