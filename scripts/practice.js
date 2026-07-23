/* ═══════════════════════════════════════════════════════════════
   PRACTICE.JS — Practice mode with multi-select filters
   VERSION: 3.0 - Full Debug Edition
═══════════════════════════════════════════════════════════════ */

const Practice = (() => {

  /* ─────────────────────────────────────────────────────────────
     DEBUG MODE - Set to false to disable console logs
  ───────────────────────────────────────────────────────────── */
  
  window.DEBUG_PRACTICE = true;

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

  function _debugLog(...args) {
    if (window.DEBUG_PRACTICE) {
      console.log(...args);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────────── */

  async function init() {
    _debugLog('🚀 Practice.init() started');

    _state.shiftsIndex = await Storage.loadShiftsIndex();
    _state.taxonomy    = await Storage.loadTaxonomy();

    _debugLog('📋 Shifts loaded:', _state.shiftsIndex.length);
    _debugLog('📚 Taxonomy loaded:', _state.taxonomy);

    const dateSet  = new Set(_state.shiftsIndex.map(s => s.date));
    _state.allDates = Array.from(dateSet).sort();

    _buildDateChips();

    if (!_state._bound) {
      _bindAllControls();
      _state._bound = true;
    }

    await _updatePreview();

    _debugLog('✅ Practice.init() completed');
  }

  /* ─────────────────────────────────────────────────────────────
     BUILD DATE CHIPS (dynamic)
  ───────────────────────────────────────────────────────────── */

  function _buildDateChips() {
    const container = document.getElementById('practice-date-chips');
    if (!container) {
      _debugLog('⚠️ practice-date-chips container not found');
      return;
    }

    container.innerHTML = '';

    const allChip = _makeChip('All', 'all', 'date', true);
    container.appendChild(allChip);

    _state.allDates.forEach(date => {
      const label = Scoring.formatDate(date);
      const chip  = _makeChip(label, date, 'date', false);
      container.appendChild(chip);
    });

    _debugLog('📅 Date chips built:', _state.allDates.length);
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
    _debugLog('🎯 Chip clicked:', { group, value, isAll, buttonText: btn.textContent });

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

    _debugLog('✅ Selected values for', group, ':', selected);

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

    _debugLog('📦 State updated for', group, ':', values);
    _debugLog('📊 Current full state:', {
      years: _state.selectedYears,
      dates: _state.selectedDates,
      shifts: _state.selectedShifts,
      subjects: _state.selectedSubjects,
      topics: _state.selectedTopics,
      subtopics: _state.selectedSubTopics,
      diffs: _state.selectedDiffs
    });
  }

  /* ─────────────────────────────────────────────────────────────
     CASCADING FILTERS
  ───────────────────────────────────────────────────────────── */

  function _onFilterChange(group) {
    _debugLog('🔄 Filter changed:', group);

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
    if (!container || !section) {
      _debugLog('⚠️ Topic section/container not found');
      return;
    }

    _debugLog('🔨 Rebuilding topic chips for subjects:', _state.selectedSubjects);

    const subjects = _state.selectedSubjects.length === 0
      ? _state.taxonomy.subjects
      : _state.taxonomy.subjects.filter(s => {
          const matches = _arrayContains(_state.selectedSubjects, s.name);
          _debugLog('  - Checking subject:', s.name, '→', matches ? '✅' : '❌');
          return matches;
        });

    _debugLog('📚 Filtered subjects:', subjects.map(s => s.name));

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
    _debugLog('📌 Topics found:', topics.map(t => t.name));

    container.innerHTML = '';

    if (topics.length === 0) {
      section.style.display = 'none';
      _debugLog('⚠️ No topics found, hiding section');
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

    _debugLog('✅ Topic chips rebuilt:', topics.length);
  }

  function _rebuildSubTopicChips() {
    const section   = document.getElementById('practice-subtopic-section');
    const container = document.getElementById('practice-subtopic-chips');
    if (!container || !section) {
      _debugLog('⚠️ SubTopic section/container not found');
      return;
    }

    _debugLog('🔨 Rebuilding subtopic chips for topics:', _state.selectedTopics);

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
    _debugLog('📝 SubTopics found:', subTopics);

    container.innerHTML = '';

    if (subTopics.length === 0) {
      section.style.display = 'none';
      _debugLog('⚠️ No subtopics found, hiding section');
      return;
    }

    section.style.display = 'block';

    const allChip = _makeChip('All', 'all', 'subtopic', true);
    container.appendChild(allChip);

    subTopics.forEach(st => {
      container.appendChild(_makeChip(st, st, 'subtopic', false));
    });

    _debugLog('✅ SubTopic chips rebuilt:', subTopics.length);
  }

  /* ─────────────────────────────────────────────────────────────
     BIND ALL CONTROLS
  ───────────────────────────────────────────────────────────── */

  function _bindAllControls() {
    _debugLog('🔗 Binding all controls...');

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
        _debugLog('🔢 Question count changed to:', _state.questionCount);
        _updatePreview();
      });
    }

    const shuffleToggle = document.getElementById('practice-shuffle');
    if (shuffleToggle) {
      shuffleToggle.addEventListener('change', () => {
        _state.shuffle = shuffleToggle.checked;
        _debugLog('🔀 Shuffle:', _state.shuffle);
      });
    }

    const timerToggle = document.getElementById('practice-timer-on');
    const timerRow    = document.getElementById('practice-timer-row');
    if (timerToggle) {
      timerToggle.addEventListener('change', () => {
        _state.timerEnabled      = timerToggle.checked;
        if (timerRow) timerRow.style.display = timerToggle.checked ? 'flex' : 'none';
        _debugLog('⏱️ Timer enabled:', _state.timerEnabled);
      });
    }

    const timerMinsEl = document.getElementById('practice-timer-mins');
    if (timerMinsEl) {
      timerMinsEl.addEventListener('change', () => {
        _state.timerMins = parseInt(timerMinsEl.value, 10) || 30;
        _debugLog('⏱️ Timer minutes:', _state.timerMins);
      });
    }

    const bmToggle    = document.getElementById('practice-only-bookmarked');
    const flagToggle  = document.getElementById('practice-only-flagged');
    const wrongToggle = document.getElementById('practice-only-wrong');

    if (bmToggle) {
      bmToggle.addEventListener('change', () => {
        _state.onlyBookmarked = bmToggle.checked;
        _debugLog('🔖 Only bookmarked:', _state.onlyBookmarked);
        _updatePreview();
      });
    }
    if (flagToggle) {
      flagToggle.addEventListener('change', () => {
        _state.onlyFlagged = flagToggle.checked;
        _debugLog('🚩 Only flagged:', _state.onlyFlagged);
        _updatePreview();
      });
    }
    if (wrongToggle) {
      wrongToggle.addEventListener('change', () => {
        _state.onlyWrong = wrongToggle.checked;
        _debugLog('❌ Only wrong:', _state.onlyWrong);
        _updatePreview();
      });
    }

    const startBtn = document.getElementById('practice-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', _startPractice);
    }

    _debugLog('✅ All controls bound');
  }

  function _bindChipGroup(containerId, group) {
    const container = document.getElementById(containerId);
    if (!container) {
      _debugLog('⚠️ Container not found:', containerId);
      return;
    }

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      
      const value = chip.dataset.value || chip.textContent.trim();
      const isAll = value === 'all';
      
      _handleChipClick(chip, group, value, isAll);
    });

    _debugLog('✅ Bound chip group:', containerId);
  }

  /* ─────────────────────────────────────────────────────────────
     PREVIEW COUNT
  ───────────────────────────────────────────────────────────── */

  let _previewDebounce = null;

  async function _updatePreview() {
    clearTimeout(_previewDebounce);
    _previewDebounce = setTimeout(async () => {
      _debugLog('🔄 Updating preview...');
      
      await _computeMatchingQuestions();

      const total   = _state.matchingQuestions.length;
      const count   = _state.questionCount === 9999
        ? total
        : Math.min(total, _state.questionCount);

      const countEl  = document.getElementById('practice-preview-count');
      const startBtn = document.getElementById('practice-start-btn');

      if (countEl)  countEl.textContent = count;
      if (startBtn) startBtn.disabled   = count === 0;

      _debugLog('✅ Preview updated:', count, 'questions');
    }, 300);
  }

  async function _computeMatchingQuestions() {
    _debugLog('═══════════════════════════════════════');
    _debugLog('🔍 COMPUTING MATCHING QUESTIONS');
    _debugLog('═══════════════════════════════════════');

    const allShiftIds  = _state.shiftsIndex.map(s => s.id);
    _debugLog('📋 Total shifts in index:', allShiftIds.length);
    _debugLog('📋 Shift IDs:', allShiftIds);

    const shiftDataMap = await Storage.loadMultipleShifts(allShiftIds);
    _debugLog('📥 Shifts loaded from storage:', Object.keys(shiftDataMap).length);

    let allQuestions = [];
    Object.values(shiftDataMap).forEach(data => {
      if (data && data.questions) {
        allQuestions = allQuestions.concat(data.questions);
      }
    });

    _debugLog('📚 Total questions loaded:', allQuestions.length);

    if (allQuestions.length > 0) {
      const sampleQ = allQuestions[0];
      _debugLog('📌 Sample question:', {
        id: sampleQ.id,
        subject: sampleQ.subject,
        topic: sampleQ.topic,
        subTopic: sampleQ.subTopic,
        difficulty: sampleQ.difficulty
      });

      // Show unique values in loaded questions
      const uniqueSubjects = [...new Set(allQuestions.map(q => q.subject))];
      const uniqueTopics = [...new Set(allQuestions.map(q => q.topic))];
      const uniqueDiffs = [...new Set(allQuestions.map(q => q.difficulty))];
      
      _debugLog('📊 Unique subjects in questions:', uniqueSubjects);
      _debugLog('📊 Unique topics in questions:', uniqueTopics.slice(0, 10), '...');
      _debugLog('📊 Unique difficulties in questions:', uniqueDiffs);
    }

    _debugLog('───────────────────────────────────────');
    _debugLog('🎯 ACTIVE FILTERS:');
    _debugLog('  Years:', _state.selectedYears);
    _debugLog('  Dates:', _state.selectedDates);
    _debugLog('  Shifts:', _state.selectedShifts);
    _debugLog('  Subjects:', _state.selectedSubjects);
    _debugLog('  Topics:', _state.selectedTopics);
    _debugLog('  SubTopics:', _state.selectedSubTopics);
    _debugLog('  Difficulties:', _state.selectedDiffs);
    _debugLog('  Only Bookmarked:', _state.onlyBookmarked);
    _debugLog('  Only Flagged:', _state.onlyFlagged);
    _debugLog('  Only Wrong:', _state.onlyWrong);
    _debugLog('───────────────────────────────────────');

    const bookmarkedIds = Storage.getBookmarks();
    const flaggedMap    = Storage.getFlags();
    const wrongIds      = Storage.getAllWrongQuestionIds(_state.shiftsIndex);

    let debugCounts = {
      total: allQuestions.length,
      afterYearDateShift: 0,
      afterSubject: 0,
      afterTopic: 0,
      afterSubTopic: 0,
      afterDifficulty: 0,
      afterBookmarkFlag: 0
    };

    let firstSubjectMismatch = true;
    let firstTopicMismatch = true;
    let firstDiffMismatch = true;

    _state.matchingQuestions = allQuestions.filter(q => {
      
      // Year/Date/Shift filter
      if (_state.selectedYears.length > 0 || _state.selectedDates.length > 0 || _state.selectedShifts.length > 0) {
        const matchingShifts = _getMatchingShiftIds();
        const questionShiftId = q.id ? q.id.split('_Q')[0] : null;
        if (questionShiftId && !matchingShifts.includes(questionShiftId)) {
          return false;
        }
      }
      debugCounts.afterYearDateShift++;

      // Subject filter
      if (_state.selectedSubjects.length > 0) {
        const matched = _arrayContains(_state.selectedSubjects, q.subject);
        
        if (!matched && firstSubjectMismatch) {
          _debugLog('❌ SUBJECT MISMATCH (first occurrence):');
          _debugLog('   Question subject:', `"${q.subject}"`);
          _debugLog('   Normalized:', `"${_normalize(q.subject)}"`);
          _debugLog('   Selected subjects:', _state.selectedSubjects);
          _debugLog('   Normalized selected:', _state.selectedSubjects.map(s => _normalize(s)));
          firstSubjectMismatch = false;
        }
        
        if (!matched) {
          return false;
        }
      }
      debugCounts.afterSubject++;

      // Topic filter
      if (_state.selectedTopics.length > 0) {
        const matched = _arrayContains(_state.selectedTopics, q.topic);
        
        if (!matched && firstTopicMismatch) {
          _debugLog('❌ TOPIC MISMATCH (first occurrence):');
          _debugLog('   Question topic:', `"${q.topic}"`);
          _debugLog('   Normalized:', `"${_normalize(q.topic)}"`);
          _debugLog('   Selected topics:', _state.selectedTopics);
          firstTopicMismatch = false;
        }
        
        if (!matched) {
          return false;
        }
      }
      debugCounts.afterTopic++;

      // SubTopic filter
      if (_state.selectedSubTopics.length > 0) {
        if (!_arrayContains(_state.selectedSubTopics, q.subTopic)) {
          return false;
        }
      }
      debugCounts.afterSubTopic++;

      // Difficulty filter
      if (_state.selectedDiffs.length > 0) {
        const matched = _arrayContains(_state.selectedDiffs, q.difficulty);
        
        if (!matched && firstDiffMismatch) {
          _debugLog('❌ DIFFICULTY MISMATCH (first occurrence):');
          _debugLog('   Question difficulty:', `"${q.difficulty}"`);
          _debugLog('   Normalized:', `"${_normalize(q.difficulty)}"`);
          _debugLog('   Selected difficulties:', _state.selectedDiffs);
          firstDiffMismatch = false;
        }
        
        if (!matched) {
          return false;
        }
      }
      debugCounts.afterDifficulty++;

      // Bookmarked/Flagged/Wrong filter
      if (_state.onlyBookmarked || _state.onlyFlagged || _state.onlyWrong) {
        const bm = _state.onlyBookmarked && bookmarkedIds.includes(q.id);
        const fl = _state.onlyFlagged    && !!flaggedMap[q.id];
        const wr = _state.onlyWrong      && wrongIds.includes(q.id);
        if (!bm && !fl && !wr) return false;
      }
      debugCounts.afterBookmarkFlag++;

      return true;
    });

    _debugLog('───────────────────────────────────────');
    _debugLog('📊 FILTER FUNNEL:');
    _debugLog('   Total loaded:', debugCounts.total);
    _debugLog('   After Year/Date/Shift:', debugCounts.afterYearDateShift);
    _debugLog('   After Subject:', debugCounts.afterSubject);
    _debugLog('   After Topic:', debugCounts.afterTopic);
    _debugLog('   After SubTopic:', debugCounts.afterSubTopic);
    _debugLog('   After Difficulty:', debugCounts.afterDifficulty);
    _debugLog('   After Bookmark/Flag/Wrong:', debugCounts.afterBookmarkFlag);
    _debugLog('───────────────────────────────────────');
    _debugLog('✅ FINAL MATCHING QUESTIONS:', _state.matchingQuestions.length);
    _debugLog('═══════════════════════════════════════');
  }

  function _getMatchingShiftIds() {
    const matching = _state.shiftsIndex
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

    _debugLog('🎯 Matching shift IDs:', matching);
    return matching;
  }

  /* ─────────────────────────────────────────────────────────────
     START PRACTICE
  ───────────────────────────────────────────────────────────── */

  async function _startPractice() {
    _debugLog('🚀 Starting practice session...');

    await _computeMatchingQuestions();

    let questions = [..._state.matchingQuestions];

    if (questions.length === 0) {
      _debugLog('⚠️ No questions match filters');
      Components.showToast('No questions match your filters.', 'warning');
      return;
    }

    if (_state.shuffle) {
      Scoring.shuffle(questions);
      _debugLog('🔀 Questions shuffled');
    }

    if (_state.questionCount !== 9999) {
      questions = questions.slice(0, _state.questionCount);
      _debugLog('✂️ Limited to', _state.questionCount, 'questions');
    }

    if (questions.length === 0) {
      _debugLog('⚠️ No questions after limit');
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

    _debugLog('✅ Starting quiz with config:', practiceConfig);

    App.navigateTo('pre-quiz', { customConfig: practiceConfig });
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return { 
    init,
    // Expose for debugging
    getState: () => _state,
    debugInfo: () => {
      console.log('Current State:', _state);
      console.log('Matching Questions:', _state.matchingQuestions.length);
    }
  };

})();