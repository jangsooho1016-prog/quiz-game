# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

`docs/prd.md` (Korean) is the spec for a web-based 4-choice general-knowledge quiz game (상식 퀴즈 게임) and the source of truth; read it before implementing a feature and cite feature IDs (F-01 … F-18) and priorities (P0/P1/P2) when planning work. All P0, P1, and P2 features (F-01 … F-18) are implemented, plus the PRD open decisions the user resolved (speed bonus, category practice mode, success-metric/question stats). `docs/remaining-checklist.txt` tracks what is left (human cross-review, server decision, real screen-reader check). `docs/question-review.md` is the cross-review sheet, generated from `public/questions.json` (regenerate it when questions change). `README.md` is the user-facing overview. `docs/prd.md` itself is not edited; record decisions here and in the checklist.

## Commands

Vite + React + TypeScript (TS 7), Vitest, oxlint. No external state-management library.

- `npm run test` — run all tests once (`npm run test:watch` for watch mode)
- `npx vitest run src/game/ranking.test.ts` — one file; add `-t "<test name>"` for one test
- `npm run build` — `tsc -b` type-check (includes test files) + Vite build
- `npm run build:pages` — same, with `--base=/quiz-game/` for GitHub Pages (`jangsooho1016-prog/quiz-game`). Keep the base in this npm script: passing `--base=/quiz-game/` on the Git Bash command line gets rewritten to a Windows path.
- `npm run lint` — oxlint
- `npm run test:e2e` — Playwright (`e2e/*.e2e.ts`, config `playwright.config.ts`): builds, serves with `vite preview` on port 4174, and runs play-through, axe (WCAG 2.2 AA), and layout checks at 1280px and 360px in light and dark. Uses the installed Google Chrome (`channel: 'chrome'`); set `PW_CHANNEL=chromium` after `npx playwright install chromium` if Chrome is missing. E2E files are type-checked by `tsconfig.e2e.json`.
- `npm run dev` — dev server

## Architecture

