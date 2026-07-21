# Railway PYQ Practice — Setup & File Reference

## Quick Start

1. Clone or download all files into a single folder
2. Serve with any local HTTP server (required for fetch() calls):
   - VS Code: Install "Live Server" extension → right-click index.html → Open with Live Server
   - Python:  python -m http.server 8000
   - Node:    npx serve .
3. Open http://localhost:8000 (or the port shown)
4. The app initializes automatically on DOMContentLoaded

> Direct file:// opening will NOT work due to fetch() for JSON and SVG files.

---

## Complete File Structure

project/
│
├── index.html                    ← Single HTML entry point
│
├── assets/
│   └── icons.svg                 ← All 70+ SVG icons as symbols
│
├── styles/
│   └── main.css                  ← Complete stylesheet
│
├── scripts/
│   ├── storage.js                ← localStorage layer (load first)
│   ├── scoring.js                ← Pure scoring calculations
│   ├── analytics.js              ← Stats and chart rendering
│   ├── components.js             ← UI component builders
│   ├── quiz.js                   ← Quiz engine
│   └── app.js                    ← Routing and init (load last)
│
└── data/
    ├── taxonomy.json             ← Subject/Topic/SubTopic tree
    ├── shifts-index.json         ← All 54 shift metadata entries
    └── shifts/
        ├── 2025_08_07_S1.json    ← Sample shift 1 (15 questions)
        └── 2025_08_08_S1.json    ← Sample shift 2 (15 questions)

---

## Script Load Order (index.html)

Scripts must load in this exact order:
1. storage.js    — no dependencies
2. scoring.js    — no dependencies
3. analytics.js  — depends on Storage, Scoring
4. components.js — depends on Storage, Scoring
5. quiz.js       — depends on Storage, Scoring, Components, App
6. app.js        — depends on all above; boots on DOMContentLoaded

---

## Adding Real Questions

To add a full 100-question shift file:

1. Create data/shifts/SHIFT_ID.json following the schema in 2025_08_07_S1.json
2. Set "totalQuestions": 100 in metadata
3. Set correct subjectSplit: { "General Awareness": 40, "Mathematics": 30,
   "General Intelligence and Reasoning": 30 }
4. Ensure question IDs follow the pattern: SHIFT_ID_Q001 through SHIFT_ID_Q100
5. Use correctAnswer as 0-based index (0=A, 1=B, 2=C, 3=D)
6. For Mathematics questions wrap expressions in \( \) for inline math
   and \[ \] for display math — MathJax loads automatically

---

## LocalStorage Keys Reference

Key                              Type      Description
-------------------------------- --------- ---------------------------
pyq_settings                     Object    App preferences
pyq_overall_stats                Object    Aggregated statistics
pyq_bookmarks                    Array     Bookmarked question IDs
pyq_flags                        Object    Flagged question map
pyq_shift_{id}_status            String    not-started/in-progress/completed
pyq_shift_{id}_attempts          Array     All attempt objects
pyq_shift_{id}_progress          Object    In-progress draft (quiz mode)
pyq_question_{id}                Object    Per-question metadata
pyq_custom_quiz_session          Object    Active custom quiz config

---

## Feature Checklist

Navigation
  [x] Bottom nav: Home, Browse, Analytics, Bookmarks, History
  [x] Back button on sub-pages
  [x] Page params passed via navigateTo()

Home Dashboard
  [x] Time-based greeting
  [x] Stats strip: Shifts Done, Accuracy, Streak
  [x] Progress ring: X/54 shifts
  [x] Recent activity (last 3 attempts)
  [x] Quick actions: Browse, Continue Last, Custom Quiz

Browse Shifts
  [x] Grouped by date
  [x] Status filter chips (All/Not Started/In Progress/Completed)
  [x] Debounced search
  [x] Shift cards with best score, accuracy, attempt count
  [x] Color-coded by status (gray/yellow/green border)

Shift Detail
  [x] Header with date, time, pages
  [x] Subject split row (GA 40 / Math 30 / Reasoning 30)
  [x] Attempt history table (clickable rows)
  [x] Start Quiz / Start Exam / Review Last / Bookmarks buttons

Pre-Quiz Screen
  [x] Mode title and shift info
  [x] Rules card (questions, time, +1/-0.33)
  [x] Mode-specific description
  [x] Begin Now button

Quiz Mode
  [x] Sticky header: shift name, Q X/Y counter, timer
  [x] Subject/Topic/Difficulty badges (settings-controlled)
  [x] Question text with MathJax for Mathematics
  [x] 4 options with A/B/C/D labels
  [x] Toggle deselect (click same option)
  [x] Bottom bar: Bookmark, Flag, Prev, Skip, Next, Palette
  [x] Question palette (slide-up panel)
  [x] Palette: 4 states (answered/flagged/visited/not-visited)
  [x] Palette summary counts
  [x] Submit from palette
  [x] Auto-save progress every 30 seconds
  [x] Resume in-progress quiz
  [x] Pause / resume
  [x] Timer warning at 10 minutes (red pulse)
  [x] Auto-submit at 0 seconds

