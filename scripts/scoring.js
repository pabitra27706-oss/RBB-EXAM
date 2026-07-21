/* ═══════════════════════════════════════════════════════════════
   SCORING.JS — Score calculation and result generation
   All pure functions. No DOM, no storage side-effects.
═══════════════════════════════════════════════════════════════ */

const Scoring = (() => {

  /* ─────────────────────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────────────────────── */

  const MARKS_CORRECT  = 1;
  const MARKS_NEGATIVE = 0.33;
  const SUBJECTS       = [
    'General Awareness',
    'Mathematics',
    'General Intelligence and Reasoning',
  ];

  /* ─────────────────────────────────────────────────────────────
     CORE SCORE CALCULATION
  ───────────────────────────────────────────────────────────── */

  /**
   * Calculate final score from counts.
   * @param {number} correct
   * @param {number} wrong
   * @returns {number} finalScore (can be negative)
   */
  function calculateScore(correct, wrong) {
    const raw      = correct * MARKS_CORRECT;
    const negative = wrong   * MARKS_NEGATIVE;
    return parseFloat((raw - negative).toFixed(2));
  }

  /**
   * Calculate accuracy percentage.
   * Accuracy = correct / attempted × 100 (not total questions)
   * @param {number} correct
   * @param {number} attempted  (correct + wrong, excludes skipped)
   * @returns {number} accuracy 0–100
   */
  function calculateAccuracy(correct, attempted) {
    if (attempted === 0) return 0;
    return parseFloat(((correct / attempted) * 100).toFixed(2));
  }

  /**
   * Calculate negative marks total.
   * @param {number} wrong
   * @returns {number}
   */
  function calculateNegativeMarks(wrong) {
    return parseFloat((wrong * MARKS_NEGATIVE).toFixed(2));
  }

  /* ─────────────────────────────────────────────────────────────
     RESULT GENERATION
  ───────────────────────────────────────────────────────────── */

  /**
   * Generate a complete result object from quiz answers.
   *
   * @param {Object}   params
   * @param {string}   params.shiftId
   * @param {string}   params.mode          'quiz' | 'exam'
   * @param {Array}    params.questions      Full question objects
   * @param {Object}   params.answers        { questionId: selectedIndex | null }
   * @param {Object}   params.flags          { questionId: true/false }
   * @param {Object}   params.timings        { questionId: secondsTaken }
   * @param {number}   params.totalTimeTaken seconds
   * @param {string}   params.attemptDate    ISO string
   *
   * @returns {Object} Complete attempt object ready for Storage.saveAttempt()
   */
  function generateResult({
    shiftId,
    mode,
    questions,
    answers,
    flags,
    timings,
    totalTimeTaken,
    attemptDate,
  }) {
    // Build question-wise result array
    const questionWiseResult = questions.map(q => {
      const selected  = answers[q.id];
      const isSkipped = selected === null || selected === undefined;
      const isCorrect = !isSkipped && selected === q.correctAnswer;

      return {
        questionId:     q.id,
        selectedAnswer: isSkipped ? null : selected,
        isCorrect:      isSkipped ? false : isCorrect,
        isSkipped,
        timeTaken:      timings[q.id] || 0,
      };
    });

    // Aggregate totals
    let correct = 0;
    let wrong   = 0;
    let skipped = 0;

    questionWiseResult.forEach(qr => {
      if (qr.isSkipped)       skipped++;
      else if (qr.isCorrect)  correct++;
      else                    wrong++;
    });

    const attempted     = correct + wrong;
    const finalScore    = calculateScore(correct, wrong);
    const negativeMarks = calculateNegativeMarks(wrong);
    const accuracy      = calculateAccuracy(correct, attempted);

    // Subject-wise breakdown
    const subjectWise = _buildSubjectWise(questions, questionWiseResult);

    // Difficulty breakdown
    const difficultyWise = _buildDifficultyWise(questions, questionWiseResult);

    return {
      // attemptNumber added by Storage.saveAttempt
      mode,
      attemptDate,
      timeTaken:      totalTimeTaken,
      totalQuestions: questions.length,
      attempted,
      correct,
      wrong,
      skipped,
      finalScore,
      negativeMarks,
      accuracy,
      subjectWise,
      difficultyWise,
      questionWiseResult,
    };
  }

  /**
   * Build per-subject breakdown.
   */
  function _buildSubjectWise(questions, questionWiseResult) {
    const map = {};

    SUBJECTS.forEach(s => {
      map[s] = { correct: 0, wrong: 0, skipped: 0, score: 0, accuracy: 0 };
    });

    questions.forEach((q, idx) => {
      const qr      = questionWiseResult[idx];
      const subject  = q.subject;

      if (!map[subject]) {
        map[subject] = { correct: 0, wrong: 0, skipped: 0, score: 0, accuracy: 0 };
      }

      if (qr.isSkipped)       map[subject].skipped++;
      else if (qr.isCorrect)  map[subject].correct++;
      else                    map[subject].wrong++;
    });

    // Calculate score and accuracy per subject
    Object.keys(map).forEach(subject => {
      const s        = map[subject];
      s.score        = calculateScore(s.correct, s.wrong);
      s.accuracy     = calculateAccuracy(s.correct, s.correct + s.wrong);
    });

    return map;
  }

  /**
   * Build per-difficulty breakdown.
   */
  function _buildDifficultyWise(questions, questionWiseResult) {
    const map = {
      Easy:   { correct: 0, wrong: 0, skipped: 0, total: 0, accuracy: 0 },
      Medium: { correct: 0, wrong: 0, skipped: 0, total: 0, accuracy: 0 },
      Hard:   { correct: 0, wrong: 0, skipped: 0, total: 0, accuracy: 0 },
    };

    questions.forEach((q, idx) => {
      const qr   = questionWiseResult[idx];
      const diff = q.difficulty || 'Medium';

      if (!map[diff]) {
        map[diff] = { correct: 0, wrong: 0, skipped: 0, total: 0, accuracy: 0 };
      }

      map[diff].total++;
      if (qr.isSkipped)       map[diff].skipped++;
      else if (qr.isCorrect)  map[diff].correct++;
      else                    map[diff].wrong++;
    });

    Object.keys(map).forEach(diff => {
      const d    = map[diff];
      d.accuracy = calculateAccuracy(d.correct, d.correct + d.wrong);
    });

    return map;
  }

  /* ─────────────────────────────────────────────────────────────
     COMPARISON (vs previous best)
  ───────────────────────────────────────────────────────────── */

  /**
   * Compare current result with best previous attempt.
   * @param {Object} currentResult   The just-completed attempt
   * @param {Array}  previousAttempts All prior attempts for this shift
   * @returns {Object|null}
   *   { type: 'improved'|'declined'|'same', delta, bestPrevious }
   */
  function compareWithBest(currentResult, previousAttempts) {
    if (!previousAttempts || previousAttempts.length === 0) return null;

    const bestPrevious = previousAttempts.reduce(
      (best, a) => (a.finalScore > best.finalScore ? a : best),
      previousAttempts[0]
    );

    const delta = parseFloat(
      (currentResult.finalScore - bestPrevious.finalScore).toFixed(2)
    );

    let type;
    if (delta > 0)      type = 'improved';
    else if (delta < 0) type = 'declined';
    else                type = 'same';

    return { type, delta, bestPrevious };
  }

  /* ─────────────────────────────────────────────────────────────
     FORMATTING HELPERS
  ───────────────────────────────────────────────────────────── */

  /**
   * Format seconds into MM:SS string.
   * @param {number} totalSeconds
   * @returns {string} e.g. "54:23"
   */
  function formatTime(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Format seconds into human-readable duration.
   * @param {number} totalSeconds
   * @returns {string} e.g. "1h 24m" or "54m 23s"
   */
  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const mins  = Math.floor((totalSeconds % 3600) / 60);
    const secs  = Math.floor(totalSeconds % 60);

    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins  > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  /**
   * Format a score for display (always 2 decimal places).
   * @param {number} score
   * @returns {string} e.g. "61.75"
   */
  function formatScore(score) {
    return parseFloat(score).toFixed(2);
  }

  /**
   * Format accuracy for display.
   * @param {number} accuracy 0–100
   * @returns {string} e.g. "73.68%"
   */
  function formatAccuracy(accuracy) {
    return `${parseFloat(accuracy).toFixed(1)}%`;
  }

  /**
   * Format a date string for display.
   * @param {string} isoString ISO date or datetime
   * @returns {string} e.g. "7 Aug 2025"
   */
  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day:   'numeric',
      month: 'short',
      year:  'numeric',
    });
  }

  /**
   * Format a datetime for display.
   * @param {string} isoString
   * @returns {string} e.g. "7 Aug 2025, 2:30 PM"
   */
  function formatDateTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day:    'numeric',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format total hours spent.
   * @param {number} totalSeconds
   * @returns {string} e.g. "4.5h" or "45m"
   */
  function formatTotalTime(totalSeconds) {
    if (!totalSeconds || totalSeconds < 60) return '< 1m';
    const hours = totalSeconds / 3600;
    if (hours >= 1) return `${hours.toFixed(1)}h`;
    const mins = Math.floor(totalSeconds / 60);
    return `${mins}m`;
  }

  /* ─────────────────────────────────────────────────────────────
     GRADE / PERFORMANCE LABEL
  ───────────────────────────────────────────────────────────── */

  /**
   * Get a performance label and color based on accuracy.
   * @param {number} accuracy 0–100
   * @returns {{ label: string, colorVar: string }}
   */
  function getPerformanceLabel(accuracy) {
    if (accuracy >= 90) return { label: 'Excellent',    colorVar: '--accent-green' };
    if (accuracy >= 75) return { label: 'Good',         colorVar: '--accent-blue'  };
    if (accuracy >= 60) return { label: 'Average',      colorVar: '--accent-yellow'};
    if (accuracy >= 40) return { label: 'Below Average',colorVar: '--accent-yellow'};
    return                     { label: 'Needs Work',   colorVar: '--accent-red'   };
  }

  /**
   * Get score color class based on score percentage.
   * @param {number} score
   * @param {number} total
   * @returns {string} CSS color variable name
   */
  function getScoreColor(score, total) {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (pct >= 75) return 'var(--accent-green)';
    if (pct >= 50) return 'var(--accent-blue)';
    if (pct >= 35) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  }

  /* ─────────────────────────────────────────────────────────────
     TIMER UTILITIES
  ───────────────────────────────────────────────────────────── */

  /**
   * Convert minutes to seconds.
   * @param {number} minutes
   * @returns {number}
   */
  function minutesToSeconds(minutes) {
    return Math.floor(minutes * 60);
  }

  /**
   * Check if timer is in warning zone (less than 10 minutes).
   * @param {number} remainingSeconds
   * @returns {boolean}
   */
  function isTimerWarning(remainingSeconds) {
    return remainingSeconds <= 600; // 10 minutes
  }

  /**
   * Check if timer is in critical zone (less than 2 minutes).
   * @param {number} remainingSeconds
   * @returns {boolean}
   */
  function isTimerCritical(remainingSeconds) {
    return remainingSeconds <= 120; // 2 minutes
  }

  /* ─────────────────────────────────────────────────────────────
     QUESTION FILTER HELPERS (for Review/Custom Quiz)
  ───────────────────────────────────────────────────────────── */

  /**
   * Filter questions by review type from a completed attempt.
   * @param {Array}  questions     Full question objects
   * @param {Array}  questionWiseResult
   * @param {string} filter        'all'|'wrong'|'flagged'|'bookmarked'
   * @param {Array}  bookmarkedIds Array of bookmarked question IDs
   * @param {Object} flaggedMap    Object keyed by question ID
   * @returns {Array} Filtered questions
   */
  function filterQuestionsForReview(
    questions,
    questionWiseResult,
    filter,
    bookmarkedIds = [],
    flaggedMap    = {}
  ) {
    if (filter === 'all') return questions;

    const resultMap = {};
    questionWiseResult.forEach(qr => {
      resultMap[qr.questionId] = qr;
    });

    return questions.filter(q => {
      const qr = resultMap[q.id];
      if (!qr) return false;

      switch (filter) {
        case 'wrong':
          return !qr.isSkipped && !qr.isCorrect;
        case 'flagged':
          return !!flaggedMap[q.id];
        case 'bookmarked':
          return bookmarkedIds.includes(q.id);
        default:
          return true;
      }
    });
  }

  /**
   * Filter questions for custom quiz from loaded shift data.
   * @param {Array}  allQuestions  All questions from selected shifts
   * @param {Object} filters
   * @param {Array}  filters.subjects      Selected subject names (empty = all)
   * @param {string} filters.difficulty    'all'|'Easy'|'Medium'|'Hard'
   * @param {boolean}filters.onlyBookmarked
   * @param {boolean}filters.onlyFlagged
   * @param {boolean}filters.onlyWrong
   * @param {Array}  filters.bookmarkedIds
   * @param {Object} filters.flaggedMap
   * @param {Array}  filters.wrongIds
   * @returns {Array}
   */
  function filterQuestionsForCustomQuiz(allQuestions, filters) {
    const {
      subjects        = [],
      difficulty      = 'all',
      onlyBookmarked  = false,
      onlyFlagged     = false,
      onlyWrong       = false,
      bookmarkedIds   = [],
      flaggedMap      = {},
      wrongIds        = [],
    } = filters;

    return allQuestions.filter(q => {
      // Subject filter
      if (subjects.length > 0 && !subjects.includes(q.subject)) return false;

      // Difficulty filter
      if (difficulty !== 'all' && q.difficulty !== difficulty) return false;

      // Toggle filters (OR logic if multiple selected)
      if (onlyBookmarked || onlyFlagged || onlyWrong) {
        const matchesBookmarked = onlyBookmarked && bookmarkedIds.includes(q.id);
        const matchesFlagged    = onlyFlagged    && !!flaggedMap[q.id];
        const matchesWrong      = onlyWrong      && wrongIds.includes(q.id);
        if (!matchesBookmarked && !matchesFlagged && !matchesWrong) return false;
      }

      return true;
    });
  }

  /**
   * Shuffle an array in place using Fisher-Yates.
   * @param {Array} arr
   * @returns {Array} same array, shuffled
   */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j      = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────────────── */
  return {
    // Constants
    MARKS_CORRECT,
    MARKS_NEGATIVE,
    SUBJECTS,

    // Core calculations
    calculateScore,
    calculateAccuracy,
    calculateNegativeMarks,

    // Result generation
    generateResult,
    compareWithBest,

    // Formatting
    formatTime,
    formatDuration,
    formatScore,
    formatAccuracy,
    formatDate,
    formatDateTime,
    formatTotalTime,

    // Labels
    getPerformanceLabel,
    getScoreColor,

    // Timer utilities
    minutesToSeconds,
    isTimerWarning,
    isTimerCritical,

    // Filter helpers
    filterQuestionsForReview,
    filterQuestionsForCustomQuiz,
    shuffle,
  };

})();