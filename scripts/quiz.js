/* ═══════════════════════════════════════════════════════════════
   QUIZ.JS — Final corrected version
   - Study mode with instant feedback
   - MathJax works (formulas)
   - Bookmarks & flags work (fixed event binding)
   - Quiz/exam mode selection fixed
═══════════════════════════════════════════════════════════════ */

const Quiz = (() => {

  /* ─────────────────────────────────────────────────────────────
     SESSION STATE
  ───────────────────────────────────────────────────────────── */

  const _session = {
    shiftId:        null,
    shiftMeta:      null,
    mode:           'quiz',
    isCustom:       false,
    isReview:       false,
    studyMode:      false,

    questions:      [],
    currentIndex:   0,

    answers:        {},
    visited:        {},
    flagged:        {},
    timings:        {},

    timerEnabled:   true,
    totalSeconds:   5400,
    remainingSeconds: 5400,
    timerInterval:  null,
    questionStartTime: null,

    paletteOpen:    false,
    isPaused:       false,

    reviewFilter:         'all',
    reviewQuestionWise:   [],
    reviewCurrentIndex:   0,

    attemptStartTime: null,
    _resultMap:       {},
  };

  /* ─────────────────────────────────────────────────────────────
     START — Standard shift quiz / exam
  ───────────────────────────────────────────────────────────── */

  async function start(shiftId, mode) {
    const shiftData = await Storage.loadShiftData(shiftId);
    if (!shiftData) {
      Components.showToast('Failed to load shift data.', 'error');
      return;
    }

    const shiftMeta = App.getShiftsIndex().find(s => s.id === shiftId);
    const settings  = Storage.getSettings();

    const inProgress = Storage.getInProgressAttempt(shiftId);
    if (inProgress && mode === 'quiz') {
      _offerResume(shiftId, mode, shiftData, shiftMeta, inProgress, settings);
      return;
    }

    _initSession({
      shiftId,
      shiftMeta,
      mode,
      questions:    shiftData.questions,
      isCustom:     false,
      studyMode:    false,
      timerEnabled: settings.timerEnabled,
      totalSeconds: Scoring.minutesToSeconds(settings.defaultTime),
    });

    App.navigateTo('quiz');
    _renderCurrentQuestion();
  }

  function _offerResume(shiftId, mode, shiftData, shiftMeta, inProgress, settings) {
    Components.showModal({
      title: 'Resume Quiz?',
      body:  `You have an unfinished attempt for this shift (Q${inProgress.currentIndex + 1} / ${inProgress.questions.length}). Would you like to resume?`,
      actions: [
        {
          label:   'Start Fresh',
          variant: 'secondary',
          onClick: () => {
            Storage.clearInProgressAttempt(shiftId);
            _initSession({
              shiftId,
              shiftMeta,
              mode,
              questions:    shiftData.questions,
              isCustom:     false,
              studyMode:    false,
              timerEnabled: settings.timerEnabled,
              totalSeconds: Scoring.minutesToSeconds(settings.defaultTime),
            });
            App.navigateTo('quiz');
            _renderCurrentQuestion();
          },
        },
        {
          label:   'Resume',
          variant: 'primary',
          onClick: () => {
            _restoreSession(inProgress, shiftMeta);
            App.navigateTo('quiz');
            _renderCurrentQuestion();
          },
        },
      ],
    });
  }

  /* ─────────────────────────────────────────────────────────────
     START — Custom quiz (practice, bookmarks, builder)
  ───────────────────────────────────────────────────────────── */

  async function startCustom(config) {
    const session = Storage.getCustomQuizSession();
    let questions  = config.questions || (session ? session.questions : []);

    if (!questions || questions.length === 0) {
      Components.showToast('No questions found for this configuration.', 'error');
      return;
    }

    questions = questions.slice(0, config.questionCount);

    if (config.shuffle) {
      Scoring.shuffle(questions);
    }

    const settings = Storage.getSettings();

    _initSession({
      shiftId:      null,
      shiftMeta:    null,
      mode:         'quiz',
      questions,
      isCustom:     true,
      studyMode:    config.studyMode || false,
      timerEnabled: config.timerEnabled ?? settings.timerEnabled,
      totalSeconds: Scoring.minutesToSeconds(
        config.timerEnabled ? (config.timerMins || settings.defaultTime) : 0
      ),
    });

    App.navigateTo('quiz');
    _renderCurrentQuestion();
  }

  /* ─────────────────────────────────────────────────────────────
     START — Review mode
  ───────────────────────────────────────────────────────────── */

  function startReview(questions, questionWiseResult, filter) {
    Object.assign(_session, _defaultSession());

    _session.isReview           = true;
    _session.questions          = questions;
    _session.reviewFilter       = filter;
    _session.reviewQuestionWise = questionWiseResult;
    _session.reviewCurrentIndex = 0;
    _session.timerEnabled       = false;
    _session.studyMode          = false;

    _session._resultMap = {};
    questionWiseResult.forEach(qr => {
      _session._resultMap[qr.questionId] = qr;
    });

    _renderReviewQuestion(0);
    _bindReviewControls();
    _updateReviewFilter(filter);
  }

  /* ─────────────────────────────────────────────────────────────
     SESSION INIT HELPERS
  ───────────────────────────────────────────────────────────── */

  function _defaultSession() {
    return {
      shiftId:          null,
      shiftMeta:        null,
      mode:             'quiz',
      isCustom:         false,
      isReview:         false,
      studyMode:        false,
      questions:        [],
      currentIndex:     0,
      answers:          {},
      visited:          {},
      flagged:          {},
      timings:          {},
      timerEnabled:     true,
      totalSeconds:     5400,
      remainingSeconds: 5400,
      timerInterval:    null,
      questionStartTime:null,
      paletteOpen:      false,
      isPaused:         false,
      reviewFilter:     'all',
      reviewQuestionWise: [],
      reviewCurrentIndex: 0,
      attemptStartTime: null,
      _resultMap:       {},
    };
  }

  function _initSession({
    shiftId, shiftMeta, mode, questions,
    isCustom, timerEnabled, totalSeconds,
    studyMode = false,
  }) {
    _stopTimer();

    Object.assign(_session, _defaultSession());

    _session.shiftId          = shiftId;
    _session.shiftMeta        = shiftMeta;
    _session.mode             = mode;
    _session.isCustom         = isCustom;
    _session.studyMode        = studyMode;
    _session.questions        = questions;
    _session.timerEnabled     = timerEnabled && mode === 'quiz'
                                  ? timerEnabled
                                  : (mode === 'exam' ? true : timerEnabled);
    _session.totalSeconds     = totalSeconds > 0 ? totalSeconds : 5400;
    _session.remainingSeconds = _session.totalSeconds;
    _session.attemptStartTime = new Date().toISOString();

    questions.forEach(q => {
      _session.answers[q.id] = null;
      _session.visited[q.id] = false;
      _session.timings[q.id] = 0;
    });

    questions.forEach(q => {
      _session.flagged[q.id] = Storage.isFlagged(q.id);
    });

    if (_session.timerEnabled && !_session.studyMode) {
      _startTimer();
    }

    _bindQuizControls();
    _updateModeUI();
  }

  function _restoreSession(saved, shiftMeta) {
    _stopTimer();
    Object.assign(_session, saved);
    _session.shiftMeta        = shiftMeta;
    _session.questionStartTime = Date.now();

    if (_session.timerEnabled && !_session.studyMode) {
      _startTimer();
    }

    _bindQuizControls();
    _updateModeUI();
  }

  /* ─────────────────────────────────────────────────────────────
     MODE UI SETUP
  ───────────────────────────────────────────────────────────── */

  function _updateModeUI() {
    const mode    = _session.mode;
    const isExam  = mode === 'exam';
    const isStudy = _session.studyMode;

    const pauseBtn = document.getElementById('quiz-pause-btn');
    if (pauseBtn) pauseBtn.style.display = (isExam || isStudy) ? 'none' : '';

    const paletteBtn = document.getElementById('quiz-palette-btn');
    if (paletteBtn) paletteBtn.style.display = isExam ? 'none' : '';

    const timerEl = document.getElementById('quiz-timer');
    if (timerEl) timerEl.style.display = isStudy ? 'none' : (_session.timerEnabled ? '' : 'none');

    const paletteSubmit = document.getElementById('palette-submit-btn');
    if (paletteSubmit) paletteSubmit.style.display = isStudy ? 'none' : '';
  }

  /* ─────────────────────────────────────────────────────────────
     TIMER
  ───────────────────────────────────────────────────────────── */

  function _startTimer() {
    _stopTimer();
    _session.questionStartTime = Date.now();

    _session.timerInterval = setInterval(() => {
      if (_session.isPaused) return;

      _session.remainingSeconds--;

      const timerEl      = document.getElementById('quiz-timer');
      const timerDisplay = document.getElementById('quiz-timer-display');
      Components.updateTimerDisplay(timerEl, timerDisplay, _session.remainingSeconds);

      if (_session.remainingSeconds % 30 === 0 && !_session.isCustom && _session.shiftId) {
        _saveProgress();
      }

      if (_session.remainingSeconds <= 0) {
        _stopTimer();
        _autoSubmit();
      }
    }, 1000);
  }

  function _stopTimer() {
    if (_session.timerInterval) {
      clearInterval(_session.timerInterval);
      _session.timerInterval = null;
    }
  }

  function _autoSubmit() {
    Components.showToast('Time is up! Submitting automatically.', 'warning', 4000);
    setTimeout(() => _submitQuiz(), 1500);
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER — with direct MathJax call (restored)
  ───────────────────────────────────────────────────────────── */

  function _renderCurrentQuestion() {
    const idx      = _session.currentIndex;
    const question = _session.questions[idx];
    if (!question) return;

    _session.visited[question.id] = true;
    _recordQuestionTime(idx);
    _session.questionStartTime = Date.now();

    const settings = Storage.getSettings();

    const badgesEl = document.getElementById('question-badges');
    if (badgesEl) {
      Components.renderQuestionBadges(badgesEl, question, settings);
    }

    const numLabel = document.getElementById('question-number-label');
    if (numLabel) {
      numLabel.textContent = `Question ${idx + 1}`;
    }

    const textEl = document.getElementById('question-text');
    if (textEl) {
      Components.renderQuestionText(textEl, question);
    }

    const optionsEl = document.getElementById('options-list');
    if (optionsEl) {
      Components.renderOptions(
        optionsEl,
        question,
        _session.answers[question.id],
        false,
        null,
        null,
        (selectedIdx) => _selectAnswer(selectedIdx)
      );
    }

    // For study mode, if the question was already answered, show feedback
    const expBox  = document.getElementById('explanation-box');
    const expText = document.getElementById('explanation-text');

    if (_session.studyMode && _session.answers[question.id] !== null && _session.answers[question.id] !== undefined) {
      _showStudyFeedback(question, _session.answers[question.id]);
    } else {
      Components.renderExplanation(expBox, expText, question, false);
      if (expBox) expBox.style.display = 'none';

      const nextBtn = document.getElementById('quiz-next-btn');
      if (nextBtn && _session.studyMode) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = 'Next <svg class="icon icon-sm"><use href="#icon-next"/></svg>';
      }
    }

    Components.updateQuizHeader(
      _session.shiftMeta,
      idx,
      _session.questions.length
    );

    Components.updateNavButtons(idx, _session.questions.length, _session.mode);
    Components.updateQuizActionButtons(question.id);

    if (_session.paletteOpen) {
      _refreshPalette();
    }

    // ✅ MathJax: direct call (original working version)
    if (question.subject === 'Mathematics') {
      const container = document.getElementById('question-area');
      Components.typesetQuestion(question, container);
    }

    const area = document.getElementById('question-area');
    if (area) area.scrollTop = 0;
  }

  /* ─────────────────────────────────────────────────────────────
     ANSWER SELECTION — fixed toggle and study branch
  ───────────────────────────────────────────────────────────── */

  function _selectAnswer(optionIndex) {
    const question = _session.questions[_session.currentIndex];
    if (!question) return;

    if (_session.studyMode && _session.answers[question.id] !== null) return;

    const oldAnswer = _session.answers[question.id];

    if (!_session.studyMode) {
      // Quiz mode: toggle off if same option
      if (_session.mode === 'quiz' && oldAnswer === optionIndex) {
        _session.answers[question.id] = null;
      } else {
        _session.answers[question.id] = optionIndex;
      }

      const optionsEl = document.getElementById('options-list');
      if (optionsEl) {
        Components.renderOptions(
          optionsEl,
          question,
          _session.answers[question.id],
          false,
          null,
          null,
          (idx) => _selectAnswer(idx)
        );
      }

      // Re‑typeset Math after options re‑render
      if (question.subject === 'Mathematics') {
        const container = document.getElementById('question-area');
        Components.typesetQuestion(question, container);
      }

      if (_session.mode === 'exam' && _session.answers[question.id] !== null) {
        setTimeout(() => {
          if (_session.currentIndex < _session.questions.length - 1) {
            _navigateTo(_session.currentIndex + 1);
          }
        }, 400);
      }

      _updateSinglePaletteBtn(_session.currentIndex);
      return;
    }

    // Study mode: set answer and show feedback
    _session.answers[question.id] = optionIndex;
    _showStudyFeedback(question, optionIndex);
    _updateSinglePaletteBtn(_session.currentIndex);
  }

  /* ─────────────────────────────────────────────────────────────
     STUDY MODE FEEDBACK
  ───────────────────────────────────────────────────────────── */

  function _showStudyFeedback(question, selectedIndex) {
    const optionsEl = document.getElementById('options-list');
    if (optionsEl) {
      Components.renderOptions(
        optionsEl,
        question,
        selectedIndex,
        true,
        question.correctAnswer,
        selectedIndex,
        null
      );
    }

    // Re‑typeset Math after options re‑render
    if (question.subject === 'Mathematics') {
      const container = document.getElementById('question-area');
      Components.typesetQuestion(question, container);
    }

    const expBox = document.getElementById('explanation-box');
    const expText = document.getElementById('explanation-text');
    Components.renderExplanation(expBox, expText, question, true);
    if (expBox) expBox.style.display = 'block';

    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) {
      nextBtn.disabled = false;
      if (_session.currentIndex === _session.questions.length - 1) {
        nextBtn.innerHTML = 'Done <svg class="icon icon-sm"><use href="#icon-check"/></svg>';
      } else {
        nextBtn.innerHTML = 'Next <svg class="icon icon-sm"><use href="#icon-next"/></svg>';
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────────────────────────── */

  function _navigateTo(index) {
    if (index < 0 || index >= _session.questions.length) return;
    if (_session.mode === 'exam' && index < _session.currentIndex) return;

    _session.currentIndex = index;
    _renderCurrentQuestion();
  }

  function _goNext() {
    const idx   = _session.currentIndex;
    const total = _session.questions.length;

    if (_session.studyMode) {
      if (idx < total - 1) {
        _navigateTo(idx + 1);
      } else {
        Components.showToast('Practice session completed! 🎉', 'success', 3000);
        App.navigateTo('practice');
      }
      return;
    }

    if (idx === total - 1) {
      confirmSubmit();
    } else {
      _navigateTo(idx + 1);
    }
  }

  function _goPrev() {
    if (_session.mode === 'exam') return;
    _navigateTo(_session.currentIndex - 1);
  }

  function _goSkip() {
    if (_session.mode === 'exam') return;
    _navigateTo(_session.currentIndex + 1);
  }

  /* ─────────────────────────────────────────────────────────────
     BOOKMARK & FLAG — working, with explicit binding
  ───────────────────────────────────────────────────────────── */

  function _toggleBookmark() {
    const question = _session.questions[_session.currentIndex];
    if (!question) return;

    const isNowBookmarked = Storage.toggleBookmark(question.id);
    Components.updateQuizActionButtons(question.id);
    Components.showToast(
      isNowBookmarked ? 'Question bookmarked.' : 'Bookmark removed.',
      'info',
      1500
    );
  }

  function _toggleFlag() {
    const question = _session.questions[_session.currentIndex];
    if (!question) return;

    const isNowFlagged = Storage.toggleFlag(question.id);
    _session.flagged[question.id] = isNowFlagged;

    Components.updateQuizActionButtons(question.id);
    _updateSinglePaletteBtn(_session.currentIndex);
    Components.showToast(
      isNowFlagged ? 'Question flagged for review.' : 'Flag removed.',
      'info',
      1500
    );
  }

  /* ─────────────────────────────────────────────────────────────
     PAUSE / RESUME
  ───────────────────────────────────────────────────────────── */

  function _togglePause() {
    if (_session.mode === 'exam') return;

    _session.isPaused = !_session.isPaused;
    const pauseBtn    = document.getElementById('quiz-pause-btn');

    if (_session.isPaused) {
      _showPauseScreen();
      if (pauseBtn) {
        const use = pauseBtn.querySelector('use');
        if (use) use.setAttribute('href', '#icon-play');
        pauseBtn.setAttribute('aria-label', 'Resume quiz');
      }
    } else {
      _hidePauseScreen();
      _session.questionStartTime = Date.now();
      if (pauseBtn) {
        const use = pauseBtn.querySelector('use');
        if (use) use.setAttribute('href', '#icon-pause');
        pauseBtn.setAttribute('aria-label', 'Pause quiz');
      }
    }
  }

  function _showPauseScreen() {
    const area = document.getElementById('question-area');
    if (!area) return;

    _session._pausedContent = area.innerHTML;
    area.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
                  justify-content:center;min-height:300px;gap:var(--space-4);
                  color:var(--text-secondary);">
        <svg class="icon" style="width:56px;height:56px;color:var(--text-muted);">
          <use href="#icon-pause"/>
        </svg>
        <div style="font-size:var(--font-size-xl);font-weight:600;
                    color:var(--text-primary);">Quiz Paused</div>
        <div style="font-size:var(--font-size-sm);">
          Press resume to continue
        </div>
        <button class="btn btn-primary" id="pause-resume-btn">
          <svg class="icon"><use href="#icon-play"/></svg>
          Resume
        </button>
      </div>
    `;

    const resumeBtn = document.getElementById('pause-resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', _togglePause);
  }

  function _hidePauseScreen() {
    const area = document.getElementById('question-area');
    if (!area) return;
    _renderCurrentQuestion();
  }

  /* ─────────────────────────────────────────────────────────────
     PALETTE
  ───────────────────────────────────────────────────────────── */

  function openPalette() {
    if (_session.mode === 'exam') return;

    _session.paletteOpen = true;
    _refreshPalette();

    const panel   = document.getElementById('palette-panel');
    const overlay = document.getElementById('palette-overlay');
    if (panel)   panel.classList.add('open');
    if (overlay) overlay.classList.add('open');

    setTimeout(() => {
      const currentBtn = document.querySelector('.palette-btn.current');
      if (currentBtn) {
        currentBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 100);
  }

  function closePalette() {
    _session.paletteOpen = false;

    const panel   = document.getElementById('palette-panel');
    const overlay = document.getElementById('palette-overlay');
    if (panel)   panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  function _refreshPalette() {
    const gridEl = document.getElementById('palette-grid');
    if (!gridEl) return;

    Components.buildPaletteGrid(
      gridEl,
      _session.questions,
      _session.currentIndex,
      _session.answers,
      _session.visited,
      _session.flagged,
      (idx) => {
        closePalette();
        _navigateTo(idx);
      }
    );

    Components.updatePaletteSummary(
      _session.questions,
      _session.answers,
      _session.flagged,
      _session.visited
    );
  }

  function _updateSinglePaletteBtn(questionIndex) {
    const gridEl = document.getElementById('palette-grid');
    if (!gridEl) return;

    const btn = gridEl.children[questionIndex];
    if (!btn) return;

    const question = _session.questions[questionIndex];
    if (!question) return;

    btn.className = Components.getPaletteButtonClass(
      question.id,
      _session.currentIndex,
      questionIndex,
      _session.answers,
      _session.visited,
      _session.flagged
    );
  }

  /* ─────────────────────────────────────────────────────────────
     SUBMISSION
  ───────────────────────────────────────────────────────────── */

  function confirmSubmit() {
    _stopTimer();

    const answered  = Object.values(_session.answers).filter(a => a !== null).length;
    const unanswered = _session.questions.length - answered;

    let bodyText = `You have answered ${answered} of ${_session.questions.length} questions.`;
    if (unanswered > 0) {
      bodyText += ` ${unanswered} question${unanswered !== 1 ? 's' : ''} will be marked as skipped.`;
    }
    bodyText += '\n\nAre you sure you want to submit?';

    Components.showModal({
      title:   'Submit Quiz',
      body:    bodyText,
      actions: [
        {
          label:   'Continue Quiz',
          variant: 'secondary',
          onClick: () => {
            if (_session.timerEnabled && _session.remainingSeconds > 0) {
              _startTimer();
            }
          },
        },
        {
          label:   'Submit Now',
          variant: 'danger',
          onClick: () => _submitQuiz(),
        },
      ],
    });
  }

  function _submitQuiz() {
    _stopTimer();
    closePalette();

    _recordQuestionTime(_session.currentIndex);

    const totalTimeTaken = _session.totalSeconds - _session.remainingSeconds;

    const result = Scoring.generateResult({
      shiftId:        _session.shiftId,
      mode:           _session.mode,
      questions:      _session.questions,
      answers:        _session.answers,
      flags:          _session.flagged,
      timings:        _session.timings,
      totalTimeTaken,
      attemptDate:    _session.attemptStartTime || new Date().toISOString(),
    });

    let savedAttempt  = result;
    let allAttempts   = [result];

    if (_session.shiftId && !_session.isCustom) {
      savedAttempt = Storage.saveAttempt(_session.shiftId, result);
      allAttempts  = Storage.getShiftAttempts(_session.shiftId);
      Storage.clearInProgressAttempt(_session.shiftId);
    }

    if (_session.isCustom) {
      Storage.clearCustomQuizSession();
    }

    App.onQuizComplete(_session.shiftId, savedAttempt, allAttempts);
  }

  /* ─────────────────────────────────────────────────────────────
     PROGRESS SAVING
  ───────────────────────────────────────────────────────────── */

  function _saveProgress() {
    if (!_session.shiftId || _session.isCustom || _session.mode === 'exam') return;

    const progress = {
      shiftId:          _session.shiftId,
      mode:             _session.mode,
      questions:        _session.questions,
      currentIndex:     _session.currentIndex,
      answers:          { ..._session.answers },
      visited:          { ..._session.visited },
      flagged:          { ..._session.flagged },
      timings:          { ..._session.timings },
      timerEnabled:     _session.timerEnabled,
      totalSeconds:     _session.totalSeconds,
      remainingSeconds: _session.remainingSeconds,
      attemptStartTime: _session.attemptStartTime,
      savedAt:          new Date().toISOString(),
    };

    Storage.saveInProgressAttempt(_session.shiftId, progress);
  }

  /* ─────────────────────────────────────────────────────────────
     QUESTION TIME TRACKING
  ───────────────────────────────────────────────────────────── */

  function _recordQuestionTime(questionIndex) {
    const question = _session.questions[questionIndex];
    if (!question || !_session.questionStartTime) return;

    const elapsed = Math.floor((Date.now() - _session.questionStartTime) / 1000);
    _session.timings[question.id] = (_session.timings[question.id] || 0) + elapsed;
  }

  /* ─────────────────────────────────────────────────────────────
     REVIEW MODE
  ───────────────────────────────────────────────────────────── */

  function _renderReviewQuestion(index) {
    const questions = _session.questions;
    if (!questions || questions.length === 0) return;

    const clampedIdx = Math.max(0, Math.min(index, questions.length - 1));
    _session.reviewCurrentIndex = clampedIdx;

    const question  = questions[clampedIdx];
    const resultMap = _session._resultMap || {};
    const qResult   = resultMap[question.id] || {
      selectedAnswer: null,
      isCorrect:      false,
      isSkipped:      true,
    };

    const settings = Storage.getSettings();

    const badgesEl = document.getElementById('review-question-badges');
    if (badgesEl) {
      Components.renderQuestionBadges(badgesEl, question, settings);
    }

    const numLabel = document.getElementById('review-question-number-label');
    if (numLabel) {
      numLabel.textContent = `Question ${clampedIdx + 1} of ${questions.length}`;
    }

    const textEl = document.getElementById('review-question-text');
    if (textEl) {
      Components.renderQuestionText(textEl, question);
    }

    const optionsEl = document.getElementById('review-options-list');
    if (optionsEl) {
      Components.renderOptions(
        optionsEl,
        question,
        null,
        true,
        question.correctAnswer,
        qResult.isSkipped ? null : qResult.selectedAnswer,
        null
      );
    }

    const expBox  = document.getElementById('review-explanation-box');
    const expText = document.getElementById('review-explanation-text');
    Components.renderExplanation(expBox, expText, question, true);

    const posLabel = document.getElementById('review-position-label');
    if (posLabel) {
      posLabel.textContent = `${clampedIdx + 1} / ${questions.length}`;
    }

    Components.updateReviewActionButtons(question.id);

    const prevBtn = document.getElementById('review-prev-btn');
    const nextBtn = document.getElementById('review-next-btn');
    if (prevBtn) prevBtn.disabled = clampedIdx === 0;
    if (nextBtn) {
      const isLast         = clampedIdx === questions.length - 1;
      nextBtn.disabled     = isLast;
      nextBtn.textContent  = '';
      nextBtn.innerHTML    = isLast
        ? 'Done'
        : `Next <svg class="icon icon-sm"><use href="#icon-next"/></svg>`;
    }

    // MathJax for review
    if (question && question.subject === 'Mathematics') {
      const container = document.getElementById('review-question-area');
      Components.typesetQuestion(question, container);
    }

    const area = document.getElementById('review-question-area');
    if (area) area.scrollTop = 0;
  }

  function _updateReviewFilter(filter) {
    const filterHeader = document.getElementById('review-filter-header');
    if (!filterHeader) return;

    filterHeader.querySelectorAll('[data-review-filter]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.reviewFilter === filter);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     EVENT BINDING — explicit and safe
  ───────────────────────────────────────────────────────────── */

  function _bindQuizControls() {
    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', _goNext);

    const prevBtn = document.getElementById('quiz-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', _goPrev);

    const skipBtn = document.getElementById('quiz-skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', _goSkip);

    // --- FIX: Bookmark button using addEventListener and cloning to remove old listeners ---
    const bmBtn = document.getElementById('quiz-bookmark-btn');
    if (bmBtn) {
      bmBtn.replaceWith(bmBtn.cloneNode(true));
      const newBmBtn = document.getElementById('quiz-bookmark-btn');
      newBmBtn.addEventListener('click', _toggleBookmark);
    }

    // Flag button
    const flagBtn = document.getElementById('quiz-flag-btn');
    if (flagBtn) {
      flagBtn.replaceWith(flagBtn.cloneNode(true));
      const newFlagBtn = document.getElementById('quiz-flag-btn');
      newFlagBtn.addEventListener('click', _toggleFlag);
    }

    // Palette
    const paletteBtn = document.getElementById('quiz-palette-btn');
    if (paletteBtn) {
      paletteBtn.addEventListener('click', () => {
        if (_session.paletteOpen) closePalette();
        else openPalette();
      });
    }

    // Pause
    const pauseBtn = document.getElementById('quiz-pause-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', _togglePause);

    // --- Additional fallback: event delegation on the bottom bar ---
    const bottomBar = document.getElementById('quiz-bottom-bar');
    if (bottomBar) {
      bottomBar.addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.id === 'quiz-bookmark-btn') {
          e.preventDefault();
          _toggleBookmark();
        } else if (target.id === 'quiz-flag-btn') {
          e.preventDefault();
          _toggleFlag();
        }
      });
    }

    _bindKeyboardShortcuts();
  }

  function _bindReviewControls() {
    const nextBtn = document.getElementById('review-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const next = _session.reviewCurrentIndex + 1;
        if (next >= _session.questions.length) {
          App.navigateTo('result');
        } else {
          _renderReviewQuestion(next);
        }
      });
    }

    const prevBtn = document.getElementById('review-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        _renderReviewQuestion(_session.reviewCurrentIndex - 1);
      });
    }

    const backBtn = document.getElementById('review-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => App.navigateTo('result'));

    const bmBtn = document.getElementById('review-bookmark-btn');
    if (bmBtn) {
      bmBtn.addEventListener('click', () => {
        const question = _session.questions[_session.reviewCurrentIndex];
        if (!question) return;
        const isNow = Storage.toggleBookmark(question.id);
        Components.updateReviewActionButtons(question.id);
        Components.showToast(isNow ? 'Bookmarked.' : 'Bookmark removed.', 'info', 1500);
      });
    }

    const flagBtn = document.getElementById('review-flag-btn');
    if (flagBtn) {
      flagBtn.addEventListener('click', () => {
        const question = _session.questions[_session.reviewCurrentIndex];
        if (!question) return;
        Storage.toggleFlag(question.id);
        Components.updateReviewActionButtons(question.id);
      });
    }

    const filterHeader = document.getElementById('review-filter-header');
    if (filterHeader) {
      filterHeader.addEventListener('click', async (e) => {
        const chip = e.target.closest('[data-review-filter]');
        if (!chip) return;

        const newFilter = chip.dataset.reviewFilter;
        _updateReviewFilter(newFilter);

        if (typeof App !== 'undefined') {
          App.navigateTo('result');
          setTimeout(() => {
            Components.showToast(
              `Use the "${_capitalise(newFilter)}" button on the result page.`,
              'info', 2500
            );
          }, 100);
        }
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     KEYBOARD SHORTCUTS
  ───────────────────────────────────────────────────────────── */

  let _keyboardBound = false;

  function _bindKeyboardShortcuts() {
    if (_keyboardBound) return;
    _keyboardBound = true;

    document.addEventListener('keydown', _handleKeydown);
  }

  function _handleKeydown(e) {
    const quizPage = document.getElementById('page-quiz');
    if (!quizPage || !quizPage.classList.contains('active')) return;
    if (_session.isPaused) return;

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        _goNext();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        if (_session.mode !== 'exam') _goPrev();
        break;

      case '1':
      case 'a':
      case 'A':
        e.preventDefault();
        _selectAnswer(0);
        break;

      case '2':
      case 'b':
      case 'B':
        e.preventDefault();
        _selectAnswer(1);
        break;

      case '3':
      case 'c':
      case 'C':
        e.preventDefault();
        _selectAnswer(2);
        break;

      case '4':
      case 'd':
      case 'D':
        e.preventDefault();
        _selectAnswer(3);
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        _toggleFlag();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        if (_session.mode === 'quiz') {
          if (_session.paletteOpen) closePalette();
          else openPalette();
        }
        break;

      case 'Escape':
        if (_session.paletteOpen) closePalette();
        break;

      default:
        break;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PRIVATE UTILITIES
  ───────────────────────────────────────────────────────────── */

  function _capitalise(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    start,
    startCustom,
    startReview,
    confirmSubmit,
    openPalette,
    closePalette,
    getSession: () => ({ ..._session }),
  };

})();