Exam Mode
  [x] Forward-only navigation
  [x] No palette
  [x] No pause
  [x] Auto-advance after answer (400ms)
  [x] All other quiz features active

Result Page
  [x] Final score with color coding
  [x] Correct / Wrong / Skipped / Negative marks / Accuracy
  [x] Time taken
  [x] Comparison with previous best (improved/declined/same)
  [x] Subject-wise breakdown table
  [x] Difficulty-wise bar chart
  [x] Review All / Wrong / Flagged / Bookmarked buttons
  [x] Retake / Back to Browse

Review Mode
  [x] Filter bar: All / Wrong / Flagged / Bookmarked
  [x] Correct answer highlighted (green dashed)
  [x] User wrong answer highlighted (red)
  [x] Explanation always shown
  [x] Bookmark and flag toggles active
  [x] MathJax for Mathematics

Bookmarks
  [x] Subject and difficulty filter chips
  [x] Collapsible question cards
  [x] Full question + options + correct answer + explanation
  [x] Remove bookmark button
  [x] Flag toggle
  [x] Quiz Only Bookmarked button

Analytics
  [x] Overall numbers (attempted, accuracy, time, streak)
  [x] Score trend SVG line chart
  [x] Subject accuracy bar chart (GA / Math / Reasoning)
  [x] Weak areas list (< 60% accuracy, min 3 attempts)
  [x] SubTopic coverage grid (from full taxonomy)
  [x] Difficulty accuracy bar chart (Easy / Medium / Hard)
  [x] 63-day streak calendar heatmap

History
  [x] All attempts, newest first
  [x] Mode filter (All / Quiz / Exam)
  [x] Click row to view that result

Custom Quiz Builder
  [x] Step 1: Source (All / Date Range / Specific Shifts)
  [x] Step 2: Subject, Difficulty, Bookmarked/Flagged/Wrong toggles
  [x] Step 3: Question count, Timer, Shuffle
  [x] Step 4: Preview count, Settings summary, Start button
  [x] Step indicator with done/active states

Settings
  [x] Dark/Light mode toggle
  [x] Font size (Small / Medium / Large)
  [x] Timer on by default
  [x] Default duration
  [x] Show subject badges toggle
  [x] Export progress (JSON download)
  [x] Reset specific shift
  [x] Reset all progress

Keyboard Shortcuts (during quiz)
  [x] Arrow Right / Down → Next question
  [x] Arrow Left / Up → Previous question
  [x] 1/2/3/4 or A/B/C/D → Select option
  [x] F → Flag question
  [x] P → Toggle palette
  [x] Escape → Close palette

---

## Known Limitations

1. Sample shifts have 15 questions each (not 100).
   Add full 100-question JSON files to get accurate scoring.

2. MathJax loads from CDN on first Mathematics question.
   Offline use requires a local MathJax copy.

3. The SVG sprite is fetched via fetch() — requires an HTTP server.
   Cannot be opened as a local file:// URL.

4. Custom quiz builder shift picker (Step 1 → Specific Shifts)
   requires adding the shift multi-select UI in app.js
   _renderCustomQuizPage() → populate #builder-shift-picker.

5. Review filter re-filtering routes back to the result page
   rather than filtering in-place (by design — avoids stale state).

---

## Extending with More Questions

Pattern for bulk-adding shifts:
1. Copy 2025_08_07_S1.json as a template
2. Update all metadata fields (id, date, shift, pageRange, etc.)
3. Add 100 question objects following the schema
4. The app will automatically pick up new files when browsed

Question ID format:
  {date_with_underscores}_{ShiftCode}_Q{3-digit-number}
  Example: 2025_08_07_S1_Q001 through 2025_08_07_S1_Q100

---

## Browser Support

Tested and working in:
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+
  - Mobile Chrome (Android)
  - Mobile Safari (iOS)

CSS features used:
  - CSS Custom Properties (variables)
  - CSS Grid and Flexbox
  - color-mix() — requires Chrome 111+, Firefox 113+
    (falls back gracefully if unsupported)
  - backdrop-filter — requires Chrome 76+

---

## Performance Notes

- All JSON data is cached in memory after first fetch
- SVG sprite is loaded once and injected inline
- MathJax is loaded on-demand (only for Math questions)
- localStorage reads are synchronous but minimal
- Palette grid rebuilds are debounced via single-button updates