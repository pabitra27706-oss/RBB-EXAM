/* ═══════════════════════════════════════════════════════════════
   STORAGE.JS — All localStorage read/write operations
   Single source of truth for data persistence
═══════════════════════════════════════════════════════════════ */

const Storage = (() => {

  /* ─────────────────────────────────────────────────────────────
     STORAGE KEYS
  ───────────────────────────────────────────────────────────── */
  const KEYS = {
    SETTINGS:      'pyq_settings',
    OVERALL_STATS: 'pyq_overall_stats',
    BOOKMARKS:     'pyq_bookmarks',
    FLAGS:         'pyq_flags',
    SHIFT_STATUS:  (id) => `pyq_shift_${id}_status`,
    SHIFT_ATTEMPTS:(id) => `pyq_shift_${id}_attempts`,
    QUESTION:      (id) => `pyq_question_${id}`,
  };

  /* ─────────────────────────────────────────────────────────────
     DEFAULT VALUES
  ───────────────────────────────────────────────────────────── */
  const DEFAULTS = {
    settings: {
      theme:        'dark',
      fontSize:     'medium',
      timerEnabled: true,
      defaultTime:  90,
      showBadges:   true,
    },
    overallStats: {
      totalShiftsAttempted:   0,
      totalQuestionsAttempted:0,
      totalCorrect:           0,
      overallAccuracy:        0,
      currentStreak:          0,
      longestStreak:          0,
      lastPracticedDate:      null,
      totalTimeSpent:         0,
    },
  };

  /* ─────────────────────────────────────────────────────────────
     LOW-LEVEL HELPERS
  ───────────────────────────────────────────────────────────── */

  /**
   * Read and JSON-parse a key. Returns fallback if missing or invalid.
   */
  function _get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Failed to parse key "${key}":`, e);
      return fallback;
    }
  }

  /**
   * JSON-stringify and write a value.
   */
  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] Failed to write key "${key}":`, e);
      return false;
    }
  }

  /**
   * Remove a key entirely.
   */
  function _remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`[Storage] Failed to remove key "${key}":`, e);
      return false;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     SETTINGS
  ───────────────────────────────────────────────────────────── */

  function getSettings() {
    const saved = _get(KEYS.SETTINGS, {});
    return { ...DEFAULTS.settings, ...saved };
  }

  function saveSettings(partial) {
    const current = getSettings();
    const updated  = { ...current, ...partial };
    _set(KEYS.SETTINGS, updated);
    return updated;
  }

  function getSetting(key) {
    return getSettings()[key];
  }

  /* ─────────────────────────────────────────────────────────────
     OVERALL STATS
  ───────────────────────────────────────────────────────────── */

  function getOverallStats() {
    const saved = _get(KEYS.OVERALL_STATS, {});
    return { ...DEFAULTS.overallStats, ...saved };
  }

  function saveOverallStats(partial) {
    const current = getOverallStats();
    const updated  = { ...current, ...partial };
    _set(KEYS.OVERALL_STATS, updated);
    return updated;
  }

  /**
   * Recalculates and persists overall stats from all shift attempts.
   * Called after every quiz submission.
   */
  function recalculateOverallStats(shiftsIndex) {
    let totalQuestionsAttempted = 0;
    let totalCorrect            = 0;
    let shiftsAttempted         = 0;
    let totalTimeSpent          = 0;
    const practiceDates         = new Set();

    shiftsIndex.forEach(shiftMeta => {
      const attempts = getShiftAttempts(shiftMeta.id);
      if (attempts.length === 0) return;

      shiftsAttempted++;

      attempts.forEach(attempt => {
        totalQuestionsAttempted += attempt.attempted || 0;
        totalCorrect            += attempt.correct   || 0;
        totalTimeSpent          += attempt.timeTaken || 0;

        if (attempt.attemptDate) {
          const dateStr = attempt.attemptDate.split('T')[0];
          practiceDates.add(dateStr);
        }
      });
    });

    const overallAccuracy = totalQuestionsAttempted > 0
      ? parseFloat(((totalCorrect / totalQuestionsAttempted) * 100).toFixed(2))
      : 0;

    // Streak calculation
    const { currentStreak, longestStreak } = _calculateStreak(
      Array.from(practiceDates).sort()
    );

    const lastPracticedDate = practiceDates.size > 0
      ? Array.from(practiceDates).sort().pop()
      : null;

    const updated = {
      totalShiftsAttempted:    shiftsAttempted,
      totalQuestionsAttempted,
      totalCorrect,
      overallAccuracy,
      currentStreak,
      longestStreak,
      lastPracticedDate,
      totalTimeSpent,
    };

    _set(KEYS.OVERALL_STATS, updated);
    return updated;
  }

  /**
   * Calculate current and longest streak from sorted date strings.
   */
  function _calculateStreak(sortedDates) {
    if (sortedDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr  = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr   = yesterday.toISOString().split('T')[0];

    // Build unique date set
    const dateSet = new Set(sortedDates);

    // Longest streak (scan all dates)
    let longestStreak = 1;
    let tempStreak    = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (diff > 1) {
        tempStreak = 1;
      }
    }

    // Current streak (going backwards from today or yesterday)
    let currentStreak = 0;
    let checkDate     = new Date(today);

    // If practiced today or yesterday, count back
    if (dateSet.has(todayStr) || dateSet.has(yestStr)) {
      if (dateSet.has(todayStr)) {
        currentStreak = 1;
        checkDate     = new Date(yesterday);
      } else {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const str = checkDate.toISOString().split('T')[0];
        if (dateSet.has(str)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    longestStreak = Math.max(longestStreak, currentStreak);
    return { currentStreak, longestStreak };
  }

  /* ─────────────────────────────────────────────────────────────
     BOOKMARKS
  ───────────────────────────────────────────────────────────── */

  function getBookmarks() {
    return _get(KEYS.BOOKMARKS, []);
  }

  function isBookmarked(questionId) {
    return getBookmarks().includes(questionId);
  }

  function addBookmark(questionId) {
    const bookmarks = getBookmarks();
    if (!bookmarks.includes(questionId)) {
      bookmarks.push(questionId);
      _set(KEYS.BOOKMARKS, bookmarks);
      _updateQuestionMeta(questionId, { isBookmarked: true });
      return true;
    }
    return false;
  }

  function removeBookmark(questionId) {
    const bookmarks = getBookmarks().filter(id => id !== questionId);
    _set(KEYS.BOOKMARKS, bookmarks);
    _updateQuestionMeta(questionId, { isBookmarked: false });
    return true;
  }

  function toggleBookmark(questionId) {
    if (isBookmarked(questionId)) {
      removeBookmark(questionId);
      return false; // now un-bookmarked
    } else {
      addBookmark(questionId);
      return true; // now bookmarked
    }
  }

  /* ─────────────────────────────────────────────────────────────
     FLAGS
  ───────────────────────────────────────────────────────────── */

  function getFlags() {
    return _get(KEYS.FLAGS, {});
  }

  function isFlagged(questionId) {
    const flags = getFlags();
    return questionId in flags;
  }

  function getFlag(questionId) {
    return getFlags()[questionId] || null;
  }

  function addFlag(questionId, note = '') {
    const flags = getFlags();
    flags[questionId] = {
      note,
      dateFlagged: new Date().toISOString().split('T')[0],
    };
    _set(KEYS.FLAGS, flags);
    _updateQuestionMeta(questionId, { isFlagged: true });
    return true;
  }

  function removeFlag(questionId) {
    const flags = getFlags();
    delete flags[questionId];
    _set(KEYS.FLAGS, flags);
    _updateQuestionMeta(questionId, { isFlagged: false });
    return true;
  }

  function toggleFlag(questionId, note = '') {
    if (isFlagged(questionId)) {
      removeFlag(questionId);
      return false; // now un-flagged
    } else {
      addFlag(questionId, note);
      return true; // now flagged
    }
  }

  function updateFlagNote(questionId, note) {
    const flags = getFlags();
    if (flags[questionId]) {
      flags[questionId].note = note;
      _set(KEYS.FLAGS, flags);
      return true;
    }
    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     SHIFT STATUS
  ───────────────────────────────────────────────────────────── */

  const SHIFT_STATUS = {
    NOT_STARTED:  'not-started',
    IN_PROGRESS:  'in-progress',
    COMPLETED:    'completed',
  };

  function getShiftStatus(shiftId) {
    return _get(KEYS.SHIFT_STATUS(shiftId), SHIFT_STATUS.NOT_STARTED);
  }

  function setShiftStatus(shiftId, status) {
    if (!Object.values(SHIFT_STATUS).includes(status)) {
      console.warn(`[Storage] Invalid shift status: "${status}"`);
      return false;
    }
    return _set(KEYS.SHIFT_STATUS(shiftId), status);
  }

  /* ─────────────────────────────────────────────────────────────
     SHIFT ATTEMPTS
  ───────────────────────────────────────────────────────────── */

  function getShiftAttempts(shiftId) {
    return _get(KEYS.SHIFT_ATTEMPTS(shiftId), []);
  }

  function getLastAttempt(shiftId) {
    const attempts = getShiftAttempts(shiftId);
    return attempts.length > 0 ? attempts[attempts.length - 1] : null;
  }

  function getBestAttempt(shiftId) {
    const attempts = getShiftAttempts(shiftId);
    if (attempts.length === 0) return null;
    return attempts.reduce((best, curr) =>
      (curr.finalScore > best.finalScore ? curr : best), attempts[0]
    );
  }

  function getAttemptCount(shiftId) {
    return getShiftAttempts(shiftId).length;
  }

  /**
   * Save a completed attempt. Updates shift status and question-level data.
   */
  function saveAttempt(shiftId, attemptData) {
    const attempts = getShiftAttempts(shiftId);

    const attempt = {
      attemptNumber: attempts.length + 1,
      ...attemptData,
    };

    attempts.push(attempt);
    _set(KEYS.SHIFT_ATTEMPTS(shiftId), attempts);

    // Update shift status to completed
    setShiftStatus(shiftId, SHIFT_STATUS.COMPLETED);

    // Update per-question metadata
    if (Array.isArray(attempt.questionWiseResult)) {
      attempt.questionWiseResult.forEach(qResult => {
        _updateQuestionMetaFromResult(qResult);
      });
    }

    return attempt;
  }

  /**
   * Save in-progress state (for resume functionality).
   * Stored as a special "draft" attempt (not in main attempts array).
   */
  function saveInProgressAttempt(shiftId, progressData) {
    _set(`pyq_shift_${shiftId}_progress`, progressData);
    setShiftStatus(shiftId, SHIFT_STATUS.IN_PROGRESS);
  }

  function getInProgressAttempt(shiftId) {
    return _get(`pyq_shift_${shiftId}_progress`, null);
  }

  function clearInProgressAttempt(shiftId) {
    _remove(`pyq_shift_${shiftId}_progress`);
  }

  /**
   * Reset all data for a specific shift.
   */
  function resetShift(shiftId, questions = []) {
    _remove(KEYS.SHIFT_STATUS(shiftId));
    _remove(KEYS.SHIFT_ATTEMPTS(shiftId));
    _remove(`pyq_shift_${shiftId}_progress`);

    // Reset per-question metadata for this shift's questions
    questions.forEach(q => {
      _remove(KEYS.QUESTION(q.id));
    });

    return true;
  }

  /* ─────────────────────────────────────────────────────────────
     PER-QUESTION METADATA
  ───────────────────────────────────────────────────────────── */

  function getQuestionMeta(questionId) {
    return _get(KEYS.QUESTION(questionId), {
      attempted:         false,
      lastAnswerCorrect: null,
      attemptsCount:     0,
      isBookmarked:      false,
      isFlagged:         false,
    });
  }

  function _updateQuestionMeta(questionId, partial) {
    const current = getQuestionMeta(questionId);
    const updated  = { ...current, ...partial };
    _set(KEYS.QUESTION(questionId), updated);
    return updated;
  }

  function _updateQuestionMetaFromResult(qResult) {
    if (!qResult || !qResult.questionId) return;

    const current = getQuestionMeta(qResult.questionId);
    _set(KEYS.QUESTION(qResult.questionId), {
      ...current,
      attempted:         true,
      lastAnswerCorrect: qResult.isCorrect,
      attemptsCount:     (current.attemptsCount || 0) + 1,
    });
  }

  /**
   * Get metadata for multiple questions at once.
   * Returns object keyed by questionId.
   */
  function getBulkQuestionMeta(questionIds) {
    const result = {};
    questionIds.forEach(id => {
      result[id] = getQuestionMeta(id);
    });
    return result;
  }

  /* ─────────────────────────────────────────────────────────────
     ANALYTICS HELPERS
  ───────────────────────────────────────────────────────────── */

  /**
   * Get all attempts across all shifts for analytics.
   * Returns flat array of { shiftId, attempt } objects.
   */
  function getAllAttempts(shiftsIndex) {
    const all = [];
    shiftsIndex.forEach(shiftMeta => {
      const attempts = getShiftAttempts(shiftMeta.id);
      attempts.forEach(attempt => {
        all.push({ shiftId: shiftMeta.id, shiftMeta, attempt });
      });
    });
    // Sort by date ascending
    all.sort((a, b) =>
      new Date(a.attempt.attemptDate) - new Date(b.attempt.attemptDate)
    );
    return all;
  }

  /**
   * Get all question IDs that were answered wrong across all attempts.
   */
  function getAllWrongQuestionIds(shiftsIndex) {
    const wrongIds = new Set();
    getAllAttempts(shiftsIndex).forEach(({ attempt }) => {
      if (Array.isArray(attempt.questionWiseResult)) {
        attempt.questionWiseResult.forEach(qr => {
          if (!qr.isSkipped && !qr.isCorrect) {
            wrongIds.add(qr.questionId);
          }
        });
      }
    });
    return Array.from(wrongIds);
  }

  /**
   * Get per-subtopic accuracy data for analytics.
   * Returns array of { subTopic, attempted, correct, accuracy }.
   */
  function getSubTopicAccuracy(shiftsIndex) {
    const subTopicMap = {};

    getAllAttempts(shiftsIndex).forEach(({ attempt }) => {
      if (!Array.isArray(attempt.questionWiseResult)) return;

      attempt.questionWiseResult.forEach(qr => {
        if (qr.isSkipped) return;

        // We need to look up the question's subTopic from meta
        // SubTopic info is stored in the question's own data file,
        // so we rely on questionId format to find it
        const meta = getQuestionMeta(qr.questionId);
        // subTopic stored in extended meta when question is first loaded
        if (meta.subTopic) {
          if (!subTopicMap[meta.subTopic]) {
            subTopicMap[meta.subTopic] = {
              subTopic:  meta.subTopic,
              attempted: 0,
              correct:   0,
            };
          }
          subTopicMap[meta.subTopic].attempted++;
          if (qr.isCorrect) subTopicMap[meta.subTopic].correct++;
        }
      });
    });

    return Object.values(subTopicMap).map(st => ({
      ...st,
      accuracy: st.attempted > 0
        ? parseFloat(((st.correct / st.attempted) * 100).toFixed(1))
        : 0,
    }));
  }

  /**
   * Store extended question metadata (subject, topic, subTopic, difficulty)
   * when a shift is first loaded. Used by analytics.
   */
  function storeQuestionTaxonomy(question) {
    const current = getQuestionMeta(question.id);
    if (!current.subTopic) {
      _set(KEYS.QUESTION(question.id), {
        ...current,
        subject:    question.subject,
        topic:      question.topic,
        subTopic:   question.subTopic,
        difficulty: question.difficulty,
      });
    }
  }

  /**
   * Get practice dates (for streak calendar) — returns sorted array of date strings.
   */
  function getPracticeDates(shiftsIndex) {
    const dateSet = new Set();
    getAllAttempts(shiftsIndex).forEach(({ attempt }) => {
      if (attempt.attemptDate) {
        dateSet.add(attempt.attemptDate.split('T')[0]);
      }
    });
    return Array.from(dateSet).sort();
  }

  /* ─────────────────────────────────────────────────────────────
     DATA EXPORT / RESET
  ───────────────────────────────────────────────────────────── */

  /**
   * Export all app data as a JSON object.
   */
  function exportAllData(shiftsIndex) {
    const data = {
      exportDate:   new Date().toISOString(),
      version:      '1.0.0',
      settings:     getSettings(),
      overallStats: getOverallStats(),
      bookmarks:    getBookmarks(),
      flags:        getFlags(),
      shifts:       {},
    };

    shiftsIndex.forEach(shiftMeta => {
      const shiftId  = shiftMeta.id;
      const attempts = getShiftAttempts(shiftId);
      const status   = getShiftStatus(shiftId);
      const progress = getInProgressAttempt(shiftId);

      if (status !== SHIFT_STATUS.NOT_STARTED || attempts.length > 0) {
        data.shifts[shiftId] = { status, attempts, progress };
      }
    });

    return data;
  }

  /**
   * Download exported data as a JSON file.
   */
  function downloadExport(shiftsIndex) {
    const data     = exportAllData(shiftsIndex);
    const json     = JSON.stringify(data, null, 2);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const filename = `railway-pyq-backup-${new Date().toISOString().split('T')[0]}.json`;

    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Reset ALL app data. Clears every pyq_ key from localStorage.
   */
  function resetAllData() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pyq_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return true;
  }

  /* ─────────────────────────────────────────────────────────────
     CUSTOM QUIZ SESSION
     Temporary storage for a running custom quiz (not tied to a shift)
  ───────────────────────────────────────────────────────────── */

  function saveCustomQuizSession(sessionData) {
    _set('pyq_custom_quiz_session', sessionData);
  }

  function getCustomQuizSession() {
    return _get('pyq_custom_quiz_session', null);
  }

  function clearCustomQuizSession() {
    _remove('pyq_custom_quiz_session');
  }

  /* ─────────────────────────────────────────────────────────────
     CACHE: LOADED SHIFT DATA
     Keeps parsed JSON in memory to avoid re-fetching during a session.
  ───────────────────────────────────────────────────────────── */

  const _shiftDataCache = {};
  const _shiftsIndexCache = { data: null };

  function cacheShiftData(shiftId, data) {
    _shiftDataCache[shiftId] = data;
  }

  function getCachedShiftData(shiftId) {
    return _shiftDataCache[shiftId] || null;
  }

  function cacheShiftsIndex(data) {
    _shiftsIndexCache.data = data;
  }

  function getCachedShiftsIndex() {
    return _shiftsIndexCache.data;
  }

  /* ─────────────────────────────────────────────────────────────
     UTILITY: STORAGE USAGE
  ───────────────────────────────────────────────────────────── */

  function getStorageUsage() {
    let total = 0;
    let pyqTotal = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || '';
      const size = (key.length + val.length) * 2; // UTF-16 bytes
      total += size;
      if (key.startsWith('pyq_')) pyqTotal += size;
    }

    return {
      totalBytes:  total,
      pyqBytes:    pyqTotal,
      totalKB:     (total / 1024).toFixed(1),
      pyqKB:       (pyqTotal / 1024).toFixed(1),
      pyqMB:       (pyqTotal / (1024 * 1024)).toFixed(2),
    };
  }

  /* ─────────────────────────────────────────────────────────────
     DATA LOADING HELPERS (Fetch wrappers)
  ───────────────────────────────────────────────────────────── */

  /**
   * Load shifts-index.json. Uses in-memory cache.
   */
  async function loadShiftsIndex() {
    if (_shiftsIndexCache.data) return _shiftsIndexCache.data;

    try {
      const res  = await fetch('data/shifts-index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _shiftsIndexCache.data = data;
      return data;
    } catch (e) {
      console.error('[Storage] Failed to load shifts-index.json:', e);
      return [];
    }
  }

  /**
   * Load taxonomy.json.
   */
  async function loadTaxonomy() {
    try {
      const res  = await fetch('data/taxonomy.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('[Storage] Failed to load taxonomy.json:', e);
      return { subjects: [] };
    }
  }

  /**
   * Load a specific shift's question data.
   * Uses in-memory cache to avoid repeated fetches.
   */
  async function loadShiftData(shiftId) {
    if (_shiftDataCache[shiftId]) return _shiftDataCache[shiftId];

    try {
      const res  = await fetch(`data/shifts/${shiftId}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Store taxonomy metadata for each question
      if (data.questions) {
        data.questions.forEach(q => storeQuestionTaxonomy(q));
      }

      _shiftDataCache[shiftId] = data;
      return data;
    } catch (e) {
      console.error(`[Storage] Failed to load shift ${shiftId}:`, e);
      return null;
    }
  }

  /**
   * Load multiple shift data files in parallel.
   * Returns object keyed by shiftId.
   */
  async function loadMultipleShifts(shiftIds) {
    const results = {};
    await Promise.all(
      shiftIds.map(async id => {
        const data = await loadShiftData(id);
        if (data) results[id] = data;
      })
    );
    return results;
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    // Keys reference (for external use)
    KEYS,
    SHIFT_STATUS,

    // Settings
    getSettings,
    saveSettings,
    getSetting,

    // Overall stats
    getOverallStats,
    saveOverallStats,
    recalculateOverallStats,

    // Bookmarks
    getBookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,

    // Flags
    getFlags,
    isFlagged,
    getFlag,
    addFlag,
    removeFlag,
    toggleFlag,
    updateFlagNote,

    // Shift status
    getShiftStatus,
    setShiftStatus,

    // Shift attempts
    getShiftAttempts,
    getLastAttempt,
    getBestAttempt,
    getAttemptCount,
    saveAttempt,
    saveInProgressAttempt,
    getInProgressAttempt,
    clearInProgressAttempt,
    resetShift,

    // Per-question meta
    getQuestionMeta,
    getBulkQuestionMeta,
    storeQuestionTaxonomy,

    // Analytics helpers
    getAllAttempts,
    getAllWrongQuestionIds,
    getSubTopicAccuracy,
    getPracticeDates,

    // Export / Reset
    exportAllData,
    downloadExport,
    resetAllData,

    // Custom quiz session
    saveCustomQuizSession,
    getCustomQuizSession,
    clearCustomQuizSession,

    // In-memory cache
    cacheShiftData,
    getCachedShiftData,
    cacheShiftsIndex,
    getCachedShiftsIndex,

    // Storage info
    getStorageUsage,

    // Data loading (fetch)
    loadShiftsIndex,
    loadTaxonomy,
    loadShiftData,
    loadMultipleShifts,
  };

})();