- `src/game/` — pure functions, no React. `types.ts` holds the PRD types and constants (`CATEGORIES` order, 10 per category, 10 points). `game.ts`: `buildGame` produces `PresentedQuestion`s whose `optionOrder[displayIndex]` maps a shuffled position back to the original option number; `judge` takes a **display index** and records the **original** option number, so `AnswerLog.selected` always refers to `Question.options`. `scoring.ts` (`speedBonus`/`pointsFor`/`scoreOf`; `summarizeGame` builds a `GameRecord` + logs for any length, `finishGame` additionally requires 40 answers), `ranking.ts` (sort/dedupe/rank — the single source of ranking rules), `stats.ts` (completion rate, retry rate, per-question accuracy flags with PRD targets as constants).
- `session.ts` is the in-game state machine (`startSession`, `answerCurrent`, `goToNext`, `expireIfOverdue`, `categoryTransition`, `toResult` for full games, `toPracticeSummary` for practice); `QuizScreen` holds a `GameSession` in `useState` and only calls these. Keep game rules out of components. Time-dependent functions take `now` as an argument (never call `Date.now()` inside `src/game`).
- F-09 timer: the deadline is `questionShownAt + timeLimitMs` (`TIME_LIMIT_SEC` = 15 in `types.ts`). `answerCurrent` itself turns a late click into a timeout, so correctness never depends on the UI tick interval. It also stamps `elapsedMs` (question shown → answer committed; the limit for timeouts), which drives the speed bonus.
- Game modes: `GameSession.mode` is `'full'` (40 questions, saved to ranking) or `'practice'` (one `practiceCategory`, 10 questions via `buildGame(bank, rng, [category])`, never saved to ranking). Same timer and bonus rules, except a practice game may be untimed (`timeLimitMs: null`, WCAG 2.2.1): no timeout and no speed bonus (`hasSpeedBonus`, `scoreOf(answers, withBonus)`, `maxScore(n, withBonus)`). Full games must be timed (`toResult` rejects untimed sessions). `review.ts` builds the wrong-answer list (F-14) by joining answer logs with questions.
- Randomness is injected (`Rng`); tests use `seededRng(seed)` for reproducibility.
- `src/App.tsx` switches screens with a `Screen` union state (no router). The in-progress game lives only in memory, so a refresh returns to the start screen (the PRD's "consistent refresh handling" choice). The record is saved in `handleFinish` (the "결과 보기" click), never in render/effects (StrictMode double-invokes those), via `saveRecordOnce`, which is idempotent by record id. `App` takes `questions` (null while loading), `loadError`, `onRetryLoad`, `repository`, and `stats` props (tests inject in-memory ones). `src/Bootstrap.tsx` (rendered by `main.tsx`) renders the start screen immediately and fetches the question bank in the background (start button disabled until loaded; load errors show on the start screen), which keeps LCP under the PRD's 2 s. The ranking repository is created before questions arrive and reads the bank lazily (`QuestionSource` can be a function).
- Stats (success metrics): `App` calls `stats.recordStart` in `handleStart`, `recordFinish` in `handleFinish`, and `recordRetry` on the result screen's "다시 하기". Unfinished games keep only the start record, which is how abandonment is counted. Stats writes never throw.
- `src/screens/` one component per screen; `src/components/` shared pieces (`OptionButton`, `AnswerSheet` progress marks, `Timer`, `format.ts`). `src/sound/` synthesizes effects with Web Audio (no audio files; silently no-ops where unavailable) and stores the on/off setting under `quiz-game/sound`. Styling is plain CSS in `src/styles.css` with color tokens on `:root` (light + dark); visual concept is an OMR answer sheet. Interactive control borders use `--control-line` (≥3:1, WCAG 1.4.11); `--ink-line` is for decorative lines only. Only Noto Serif KR is a web font (loaded non-blocking via `preload` in `index.html`); UI text uses system Korean fonts for first-load speed.
- `src/App.test.tsx` runs in jsdom (`// @vitest-environment jsdom` per file) with Testing Library and plays full games through the UI (timer tests use `vi.useFakeTimers()`); all other tests run in Node.
- Question bank (F-17): `public/questions.json` is fetched at runtime by `src/data/loadQuestions.ts` (no-cache) and validated by `parseQuestions` (shape, unique ids, ≥10 per category), so replacing that file in a deployed `dist/` changes questions without a rebuild. App code must not import the JSON; tests get it via `src/data/testQuestions.ts`. `questions.test.ts` enforces exactly 10 per category for the shipped file.
- `src/storage/` — `RankingRepository` interface (`getTop`, `getTopByCategory` for F-16, `rankOf`, `getAnswerLogs`); `LocalStorageRankingRepository(storage, questions)` takes an injectable `KeyValueStorage` (tests use `MemoryStorage`, no jsdom). `save` re-validates the record against its answer logs and the question bank (`validateRecord.ts`: score incl. bonus, `elapsedMs` range, no correct answer at/after the limit) and rejects incomplete or inconsistent games. `StatsRepository` / `LocalStorageStatsRepository` store `PlayLog`s. `save` writes answer logs then records and restores the previous answer logs if the records write fails.
- Code style: no semicolons, single quotes, tests colocated as `*.test.ts` with Korean test names (Vitest picks up `*.test.ts(x)` only; Playwright uses `*.e2e.ts`).

## Core rules that span multiple features

- One game = 40 questions: 4 categories (한국사, 과학, 지리, 일반상식) × 10, played **in category order**; question order within a category and option order are shuffled (handled by `buildGame`/`judge`).
- Clicking an option commits the answer immediately (no changing). Feedback shows right/wrong, highlights the correct option, and shows the explanation; a "다음" button advances. After question 40 → result screen.
- Screens: 시작 (start) → 퀴즈 (quiz) → 결과 (result) → 랭킹 (ranking). "다시 하기" returns to start.
- Nickname: 2–10 chars, no whitespace.
- Scoring: correct = 10 + speed bonus, where bonus = 5 − floor(elapsed / 3 s), clamped to 0–5 (0–2.9 s → +5 … 12–14.9 s → +1). Wrong/timeout = 0, no penalty. Max 15 per question, 600 for a full game (`maxScore`). Each question has a 15-second limit; timeout = wrong answer (`selected` = NULL).
- Ranking order: score desc → duration asc (first question shown → 40th answer committed) → created_at asc. Category tabs (F-16): that category's correct count desc → whole-game duration asc → created_at asc.
- Only completed full games (all 40 answered) are saved to the ranking; practice games never are. Every record is stored, but the ranking list shows only each nickname's best record; top 10.
- Success metrics: completion rate = finished / started full games; retry rate = finished full games whose result-screen "다시 하기" was pressed / finished full games; a question is flagged when accuracy < 10% or > 95% with ≥ 10 attempts (finished full + practice games). Shown on the stats screen (ranking → "통계 보기"); per-browser only.
- If a server exists, it re-scores the game, and correct answers must not be sent to the client while a question is displayed.

## Data model (from PRD)

Three tables: `question` (category, content, option_1..4, answer 1–4, explanation, nullable difficulty), `game_record` (nickname, score, correct_count, duration_sec, created_at), `answer_log` (record_id, question_id, selected, is_correct). In code these are `Question` (PRD `option_1..4` → `options` 4-tuple), `GameRecord` (camelCase, plus `categoryCorrect`, which the PRD lists among saved fields), and `AnswerLog` (plus `elapsedMs` for the bonus). `PlayLog` is an extra stats record (also kept for abandoned games). localStorage keys: `quiz-game/v2/records`, `quiz-game/v2/answer-logs`, `quiz-game/v2/plays`, `quiz-game/sound`. The `v2` prefix started when the bonus changed scoring; the old un-prefixed keys are intentionally left untouched and unread. Question data should be swappable without code changes (F-17).

## Non-functional constraints

- Responsive from 360px to 1440px with no horizontal scroll; option buttons ≥ 44px tall.
- Right/wrong must be shown with an icon (✓/✗) and text, not color alone; keys 1–4 select options.
- Feedback within 0.2s of answering; first screen loads within 2s.
- A page refresh during a game must be handled one consistent way (restore the game, or restart it).

## Open decisions (PRD "미결정 사항")

Decided by the user: 15-second time limit; questions loaded at runtime from `public/questions.json`; sound effects on by default (with a remembered mute toggle); speed bonus (+1 per remaining 3 s, max +5, max score 600); single-category mode as a practice mode excluded from ranking; abandoned games recorded for stats only; rankings stay in localStorage (no server) for now; old pre-bonus records are not migrated (new v2 keys).

Also decided: practice games can be untimed (no bonus); questions 6, 29, 30 were corrected after a web fact-check (see `docs/question-review.md`).

Still open — ask the user rather than assuming: adding a server later (shared ranking, server-side scoring, hiding answers); a larger question bank (`buildGame` already samples 10 per category if more exist).
