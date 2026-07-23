/* ═══════════════════════════════════════════════════════════════
   PRACTICE.JS — Practice mode with multi-select filters
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

    const subjects = _state.selectedSubjects.length === 0
      ? _state.taxonomy.subjects
      : _state.taxonomy.subjects.filter(s =>
          _state.selectedSubjects.includes(s.name)
        );

    const topics = [];
    subjects.forEach(s => {
      s.topics.forEach(t => {
        if (!topics.find(x => x.name === t.name)) topics.push(t);
      });
    });

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

    const subjects = _state.selectedSubjects.length === 0
      ? _state.taxonomy.subjects
      : _state.taxonomy.subjects.filter(s =>
          _state.selectedSubjects.includes(s.name)
        );

    const subTopics = [];
    subjects.forEach(s => {
      s.topics.forEach(t => {
        if (_state.selectedTopics.length === 0 ||
            _state.selectedTopics.includes(t.name)) {
          t.subTopics.forEach(st => {
            if (!subTopics.includes(st)) subTopics.push(st);
          });
        }
      });
    });

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
      const value = chip.dataset.value ||
                    chip.dataset[group] ||
                    chip.textContent.trim();
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
    }, 300);
  }

  async function _computeMatchingQuestions() {
    const shiftIds     = _getMatchingShiftIds();
    const shiftDataMap = await Storage.loadMultipleShifts(shiftIds);

    let allQuestions = [];
    Object.values(shiftDataMap).forEach(data => {
      if (data && data.questions) {
        allQuestions = allQuestions.concat(data.questions);
      }
    });

    const bookmarkedIds = Storage.getBookmarks();
    const flaggedMap    = Storage.getFlags();
    const wrongIds      = Storage.getAllWrongQuestionIds(_state.shiftsIndex);

    _state.matchingQuestions = allQuestions.filter(q => {
      if (_state.selectedSubjects.length > 0 &&
          !_state.selectedSubjects.includes(q.subject)) return false;
      if (_state.selectedTopics.length > 0 &&
          !_state.selectedTopics.includes(q.topic)) return false;
      if (_state.selectedSubTopics.length > 0 &&
          !_state.selectedSubTopics.includes(q.subTopic)) return false;
      if (_state.selectedDiffs.length > 0 &&
          !_state.selectedDiffs.includes(q.difficulty)) return false;

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
      studyMode:     true,   // <── ADDED
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