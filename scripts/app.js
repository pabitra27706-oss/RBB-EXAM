/* ═══════════════════════════════════════════════════════════════
   APP.JS — Routing, page switching, and initialization
═══════════════════════════════════════════════════════════════ */

const App = (() => {

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */

  const state = {
    currentPage:   'home',
    previousPage:  null,
    pageParams:    {},
    shiftsIndex:   [],
    taxonomy:      { subjects: [] },
    isInitialized: false,
  };

  /* ─────────────────────────────────────────────────────────────
     PAGE CONFIG
  ───────────────────────────────────────────────────────────── */

  const PAGE_CONFIG = {
    'home': {
      title:        'Railway PYQ',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   true,
      showSettings: true,
    },
    'browse': {
      title:        'Browse Shifts',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   true,
      showSettings: false,
    },
    'practice': {
      title:        'Practice',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'analytics': {
      title:        'Analytics',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'bookmarks': {
      title:        'Bookmarks',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'history': {
      title:        'History',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'shift-detail': {
      title:        'Shift Details',
      showNav:      false,
      showHeader:   true,
      showBack:     true,
      showSearch:   false,
      showSettings: false,
    },
    'pre-quiz': {
      title:        'Start Quiz',
      showNav:      false,
      showHeader:   true,
      showBack:     true,
      showSearch:   false,
      showSettings: false,
    },
    'quiz': {
      title:        '',
      showNav:      false,
      showHeader:   false,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'result': {
      title:        'Result',
      showNav:      false,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'review': {
      title:        'Review',
      showNav:      false,
      showHeader:   false,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'custom-quiz': {
      title:        'Custom Quiz',
      showNav:      true,
      showHeader:   true,
      showBack:     false,
      showSearch:   false,
      showSettings: false,
    },
    'settings': {
      title:        'Settings',
      showNav:      false,
      showHeader:   true,
      showBack:     true,
      showSearch:   false,
      showSettings: false,
    },
  };

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  async function init() {
    try {
      await _loadSVGSprite();
      _applySettings();

      state.shiftsIndex = await Storage.loadShiftsIndex();
      state.taxonomy    = await Storage.loadTaxonomy();

      await Analytics.init();

      _bindNavigation();
      _bindHeader();
      _bindHomePage();
      _bindBrowsePage();
      _bindSettingsPage();
      _bindCustomQuizBuilder();
      _bindPalette();
      _bindModal();

      await _renderHomePage();

      state.isInitialized = true;
      console.log('[App] Initialized.');
    } catch (err) {
      console.error('[App] Init failed:', err);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SVG SPRITE
  ───────────────────────────────────────────────────────────── */

  async function _loadSVGSprite() {
    try {
      const res  = await fetch('assets/icons.svg');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const container = document.getElementById('svg-sprite-container');
      if (container) container.innerHTML = text;
    } catch (e) {
      console.error('[App] SVG sprite load failed:', e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SETTINGS
  ───────────────────────────────────────────────────────────── */

  function _applySettings() {
    const settings = Storage.getSettings();
    const html     = document.documentElement;

    html.setAttribute('data-theme',    settings.theme);
    html.setAttribute('data-fontsize', settings.fontSize);

    const darkToggle = document.getElementById('settings-dark-mode');
    if (darkToggle) darkToggle.checked = settings.theme === 'dark';

    const timerToggle = document.getElementById('settings-timer-default');
    if (timerToggle) timerToggle.checked = settings.timerEnabled;

    const defaultTimeInput = document.getElementById('settings-default-time');
    if (defaultTimeInput) defaultTimeInput.value = settings.defaultTime;

    const showBadgesToggle = document.getElementById('settings-show-badges');
    if (showBadgesToggle) showBadgesToggle.checked = settings.showBadges;

    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === settings.fontSize);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     ROUTING
  ───────────────────────────────────────────────────────────── */

  async function navigateTo(pageId, params = {}) {
    if (!PAGE_CONFIG[pageId]) {
      console.warn(`[App] Unknown page: "${pageId}"`);
      return;
    }

    state.previousPage = state.currentPage;
    state.currentPage  = pageId;
    state.pageParams   = params;

    document.querySelectorAll('.page').forEach(el =>
      el.classList.remove('active')
    );

    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.add('active');

    _updateChrome(pageId);
    window.scrollTo({ top: 0, behavior: 'instant' });
    await _setupPage(pageId, params);
  }

  function goBack() {
    if (state.previousPage) {
      navigateTo(state.previousPage, {});
    } else {
      navigateTo('home');
    }
  }

  /* ─────────────────────────────────────────────────────────────
     CHROME (header + nav)
  ───────────────────────────────────────────────────────────── */

  function _updateChrome(pageId) {
    const config = PAGE_CONFIG[pageId];
    if (!config) return;

    const titleEl     = document.getElementById('header-title');
    const appHeader   = document.getElementById('app-header');
    const backBtn     = document.getElementById('header-back-btn');
    const searchBtn   = document.getElementById('header-search-btn');
    const settingsBtn = document.getElementById('header-settings-btn');
    const bottomNav   = document.getElementById('bottom-nav');

    if (titleEl)     titleEl.textContent          = config.title;
    if (appHeader)   appHeader.style.display       = config.showHeader   ? '' : 'none';
    if (backBtn)     backBtn.style.display         = config.showBack     ? '' : 'none';
    if (searchBtn)   searchBtn.style.display       = config.showSearch   ? '' : 'none';
    if (settingsBtn) settingsBtn.style.display     = config.showSettings ? '' : 'none';
    if (bottomNav)   bottomNav.style.display       = config.showNav      ? '' : 'none';

    // Nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === pageId);
    });

    // Parent nav highlight for sub-pages
    const parentMap = {
      'shift-detail': 'browse',
      'pre-quiz':     'browse',
      'settings':     'home',
    };

    if (parentMap[pageId]) {
      const parentNav = document.querySelector(
        `.nav-item[data-nav="${parentMap[pageId]}"]`
      );
      if (parentNav) parentNav.classList.add('active');
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PAGE SETUP
  ───────────────────────────────────────────────────────────── */

  async function _setupPage(pageId, params) {
    switch (pageId) {
      case 'home':
        await _renderHomePage();
        break;
      case 'browse':
        await _renderBrowsePage();
        break;
      case 'practice':
        await Practice.init();
        break;
      case 'analytics':
        await Analytics.renderAll();
        break;
      case 'bookmarks':
        await _renderBookmarksPage();
        break;
      case 'history':
        _renderHistoryPage();
        break;
      case 'shift-detail':
        if (params.shiftId) await _renderShiftDetailPage(params.shiftId);
        break;
      case 'pre-quiz':
        _renderPreQuizPage(params);
        break;
      case 'settings':
        _applySettings();
        break;
      case 'quiz':
      case 'result':
      case 'review':
      case 'custom-quiz':
        break;
      default:
        break;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     HOME PAGE
  ───────────────────────────────────────────────────────────── */

  async function _renderHomePage() {
    Storage.recalculateOverallStats(state.shiftsIndex);

    const stats   = Analytics.getDashboardStats();
    Components.updateHomeStats(stats);

    const greetEl = document.getElementById('home-greeting');
    if (greetEl) {
      const hour    = new Date().getHours();
      let greeting  = 'Good evening';
      if (hour < 12)      greeting = 'Good morning';
      else if (hour < 17) greeting = 'Good afternoon';
      greetEl.textContent = greeting;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BROWSE PAGE
  ───────────────────────────────────────────────────────────── */

  async function _renderBrowsePage(filter = 'all', searchQuery = '') {
    const container = document.getElementById('browse-shifts-container');
    if (!container) return;

    container.innerHTML = Components.SkeletonList(4);

    const grouped = {};

    state.shiftsIndex.forEach(shiftMeta => {
      const status = Storage.getShiftStatus(shiftMeta.id);

      if (filter !== 'all' && status !== filter) return;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!shiftMeta.date.toLowerCase().includes(q) &&
            !shiftMeta.id.toLowerCase().includes(q)) return;
      }

      if (!grouped[shiftMeta.date]) grouped[shiftMeta.date] = [];
      grouped[shiftMeta.date].push({ shiftMeta, status });
    });

    container.innerHTML = '';

    if (Object.keys(grouped).length === 0) {
      container.appendChild(
        Components.EmptyState(
          'No shifts found',
          filter !== 'all'
            ? `No shifts with status "${filter}".`
            : 'No shifts match your search.',
          'browse'
        )
      );
      return;
    }

    Object.keys(grouped).sort().forEach(date => {
      const group     = document.createElement('div');
      group.className = 'date-group';
      group.appendChild(Components.DateGroupHeader(date));

      const grid      = document.createElement('div');
      grid.className  = 'shifts-grid';

      grouped[date].forEach(({ shiftMeta, status }) => {
        const bestAttempt  = Storage.getBestAttempt(shiftMeta.id);
        const attemptCount = Storage.getAttemptCount(shiftMeta.id);
        const card         = Components.ShiftCard(
          shiftMeta, status, bestAttempt, attemptCount
        );
        card.addEventListener('click', () => {
          navigateTo('shift-detail', { shiftId: shiftMeta.id });
        });
        grid.appendChild(card);
      });

      group.appendChild(grid);
      container.appendChild(group);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SHIFT DETAIL
  ───────────────────────────────────────────────────────────── */

  async function _renderShiftDetailPage(shiftId) {
    const shiftMeta = state.shiftsIndex.find(s => s.id === shiftId);
    if (!shiftMeta) {
      Components.showToast('Shift not found.', 'error');
      navigateTo('browse');
      return;
    }

    const status   = Storage.getShiftStatus(shiftId);
    const attempts = Storage.getShiftAttempts(shiftId);

    const titleEl = document.getElementById('header-title');
    if (titleEl) {
      titleEl.textContent =
        `${Scoring.formatDate(shiftMeta.date)} — Shift ${shiftMeta.shift}`;
    }

    Components.renderShiftDetailHeader(shiftMeta, status);
    Components.renderAttemptHistory(attempts, (attempt) => {
      _showAttemptResult(shiftId, attempt, attempts);
    });

    const reviewBtn = document.getElementById('detail-review-btn');
    if (reviewBtn) reviewBtn.style.display = attempts.length > 0 ? '' : 'none';

    const btn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    btn('detail-start-quiz-btn', () =>
      navigateTo('pre-quiz', { shiftId, mode: 'quiz' })
    );
    btn('detail-start-exam-btn', () =>
      navigateTo('pre-quiz', { shiftId, mode: 'exam' })
    );
    btn('detail-bookmarks-btn', () =>
      navigateTo('bookmarks', { filterShift: shiftId })
    );

    if (attempts.length > 0) {
      btn('detail-review-btn', () => {
        _startReview(shiftId, attempts[attempts.length - 1], 'all');
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     PRE-QUIZ
  ───────────────────────────────────────────────────────────── */

  function _renderPreQuizPage(params) {
    const { shiftId, mode, customConfig } = params;

    const titleEl    = document.getElementById('pre-quiz-title');
    const metaEl     = document.getElementById('pre-quiz-meta');
    const qcountEl   = document.getElementById('pre-quiz-qcount');
    const splitEl    = document.getElementById('pre-quiz-subject-split');
    const durationEl = document.getElementById('pre-quiz-duration');
    const modeDesc   = document.getElementById('pre-quiz-mode-desc');
    const startBtn   = document.getElementById('pre-quiz-start-btn');

    if (customConfig) {
      if (titleEl)    titleEl.textContent  = customConfig.source === 'practice'
                                              ? 'Practice Mode'
                                              : 'Custom Quiz';
      if (metaEl)     metaEl.textContent   = 'Based on your selected filters';
      if (qcountEl)   qcountEl.innerHTML   =
        `<strong>${customConfig.questionCount} Questions</strong>`;
      if (splitEl)    splitEl.textContent  = customConfig.subjects.length > 0
        ? customConfig.subjects.join(' · ')
        : 'All Subjects';
      if (durationEl) durationEl.innerHTML = customConfig.timerEnabled
        ? `<strong>${customConfig.timerMins} Minutes</strong>`
        : '<strong>No Timer</strong>';
      if (modeDesc)   modeDesc.textContent =
        'Free navigation — bookmark and flag questions.';
    } else {
      const shiftMeta = state.shiftsIndex.find(s => s.id === shiftId);
      const modeLabel = mode === 'exam' ? 'Exam Mode' : 'Quiz Mode';

      if (titleEl)    titleEl.textContent  = modeLabel;
      if (metaEl)     metaEl.textContent   = shiftMeta
        ? `${Scoring.formatDate(shiftMeta.date)} — Shift ${shiftMeta.shift}`
        : '';
      if (qcountEl)   qcountEl.innerHTML   = '<strong>100 Questions</strong>';
      if (splitEl)    splitEl.textContent  =
        'GA: 40  ·  Math: 30  ·  Reasoning: 30';
      if (durationEl) durationEl.innerHTML = '<strong>90 Minutes</strong>';
      if (modeDesc)   modeDesc.textContent = mode === 'exam'
        ? 'Exam mode — forward only, no palette, no pause.'
        : 'Quiz mode — free navigation, pause, palette, bookmark and flag.';
    }

    if (startBtn) {
      startBtn.onclick = async () => {
        if (customConfig) {
          await Quiz.startCustom(customConfig);
        } else {
          await Quiz.start(shiftId, mode);
        }
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────
     RESULT
  ───────────────────────────────────────────────────────────── */

  function _showAttemptResult(shiftId, attempt, allAttempts) {
    const previous   = allAttempts.filter(
      a => a.attemptNumber < attempt.attemptNumber
    );
    const comparison = Scoring.compareWithBest(attempt, previous);

    Components.renderScoreCard(attempt);
    Components.renderComparisonBanner(comparison);
    Components.renderSubjectTable(attempt.subjectWise || {});
    Analytics.renderResultDifficultyChart(attempt.difficultyWise || {});
    _bindResultPageButtons(shiftId, attempt);

    navigateTo('result');
  }

  function _bindResultPageButtons(shiftId, attempt) {
    const btn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    btn('result-review-all-btn', () =>
      _startReview(shiftId, attempt, 'all')
    );
    btn('result-review-wrong-btn', () =>
      _startReview(shiftId, attempt, 'wrong')
    );
    btn('result-review-flagged-btn', () =>
      _startReview(shiftId, attempt, 'flagged')
    );
    btn('result-review-bookmarked-btn', () =>
      _startReview(shiftId, attempt, 'bookmarked')
    );
    btn('result-retake-btn', () =>
      navigateTo('pre-quiz', { shiftId, mode: attempt.mode || 'quiz' })
    );
    btn('result-back-browse-btn', () => navigateTo('browse'));
  }

  /* ─────────────────────────────────────────────────────────────
     REVIEW
  ───────────────────────────────────────────────────────────── */

  async function _startReview(shiftId, attempt, filter) {
    const shiftData = await Storage.loadShiftData(shiftId);
    if (!shiftData) {
      Components.showToast('Could not load shift data.', 'error');
      return;
    }

    const filtered = Scoring.filterQuestionsForReview(
      shiftData.questions,
      attempt.questionWiseResult,
      filter,
      Storage.getBookmarks(),
      Storage.getFlags()
    );

    if (filtered.length === 0) {
      Components.showToast(
        `No questions match filter "${filter}".`, 'warning'
      );
      return;
    }

    Quiz.startReview(filtered, attempt.questionWiseResult, filter);
    navigateTo('review');
  }

  /* ─────────────────────────────────────────────────────────────
     BOOKMARKS
  ───────────────────────────────────────────────────────────── */

  async function _renderBookmarksPage(subjectFilter = 'all', diffFilter = 'all') {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;

    container.innerHTML = Components.SkeletonList(3);

    const bookmarkIds = Storage.getBookmarks();

    if (bookmarkIds.length === 0) {
      container.innerHTML = '';
      container.appendChild(
        Components.EmptyState(
          'No bookmarks yet',
          'Bookmark questions during a quiz to save them here.',
          'bookmark'
        )
      );
      return;
    }

    const allQuestions = await _loadQuestionsForIds(bookmarkIds);

    let filtered = allQuestions;

    if (subjectFilter !== 'all') {
      const subjectMap = {
        ga:        'General Awareness',
        math:      'Mathematics',
        reasoning: 'General Intelligence and Reasoning',
      };
      filtered = filtered.filter(
        q => q.subject === subjectMap[subjectFilter]
      );
    }

    if (diffFilter !== 'all') {
      filtered = filtered.filter(q => q.difficulty === diffFilter);
    }

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.appendChild(
        Components.EmptyState('No matching bookmarks',
          'Try changing the filter.', 'filter')
      );
      return;
    }

    filtered.forEach(question => {
      if (!question) return;
      const item = Components.BookmarkItem(
        question,
        Storage.isFlagged(question.id),
        () => {
          Storage.removeBookmark(question.id);
          Components.showToast('Bookmark removed.', 'info');
        },
        () => Storage.toggleFlag(question.id)
      );
      container.appendChild(item);
    });

    const quizBmBtn = document.getElementById('bookmarks-quiz-btn');
    if (quizBmBtn) {
      quizBmBtn.onclick = () => {
        if (filtered.length === 0) {
          Components.showToast('No questions to quiz.', 'warning');
          return;
        }
        navigateTo('pre-quiz', {
          customConfig: {
            questions:     filtered,
            questionCount: filtered.length,
            timerEnabled:  Storage.getSetting('timerEnabled'),
            timerMins:     Storage.getSetting('defaultTime'),
            shuffle:       true,
            subjects:      [],
            source:        'bookmarks',
            isCustom:      true,
          },
        });
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────
     HISTORY
  ───────────────────────────────────────────────────────────── */

  function _renderHistoryPage(modeFilter = 'all') {
    const container = document.getElementById('history-list');
    if (!container) return;

    const allAttempts = Storage.getAllAttempts(state.shiftsIndex);
    const filtered    = modeFilter === 'all'
      ? allAttempts
      : allAttempts.filter(item => item.attempt.mode === modeFilter);

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.appendChild(
        Components.EmptyState(
          'No attempts yet',
          'Complete a quiz or exam to see it here.',
          'history'
        )
      );
      return;
    }

    [...filtered].reverse().forEach(item => {
      const el = Components.HistoryItem(item, () => {
        const allShiftAttempts = Storage.getShiftAttempts(item.shiftId);
        _showAttemptResult(item.shiftId, item.attempt, allShiftAttempts);
      });
      container.appendChild(el);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     LOAD QUESTIONS BY IDs
  ───────────────────────────────────────────────────────────── */

  async function _loadQuestionsForIds(questionIds) {
    if (!questionIds || questionIds.length === 0) return [];

    const shiftIdSet = new Set();
    questionIds.forEach(qId => {
      const parts   = qId.split('_');
      const shiftId = parts.slice(0, -1).join('_');
      shiftIdSet.add(shiftId);
    });

    const shiftDataMap = await Storage.loadMultipleShifts(
      Array.from(shiftIdSet)
    );

    const questionMap = {};
    Object.values(shiftDataMap).forEach(shiftData => {
      if (shiftData && shiftData.questions) {
        shiftData.questions.forEach(q => { questionMap[q.id] = q; });
      }
    });

    return questionIds.map(id => questionMap[id] || null).filter(Boolean);
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: NAVIGATION
  ───────────────────────────────────────────────────────────── */

  function _bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.nav;
        if (page) navigateTo(page);
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: HEADER
  ───────────────────────────────────────────────────────────── */

  function _bindHeader() {
    const backBtn = document.getElementById('header-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (state.currentPage === 'shift-detail') {
          navigateTo('browse');
        } else if (state.currentPage === 'pre-quiz') {
          if (state.pageParams.customConfig &&
              state.pageParams.customConfig.source === 'practice') {
            navigateTo('practice');
          } else if (state.pageParams.shiftId) {
            navigateTo('shift-detail',
              { shiftId: state.pageParams.shiftId });
          } else {
            navigateTo('custom-quiz');
          }
        } else if (state.currentPage === 'settings') {
          navigateTo('home');
        } else {
          goBack();
        }
      });
    }

    const settingsBtn = document.getElementById('header-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => navigateTo('settings'));
    }

    const searchBtn = document.getElementById('header-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (state.currentPage === 'browse') {
          document.getElementById('browse-search')?.focus();
        } else {
          navigateTo('browse');
          setTimeout(() =>
            document.getElementById('browse-search')?.focus(), 100
          );
        }
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: HOME
  ───────────────────────────────────────────────────────────── */

  function _bindHomePage() {
    const qa_browse   = document.getElementById('qa-browse');
    const qa_continue = document.getElementById('qa-continue');
    const qa_practice = document.getElementById('qa-practice');
    const viewAllBtn  = document.getElementById('home-view-all-btn');

    if (qa_browse)   qa_browse.addEventListener('click',   () => navigateTo('browse'));
    if (qa_practice) qa_practice.addEventListener('click', () => navigateTo('practice'));
    if (viewAllBtn)  viewAllBtn.addEventListener('click',  () => navigateTo('history'));

    if (qa_continue) {
      qa_continue.addEventListener('click', async () => {
        let targetShiftId = null;

        for (const shiftMeta of state.shiftsIndex) {
          if (Storage.getShiftStatus(shiftMeta.id) ===
              Storage.SHIFT_STATUS.IN_PROGRESS) {
            targetShiftId = shiftMeta.id;
            break;
          }
        }

        if (!targetShiftId) {
          const allAttempts = Storage.getAllAttempts(state.shiftsIndex);
          if (allAttempts.length > 0) {
            targetShiftId = allAttempts[allAttempts.length - 1].shiftId;
          }
        }

        navigateTo(targetShiftId ? 'shift-detail' : 'browse',
          targetShiftId ? { shiftId: targetShiftId } : {}
        );
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: BROWSE
  ───────────────────────────────────────────────────────────── */

  function _bindBrowsePage() {
    const filterBar = document.getElementById('browse-filter-bar');
    if (filterBar) {
      filterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        filterBar.querySelectorAll('.filter-chip').forEach(c =>
          c.classList.remove('active')
        );
        chip.classList.add('active');
        const searchQuery =
          document.getElementById('browse-search')?.value || '';
        _renderBrowsePage(chip.dataset.filter, searchQuery);
      });
    }

    const searchInput = document.getElementById('browse-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const activeFilter =
            filterBar?.querySelector('.filter-chip.active')?.dataset.filter
            || 'all';
          _renderBrowsePage(activeFilter, searchInput.value);
        }, 250);
      });
    }

    _bindBookmarkFilters();
    _bindHistoryFilters();
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: BOOKMARK FILTERS
  ───────────────────────────────────────────────────────────── */

  function _bindBookmarkFilters() {
    const subjectBar = document.getElementById('bookmarks-filter-bar');
    const diffBar    = document.getElementById('bookmarks-diff-bar');
    let currentSubject = 'all';
    let currentDiff    = 'all';

    if (subjectBar) {
      subjectBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        subjectBar.querySelectorAll('.filter-chip').forEach(c =>
          c.classList.remove('active')
        );
        chip.classList.add('active');
        currentSubject = chip.dataset.bmFilter;
        _renderBookmarksPage(currentSubject, currentDiff);
      });
    }

    if (diffBar) {
      diffBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        diffBar.querySelectorAll('.filter-chip').forEach(c =>
          c.classList.remove('active')
        );
        chip.classList.add('active');
        currentDiff = chip.dataset.bmDiff;
        _renderBookmarksPage(currentSubject, currentDiff);
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: HISTORY FILTERS
  ───────────────────────────────────────────────────────────── */

  function _bindHistoryFilters() {
    const historyPage = document.getElementById('page-history');
    if (!historyPage) return;

    historyPage.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-history-filter]');
      if (!chip) return;
      historyPage.querySelectorAll('[data-history-filter]').forEach(c =>
        c.classList.remove('active')
      );
      chip.classList.add('active');
      _renderHistoryPage(chip.dataset.historyFilter);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: SETTINGS
  ───────────────────────────────────────────────────────────── */

  function _bindSettingsPage() {
    const darkToggle = document.getElementById('settings-dark-mode');
    if (darkToggle) {
      darkToggle.addEventListener('change', () => {
        const theme = darkToggle.checked ? 'dark' : 'light';
        Storage.saveSettings({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      });
    }

    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        Storage.saveSettings({ fontSize: size });
        document.documentElement.setAttribute('data-fontsize', size);
        document.querySelectorAll('.font-size-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.size === size)
        );
      });
    });

    const timerToggle = document.getElementById('settings-timer-default');
    if (timerToggle) {
      timerToggle.addEventListener('change', () =>
        Storage.saveSettings({ timerEnabled: timerToggle.checked })
      );
    }

    const defaultTimeInput = document.getElementById('settings-default-time');
    if (defaultTimeInput) {
      defaultTimeInput.addEventListener('change', () => {
        const val = parseInt(defaultTimeInput.value, 10);
        if (val >= 10 && val <= 300) Storage.saveSettings({ defaultTime: val });
      });
    }

    const showBadgesToggle = document.getElementById('settings-show-badges');
    if (showBadgesToggle) {
      showBadgesToggle.addEventListener('change', () =>
        Storage.saveSettings({ showBadges: showBadgesToggle.checked })
      );
    }

    const exportBtn = document.getElementById('settings-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.downloadExport(state.shiftsIndex);
        Components.showToast('Progress exported.', 'success');
      });
    }

    const resetShiftBtn = document.getElementById('settings-reset-shift-btn');
    if (resetShiftBtn) {
      resetShiftBtn.addEventListener('click', _showResetShiftModal);
    }

    const resetAllBtn = document.getElementById('settings-reset-all-btn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        Components.showModal({
          title: 'Reset All Progress',
          body:  'This will permanently delete all attempts, bookmarks, flags, and statistics. Cannot be undone.',
          actions: [
            { label: 'Cancel',           variant: 'secondary', onClick: () => {} },
            {
              label: 'Reset Everything', variant: 'danger',
              onClick: () => {
                Storage.resetAllData();
                _applySettings();
                _renderHomePage();
                Components.showToast('All progress reset.', 'info');
              },
            },
          ],
        });
      });
    }
  }

  function _showResetShiftModal() {
    const attempted = state.shiftsIndex.filter(
      s => Storage.getShiftStatus(s.id) !== Storage.SHIFT_STATUS.NOT_STARTED
    );

    if (attempted.length === 0) {
      Components.showToast('No attempted shifts to reset.', 'info');
      return;
    }

    Components.showModal({
      title: 'Reset Specific Shift',
      body:  'Select a shift to clear its attempts and progress:',
      actions: [
        { label: 'Cancel', variant: 'secondary', onClick: () => {} },
      ],
    });

    setTimeout(() => {
      const bodyEl = document.getElementById('modal-body');
      if (!bodyEl) return;

      const select         = document.createElement('select');
      select.style.cssText = 'width:100%;margin-top:12px;';
      select.innerHTML     = attempted.map(s =>
        `<option value="${s.id}">
           ${Scoring.formatDate(s.date)} — Shift ${s.shift}
         </option>`
      ).join('');
      bodyEl.appendChild(select);

      const actionsEl = document.getElementById('modal-actions');
      if (!actionsEl) return;

      const confirmBtn       = document.createElement('button');
      confirmBtn.className   = 'btn btn-warning btn-block';
      confirmBtn.textContent = 'Reset This Shift';
      confirmBtn.addEventListener('click', async () => {
        const shiftId   = select.value;
        const shiftData = await Storage.loadShiftData(shiftId);
        Storage.resetShift(shiftId, shiftData ? shiftData.questions : []);
        Components.hideModal();
        Components.showToast('Shift reset.', 'success');
        _renderHomePage();
      });
      actionsEl.appendChild(confirmBtn);
    }, 50);
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: PALETTE
  ───────────────────────────────────────────────────────────── */

  function _bindPalette() {
    const overlay  = document.getElementById('palette-overlay');
    const closeBtn = document.getElementById('palette-close-btn');
    const submitBtn= document.getElementById('palette-submit-btn');

    if (overlay)   overlay.addEventListener('click',   () => Quiz.closePalette());
    if (closeBtn)  closeBtn.addEventListener('click',  () => Quiz.closePalette());
    if (submitBtn) submitBtn.addEventListener('click', () => {
      Quiz.closePalette();
      Quiz.confirmSubmit();
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: MODAL
  ───────────────────────────────────────────────────────────── */

  function _bindModal() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Components.hideModal();
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BIND: CUSTOM QUIZ BUILDER
  ───────────────────────────────────────────────────────────── */

  function _bindCustomQuizBuilder() {
    const next1 = document.getElementById('builder-next-1');
    const next2 = document.getElementById('builder-next-2');
    const next3 = document.getElementById('builder-next-3');
    const back2 = document.getElementById('builder-back-2');
    const back3 = document.getElementById('builder-back-3');
    const back4 = document.getElementById('builder-back-4');

    if (next1) next1.addEventListener('click', () => _goToBuilderStep(2));
    if (next2) next2.addEventListener('click', () => _goToBuilderStep(3));
    if (next3) next3.addEventListener('click', () => _goToBuilderStep(4));
    if (back2) back2.addEventListener('click', () => _goToBuilderStep(1));
    if (back3) back3.addEventListener('click', () => _goToBuilderStep(2));
    if (back4) back4.addEventListener('click', () => _goToBuilderStep(3));

    document.querySelectorAll('input[name="builder-source"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const val         = radio.value;
        const dateRange   = document.getElementById('builder-date-range');
        const shiftPicker = document.getElementById('builder-shift-picker');
        if (dateRange)   dateRange.style.display   = val === 'date-range' ? 'flex' : 'none';
        if (shiftPicker) shiftPicker.style.display = val === 'specific'   ? 'block': 'none';
        _updateSourceRadioIcons(val);
      });
    });

    const diffFilter = document.getElementById('builder-diff-filter');
    if (diffFilter) {
      diffFilter.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        diffFilter.querySelectorAll('.filter-chip').forEach(c =>
          c.classList.remove('active')
        );
        chip.classList.add('active');
      });
    }

    const countChips  = document.querySelectorAll('.count-chip');
    const customInput = document.getElementById('custom-count-input');
    countChips.forEach(chip => {
      chip.addEventListener('click', () => {
        countChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (customInput) {
          customInput.style.display =
            chip.dataset.count === 'custom' ? 'block' : 'none';
        }
      });
    });

    const timerOn       = document.getElementById('builder-timer-on');
    const timerDuration = document.getElementById('timer-duration-row');
    if (timerOn && timerDuration) {
      timerOn.addEventListener('change', () => {
        timerDuration.style.display = timerOn.checked ? '' : 'none';
      });
    }

    const startBtn = document.getElementById('builder-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const config = _getBuilderConfig();
        if (config) navigateTo('pre-quiz', { customConfig: config });
      });
    }
  }

  function _goToBuilderStep(stepNum) {
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`builder-step-${i}`);
      if (panel) panel.classList.toggle('active', i === stepNum);
    }

    for (let i = 1; i <= 4; i++) {
      const dot   = document.getElementById(`step-dot-${i}`);
      const label = dot?.parentElement.querySelector('.step-label');
      if (dot) {
        dot.className = 'step-dot';
        if (i < stepNum)       dot.classList.add('done');
        else if (i === stepNum) dot.classList.add('active');
      }
      if (label) {
        label.className = 'step-label';
        if (i === stepNum) label.classList.add('active');
      }
    }

    for (let i = 1; i <= 3; i++) {
      const conn = document.getElementById(`step-conn-${i}`);
      if (conn) conn.classList.toggle('done', i < stepNum);
    }

    if (stepNum === 4) _updateBuilderPreview();
  }

  function _updateSourceRadioIcons(selectedVal) {
    const iconMap = {
      'all':        'source-all-icon',
      'date-range': 'source-date-icon',
      'specific':   'source-specific-icon',
    };
    Object.entries(iconMap).forEach(([val, iconId]) => {
      const el  = document.getElementById(iconId);
      const use = el?.querySelector('use');
      if (use) {
        use.setAttribute('href',
          val === selectedVal ? '#icon-radio-filled' : '#icon-radio-empty'
        );
      }
    });
  }

  async function _updateBuilderPreview() {
    const config    = _getBuilderConfig(true);
    const countEl   = document.getElementById('builder-preview-count');
    const startBtn  = document.getElementById('builder-start-btn');
    const summaryEl = document.getElementById('builder-settings-summary');

    if (!config) return;
    if (summaryEl) summaryEl.innerHTML = Components.buildBuilderSummary(config);

    const shiftIds  = _getBuilderShiftIds(config);
    const shiftData = await Storage.loadMultipleShifts(shiftIds);

    let allQuestions = [];
    Object.values(shiftData).forEach(data => {
      if (data && data.questions)
        allQuestions = allQuestions.concat(data.questions);
    });

    const filtered = Scoring.filterQuestionsForCustomQuiz(allQuestions, {
      subjects:       config.subjects,
      difficulty:     config.difficulty,
      onlyBookmarked: config.onlyBookmarked,
      onlyFlagged:    config.onlyFlagged,
      onlyWrong:      config.onlyWrong,
      bookmarkedIds:  Storage.getBookmarks(),
      flaggedMap:     Storage.getFlags(),
      wrongIds:       Storage.getAllWrongQuestionIds(state.shiftsIndex),
    });

    const count = Math.min(filtered.length, config.questionCount);
    if (countEl)  countEl.textContent = count;
    if (startBtn) startBtn.disabled   = count === 0;

    config.questions     = filtered;
    config.questionCount = count;
    Storage.saveCustomQuizSession(config);
  }

  function _getBuilderShiftIds(config) {
    if (config.source === 'specific') return config.specificShifts;
    if (config.source === 'date-range') {
      return state.shiftsIndex
        .filter(s => s.date >= config.dateFrom && s.date <= config.dateTo)
        .map(s => s.id);
    }
    return state.shiftsIndex.map(s => s.id);
  }

  function _getBuilderConfig(dryRun = false) {
    const sourceRadio = document.querySelector(
      'input[name="builder-source"]:checked'
    );
    const source      = sourceRadio ? sourceRadio.value : 'all';
    const dateFrom    = document.getElementById('builder-date-from')?.value || '';
    const dateTo      = document.getElementById('builder-date-to')?.value   || '';
    const specificShifts = Array.from(
      document.querySelectorAll('input[name="builder-shift"]:checked')
    ).map(el => el.value);

    const subjects = Array.from(
      document.querySelectorAll('input[name="builder-subject"]:checked')
    ).map(el => el.value);

    const diffChip   = document.querySelector(
      '#builder-diff-filter .filter-chip.active'
    );
    const difficulty = diffChip ? diffChip.dataset.diff : 'all';

    const onlyBookmarked =
      document.getElementById('builder-only-bookmarked')?.checked || false;
    const onlyFlagged    =
      document.getElementById('builder-only-flagged')?.checked    || false;
    const onlyWrong      =
      document.getElementById('builder-only-wrong')?.checked      || false;

    const activeCountChip = document.querySelector('.count-chip.active');
    let questionCount     = 25;
    if (activeCountChip) {
      questionCount = activeCountChip.dataset.count === 'custom'
        ? parseInt(
            document.getElementById('builder-custom-count')?.value || '25', 10
          )
        : parseInt(activeCountChip.dataset.count, 10);
    }

    const timerEnabled =
      document.getElementById('builder-timer-on')?.checked ?? true;
    const timerMins    = parseInt(
      document.getElementById('builder-timer-mins')?.value || '90', 10
    );
    const shuffle      =
      document.getElementById('builder-shuffle')?.checked ?? true;

    return {
      source, dateFrom, dateTo, specificShifts,
      subjects, difficulty,
      onlyBookmarked, onlyFlagged, onlyWrong,
      questionCount: isNaN(questionCount) ? 25 : Math.max(1, questionCount),
      timerEnabled,
      timerMins: isNaN(timerMins) ? 90 : Math.max(1, timerMins),
      shuffle,
      isCustom: true,
    };
  }

  /* ─────────────────────────────────────────────────────────────
     QUIZ COMPLETE HOOK
  ───────────────────────────────────────────────────────────── */

  function onQuizComplete(shiftId, result, allAttempts) {
    Storage.recalculateOverallStats(state.shiftsIndex);

    const previous   = allAttempts.filter(
      a => a.attemptNumber < result.attemptNumber
    );
    const comparison = Scoring.compareWithBest(result, previous);

    Components.renderScoreCard(result);
    Components.renderComparisonBanner(comparison);
    Components.renderSubjectTable(result.subjectWise || {});
    Analytics.renderResultDifficultyChart(result.difficultyWise || {});
    _bindResultPageButtons(shiftId, result);

    navigateTo('result');
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    init,
    navigateTo,
    goBack,
    onQuizComplete,
    getState:       () => ({ ...state }),
    getShiftsIndex: () => state.shiftsIndex,
    getTaxonomy:    () => state.taxonomy,
  };

})();

/* Boot */
document.addEventListener('DOMContentLoaded', () => App.init());