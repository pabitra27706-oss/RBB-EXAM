/* ═══════════════════════════════════════════════════════════════
   PRACTICE.JS — Practice mode with multi-select filters (FIXED v2)
═══════════════════════════════════════════════════════════════ */

const Practice = (() => {

  /* ─────────────────────────────────────────────────────────────
     STATE
  ───────────────────────────────────────────────────────────── */

  const _state = {
    selectedYears:     [],
    selectedDates:     [],
    selectedShifts:    [],
    selectedSubjects:  [],
    selectedTopics:    [],
    selectedSubTopics: [],
    selectedDiffs:     [],

    onlyBookmarked: false,
    onlyFlagged:    false,
    onlyWrong:      false,

    questionCount:  25,
    shuffle:        true,
    timerEnabled:   false,
    timerMins:      30,

    matchingQuestions: [],
    shiftsIndex: [],
    taxonomy:    { subjects: [] },
    allDates:    [],
    _bound: false,
  };

  /* ─────────────────────────────────────────────────────────────
     HELPERS — String comparison utilities
  ───────────────────────────────────────────────────────────── */

  function _normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  function _matches(value1, value2) {
    return _normalize(value1) === _normalize(value2);
  }

  function _arrayContains(array, value) {
    const normalizedValue = _normalize(value);
    return array.some(item => _normalize(item) === normalizedValue);
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  async function init() {
    _state.shiftsIndex = await Storage.loadShiftsIndex();
    _state.taxonomy    = await Storage.loadTaxonomy();

    const dateSet  = new Set(_state.shiftsIndex.map(s => s.date));
    _state.allDates = Array.from(dateSet).sort();

    _buildDateChips();

    if (!_state._bound) {
      _bindAllControls();
      _state._bound = true;
    }

    await _updatePreview();

    // OPTIONAL: Uncomment to debug
    // console.log('Taxonomy loaded:', _state.taxonomy);
  }

  /* ─────────────────────────────────────────────────────────────
     BUILD DATE CHIPS (dynamic)
  ───────────────────────────────────────────────────────────── */

  function _buildDateChips() {
    const container = document.getElementById('practice-date-chips');
    if (!container) return;

    container.innerHTML = '';

    const allChip = _makeChip('All', 'all', 'date', true);
    container.appendChild(allChip);

    _state.allDates.forEach(date => {
      const label = Scoring.formatDate(date);
      const chip  = _makeChip(label, date, 'date', false);
      container.appendChild(chip);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CHIP FACTORY
  ───────────────────────────────────────────────────────────── */

  function _makeChip(label, value, group, isAll) {
    const btn         = document.createElement('button');
    btn.className     = 'filter-chip' + (isAll ? ' active' : '');
    btn.dataset.value = value;
    btn.dataset.group = group;
    btn.textContent   = label;

    btn.addEventListener('click', () =>
      _handleChipClick(btn, group, value, isAll)
    );
    return btn;
  }

  function _handleChipClick(btn, group, value, isAll) {
    const container = btn.parentElement;
    const allChip   = container.querySelector('[data-value="all"]');

    if (isAll || value === 'all') {
      container.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('active', 'multi-selected');
      });
      btn.classList.add('active');
      _setStateArray(group, []);
      _onFilterChange(group);
      return;
    }

    if (allChip) allChip.classList.remove('active', 'multi-selected');

    btn.classList.toggle('multi-selected');
    btn.classList.toggle('active', btn.classList.contains('multi-selected'));

    const anySelected = Array.from(
      container.querySelectorAll('.filter-chip:not([data-value="all"])')
    ).some(c => c.classList.contains('multi-selected'));

    if (!anySelected && allChip) allChip.classList.add('active');

    const selected = Array.from(
      container.querySelectorAll('.filter-chip.multi-selected')
    ).map(c => c.dataset.value);

    _setStateArray(group, selected);
    _onFilterChange(group);
  }

  function _setStateArray(group, values) {
    switch (group) {
      case 'year':     _state.selectedYears     = values; break;
      case 'date':     _state.selectedDates     = values; break;
      case 'shift':    _state.selectedShifts    = values; break;
      case 'subject':  _state.selectedSubjects  = values; break;
      case 'topic':    _state.selectedTopics    = values; break;
      case 'subtopic': _state.selectedSubTopics = values; break;
      case 'diff':     _state.selectedDiffs     = values; break;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     CASCADING FILTERS
  ───────────────────────────────────────────────────────────── */

  function _onFilterChange(group) {
    if (group === 'subject') {
      _rebuildTopicChips();
      _state.selectedTopics    = [];
      _state.selectedSubTopics = [];
    }
    if (group === 'topic') {
      _rebuildSubTopicChips();
      _state.selectedSubTopics = [];
    }
    _updatePreview();
  }

  function _rebuildTopicChips() {
    const section   = document.getElementById('practice-topic-section');
    const container = document.getElementById('practice-topic-chips');
    if (!container || !section) return;

    // ✅ FIX: Use case-insensitive matching
    const subjects = _state.selectedSubjects.length === 0
      ? _state.taxonomy.subjects
      : _state.taxonomy.subjects.filter(s =>
          _arrayContains(_state.selectedSubjects, s.name)
        );

    // Deduplicate topics by normalized name
    const topicsMap = new Map();
    subjects.forEach(s => {
      s.topics.forEach(t => {
        const normalized = _normalize(t.name);
        if (!topicsMap.has(normalized)) {
          topicsMap.set(normalized, t);
        }
      });
    });

    const topics = Array.from(topicsMap.values());

    container.innerHTML = '';

    if (topics.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    const allChip = _makeChip('All', 'all', 'topic', true);
    container.appendChild(allChip);

    topics.forEach(t => {
      container.appendChild(_makeChip(t.name, t.name, 'topic', false));
    });

    const subSection = document.getElementById('practice-subtopic-section');
    if (subSection) subSection.style.display = 'none';
  }

  function _rebuildSubTopicChips() {
    const section   = document.getElementById('practice-subtopic-section');
    const container = document.getElementById('practice-subtopic-chips');
    if (!container || !section) return;

    // ✅ FIX: Use case-insensitive matching
    const subjects = _state.selectedSubjects.length === 0
      ? _state.taxonomy.subjects
      : _state.taxonomy.subjects.filter(s =>
          _arrayContains(_state.selectedSubjects, s.name)
        );

    const subTopicsSet = new Set();
    subjects.forEach(s => {
      s.topics.forEach(t => {
        if (_state.selectedTopics.length === 0 ||
            _arrayContains(_state.selectedTopics, t.name)) {
          t.subTopics.forEach(st => {
            subTopicsSet.add(st);
          });
        }
      });
    });

    const subTopics = Array.from(subTopicsSet).sort();

    container.innerHTML = '';

    if (subTopics.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    const allChip = _makeChip('All', 'all', 'subtopic', true);
    container.appendChild(allChip);

    subTopics.forEach(st => {
      container.appendChild(_makeChip(st, st, 'subtopic', false));
    });
  }

  /* ─────────────────────────────────────────────────────────────
     BIND ALL CONTROLS
  ───────────────────────────────────────────────────────────── */

  function _bindAllControls() {
    _bindChipGroup('practice-year-chips',    'year');
    _bindChipGroup('practice-shift-chips',   'shift');
    _bindChipGroup('practice-subject-chips', 'subject');
    _bindChipGroup('practice-diff-chips',    'diff');

    const countContainer = document.getElementById('practice-count-chips');
    if (countContainer) {
      countContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        countContainer.querySelectorAll('.filter-chip').forEach(c =>
          c.classList.remove('active', 'multi-selected')
        );
        chip.classList.add('active');
        const val             = chip.dataset.count;
        _state.questionCount  = val === 'all' ? 9999 : parseInt(val, 10);
        _updatePreview();
      });
    }

    const shuffleToggle = document.getElementById('practice-shuffle');
    if (shuffleToggle) {
      shuffleToggle.addEventListener('change', () => {
        _state.shuffle = shuffleToggle.checked;
      });
    }

    const timerToggle = document.getElementById('practice-timer-on');
    const timerRow    = document.getElementById('practice-timer-row');
    if (timerToggle) {
      timerToggle.addEventListener('change', () => {
        _state.timerEnabled      = timerToggle.checked;
        if (timerRow) timerRow.style.display = timerToggle.checked ? 'flex' : 'none';
      });
    }

    const timerMinsEl = document.getElementById('practice-timer-mins');
    if (timerMinsEl) {
      timerMinsEl.addEventListener('change', () => {
        _state.timerMins = parseInt(timerMinsEl.value, 10) || 30;
      });
    }

    const bmToggle    = document.getElementById('practice-only-bookmarked');
    const flagToggle  = document.getElementById('practice-only-flagged');
    const wrongToggle = document.getElementById('practice-only-wrong');

    if (bmToggle) {
      bmToggle.addEventListener('change', () => {
        _state.onlyBookmarked = bmToggle.checked;
        _updatePreview();
      });
    }
    if (flagToggle) {
      flagToggle.addEventListener('change', () => {
        _state.onlyFlagged = flagToggle.checked;
        _updatePreview();
      });
    }
    if (wrongToggle) {
      wrongToggle.addEventListener('change', () => {
        _state.onlyWrong = wrongToggle.checked;
        _updatePreview();
      });
    }

    const startBtn = document.getElementById('practice-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', _startPractice);
    }
  }

  function _bindChipGroup(containerId, group) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      const value = chip.dataset.value || chip.textContent.trim();
      const isAll = value === 'all';
      _handleChipClick(chip, group, value, isAll);
    });
  }

  /* ─────────────────────────────────────────────────────────────
     PREVIEW COUNT
  ───────────────────────────────────────────────────────────── */

  let _previewDebounce = null;

  async function _updatePreview() {
    clearTimeout(_previewDebounce);
    _previewDebounce = setTimeout(async () => {
      await _computeMatchingQuestions();

      const total   = _state.matchingQuestions.length;
      const count   = _state.questionCount === 9999
        ? total
        : Math.min(total, _state.questionCount);

      const countEl  = document.getElementById('practice-preview-count');
      const startBtn = document.getElementById('practice-start-btn');

      if (countEl)  countEl.textContent = count;
      if (startBtn) startBtn.disabled   = count === 0;

      // ✅ DEBUG: Log filter results
      console.log('🔍 Filter Debug:', {
        selectedSubjects: _state.selectedSubjects,
        selectedTopics: _state.selectedTopics,
        selectedSubTopics: _state.selectedSubTopics,
        matchingQuestions: total
      });
    }, 300);
  }

  async function _computeMatchingQuestions() {
    // ✅ FIX: Load ALL shifts, don't filter by year/date/shift yet
    // We need to check questions from all shifts first
    const allShiftIds  = _state.shiftsIndex.map(s => s.id);
    const shiftDataMap = await Storage.loadMultipleShifts(allShiftIds);

    let allQuestions = [];
    Object.values(shiftDataMap).forEach(data => {
      if (data && data.questions) {
        allQuestions = allQuestions.concat(data.questions);
      }
    });

    const bookmarkedIds = Storage.getBookmarks();
    const flaggedMap    = Storage.getFlags();
    const wrongIds      = Storage.getAllWrongQuestionIds(_state.shiftsIndex);

    // ✅ FIX: Filter questions with proper case-insensitive matching
    _state.matchingQuestions = allQuestions.filter(q => {
      
      // Year/Date/Shift filter (filter by question's shiftId)
      if (_state.selectedYears.length > 0 || _state.selectedDates.length > 0 || _state.selectedShifts.length > 0) {
        const matchingShifts = _getMatchingShiftIds();
        const questionShiftId = q.id ? q.id.split('_Q')[0] : null;
        if (questionShiftId && !matchingShifts.includes(questionShiftId)) {
          return false;
        }
      }

      // Subject filter
      if (_state.selectedSubjects.length > 0) {
        if (!_arrayContains(_state.selectedSubjects, q.subject)) {
          return false;
        }
      }

      // Topic filter
      if (_state.selectedTopics.length > 0) {
        if (!_arrayContains(_state.selectedTopics, q.topic)) {
          return false;
        }
      }

      // SubTopic filter
      if (_state.selectedSubTopics.length > 0) {
        if (!_arrayContains(_state.selectedSubTopics, q.subTopic)) {
          return false;
        }
      }

      // Difficulty filter
      if (_state.selectedDiffs.length > 0) {
        if (!_arrayContains(_state.selectedDiffs, q.difficulty)) {
          return false;
        }
      }

      // Bookmarked/Flagged/Wrong filter
      if (_state.onlyBookmarked || _state.onlyFlagged || _state.onlyWrong) {
        const bm = _state.onlyBookmarked && bookmarkedIds.includes(q.id);
        const fl = _state.onlyFlagged    && !!flaggedMap[q.id];
        const wr = _state.onlyWrong      && wrongIds.includes(q.id);
        if (!bm && !fl && !wr) return false;
      }

      return true;
    });
  }

  function _getMatchingShiftIds() {
    return _state.shiftsIndex
      .filter(s => {
        if (_state.selectedYears.length > 0) {
          const year = s.date.split('-')[0];
          if (!_state.selectedYears.includes(year)) return false;
        }
        if (_state.selectedDates.length > 0 &&
            !_state.selectedDates.includes(s.date)) return false;
        if (_state.selectedShifts.length > 0 &&
            !_state.selectedShifts.includes(String(s.shift))) return false;
        return true;
      })
      .map(s => s.id);
  }

  /* ─────────────────────────────────────────────────────────────
     START PRACTICE
  ───────────────────────────────────────────────────────────── */

  async function _startPractice() {
    await _computeMatchingQuestions();

    let questions = [..._state.matchingQuestions];

    if (questions.length === 0) {
      Components.showToast('No questions match your filters.', 'warning');
      return;
    }

    if (_state.shuffle) Scoring.shuffle(questions);

    if (_state.questionCount !== 9999) {
      questions = questions.slice(0, _state.questionCount);
    }

    if (questions.length === 0) {
      Components.showToast('No questions available.', 'warning');
      return;
    }

    const practiceConfig = {
      source:        'practice',
      isCustom:      true,
      studyMode:     true,
      questions,
      questionCount: questions.length,
      timerEnabled:  _state.timerEnabled,
      timerMins:     _state.timerMins,
      shuffle:       false,
      subjects:      [..._state.selectedSubjects],
    };

    App.navigateTo('pre-quiz', { customConfig: practiceConfig });
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return { init };

})();