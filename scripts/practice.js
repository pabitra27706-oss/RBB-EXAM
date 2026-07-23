/* ═══════════════════════════════════════════════════════════════
   PRACTICE.JS — Practice mode with multi-select filters (FIXED)
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

    // OPTIONAL: Uncomment to debug taxonomy vs questions
    // await _debugTaxonomyMismatches();
  }

  /* ─────────────────────────────────────────────────────────────
     DEBUG UTILITY — Check taxonomy vs actual question data
  ───────────────────────────────────────────────────────────── */

  async function _debugTaxonomyMismatches() {
    const shiftIds     = _state.shiftsIndex.map(s => s.id);
    const shiftDataMap = await Storage.loadMultipleShifts(shiftIds);

    let allQuestions = [];
    Object.values(shiftDataMap).forEach(data => {
      if (data && data.questions) {
        allQuestions = allQuestions.concat(data.questions);
      }
    });

    // Get all unique values from question files
    const qSubjects  = [...new Set(allQuestions.map(q => q.subject))].sort();
    const qTopics    = [...new Set(allQuestions.map(q => q.topic))].sort();
    const qSubTopics = [...new Set(allQuestions.map(q => q.subTopic))].sort();

    // Get all unique values from taxonomy
    const tSubjects  = _state.taxonomy.subjects.map(s => s.name).sort();
    const tTopics    = _state.taxonomy.subjects
      .flatMap(s => s.topics.map(t => t.name)).sort();
    const tSubTopics = _state.taxonomy.subjects
      .flatMap(s => s.topics.flatMap(t => t.subTopics)).sort();

    console.group('🔍 TAXONOMY vs QUESTIONS MISMATCH REPORT');

    // Check subjects
    console.group('📚 SUBJECTS');
    qSubjects.forEach(s => {
      const match = _arrayContains(tSubjects, s);
      console.log(match ? '✅' : '❌', `"${s}"`);
    });
    console.groupEnd();

    // Check topics
    console.group('📌 TOPICS');
    qTopics.forEach(t => {
      const match = _arrayContains(tTopics, t);
      console.log(match ? '✅' : '❌', `"${t}"`);
    });
    console.groupEnd();

    // Check subtopics
    console.group('📝 SUBTOPICS');
    qSubTopics.forEach(st => {
      const match = _arrayContains(tSubTopics, st);
      console.log(match ? '✅' : '❌', `"${st}"`);
    });
    console.groupEnd();

    console.groupEnd();
  }

  /* ─────────────────────────────────────────────────────────────
     AUTO-GENERATE TAXONOMY (Run once to rebuild taxonomy.json)
  ───────────────────────────────────────────────────────────── */

  async function generateTaxonomyFromQuestions() {
    const shiftsIndex  = await Storage.loadShiftsIndex();
    const shiftIds     = shiftsIndex.map(s => s.id);
    const shiftDataMap = await Storage.loadMultipleShifts(shiftIds);

    let allQuestions = [];
    Object.values(shiftDataMap).forEach(data => {
      if (data && data.questions) {
        allQuestions = allQuestions.concat(data.questions);
      }
    });

    // Build taxonomy structure
    const taxonomyMap = {};

    allQuestions.forEach(q => {
      const subject  = (q.subject  || '').trim();
      const topic    = (q.topic    || '').trim();
      const subTopic = (q.subTopic || '').trim();

      if (!subject) return;

      if (!taxonomyMap[subject]) {
        taxonomyMap[subject] = {};
      }

      if (!taxonomyMap[subject][topic]) {
        taxonomyMap[subject][topic] = new Set();
      }

      if (subTopic) {
        taxonomyMap[subject][topic].add(subTopic);
      }
    });

    // Define subject order
    const subjectOrder = [
      'General Awareness',
      'Mathematics',
      'General Intelligence and Reasoning'
    ];

    // Define question counts per subject
    const questionCounts = {
      'General Awareness':                  40,
      'Mathematics':                        30,
      'General Intelligence and Reasoning': 30
    };

    const taxonomy = {
      subjects: subjectOrder
        .filter(subjectName => taxonomyMap[subjectName])
        .map(subjectName => {
          const topicsMap = taxonomyMap[subjectName];

          const topics = Object.keys(topicsMap)
            .sort()
            .map(topicName => ({
              name:      topicName,
              subTopics: Array.from(topicsMap[topicName]).sort()
            }));

          return {
            name:          subjectName,
            questionCount: questionCounts[subjectName] || 0,
            topics
          };
        })
    };

    const json = JSON.stringify(taxonomy, null, 2);
    
    console.log('═══════════════════════════════════════════');
    console.log('📋 GENERATED TAXONOMY.JSON');
    console.log('═══════════════════════════════════════════');
    console.log(json);
    console.log('═══════════════════════════════════════════');
    console.log('Copy the above JSON and save it as taxonomy.json');

    return taxonomy;
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

    const topicsMap = new Map();
    subjects.forEach(s => {
      s.topics.forEach(t => {
        if (!topicsMap.has(_normalize(t.name))) {
          topicsMap.set(_normalize(t.name), t);
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

    // ✅ FIX: Use case-insensitive, trimmed matching
    _state.matchingQuestions = allQuestions.filter(q => {
      
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
  return { 
    init,
    generateTaxonomyFromQuestions,  // ← Export for manual use
    debugMismatches: _debugTaxonomyMismatches  // ← Export for debugging
  };

})();