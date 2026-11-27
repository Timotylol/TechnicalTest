# Play & Win — Technical Design Document

> **Client:** Harbour Point Community Club  
> **Event:** FunFest @ Downtown West  
> **Stack:** Vite 8 + Vanilla ES Modules (Frontend), Express 5 + Node `fs/promises` (Backend, port `3001`)

---

## 1. Codebase & Framework Analysis

### 1.1 Existing Starter Assets

| File | Current State | Role in Final App |
| :--- | :--- | :--- |
| `package.json` | ESM (`"type": "module"`), `express@^5.3.0`, `vite@^8.3.5`, `concurrently@^10.0.7`. `npm start` runs `server.js` and `vite --host` together. | Keep as-is; zero new runtime dependencies required. |
| `vite.config.js` | Uses `@vitejs/plugin-basic-ssl` (`https://`) and proxies `/api/*` to `http://localhost:3001`. | Serves over HTTPS so iOS/Android allow `DeviceOrientationEvent` tilt sensors on LAN phones (can be removed for plain HTTP + Drag/Tap fallback). |
| `index.html` | Minimal HTML5 shell with `#app` root and `/src/main.js` entry. | Update `<meta name="viewport">` to disable accidental pinch-zoom/overscroll during tilt gameplay (`maximum-scale=1.0, user-scalable=no, viewport-fit=cover`). |
| `server.js` | Express 5 app on port `3001` with `express.json()`, `/api/ping`, and stubbed `POST /api/records` & `GET /api/records`. | Implement local JSON file persistence, atomic write queue, event logging, claim ID issuance/verification, and aggregated stats. |
| `src/api.js` | Stubbed `saveRecord(record)` and `getRecords()`. | Implement `fetch` wrappers for `/api/records`, plus claim/admin endpoints. |
| `src/main.js` | Placeholder DOM rendering + `/api/ping` check. | Replace with app bootstrap, state machine router, session initialization, and screen mounting. |
| `src/style.css` | Basic reset + `body` background (`#d4ef8a url('/bg.png')`). | Expand with mobile-first layout, CSS animations (walk-in, transitions), responsive touch targets, and game/admin UI styles. |
| `src/data/questions.json` | 6 sample questions; `options` arrays vary in length (`2`, `3`, or `4` items), 0-based `answerIndex`. | Keep schema intact; quiz renderer must dynamically lay out `2..N` answer zones. |

### 1.2 What Needs to Be Built

1. **Centralized Configuration (`src/config.js`)**: Single source of truth for event branding, copy, quiz pass mark/count, maze time limit/difficulty, admin PIN, and physics tuning.
2. **State Machine & Screen Router (`src/router.js` / `src/state.js`)**: Manages `sessionId`, current screen, completion flags (`quizPassed`, `miniGamePassed`), and `claimId`.
3. **5 Core Screens**:
   - **Landing / Splash + Walk-In -> 2-Button Menu** (`src/screens/landingScreen.js`, `src/screens/menuScreen.js`)
   - **Tilt-Ball Quiz** (`src/screens/quizScreen.js`)
   - **Tilt-Ball Maze MiniGame** (`src/screens/mazeScreen.js`)
   - **Final Screen** (`src/screens/finalScreen.js`)
   - **Admin Screen** (`src/screens/adminScreen.js`)
4. **Shared Input & Physics Engine (`src/engine/tiltInput.js`, `src/engine/ballPhysics.js`)**: Unified `DeviceOrientation` + calibration + iOS permission flow + pointer/drag fallback + 60fps `requestAnimationFrame` delta-time loop.
5. **Local JSON Persistence (`server.js` -> `data/db.json`)**: Serialized atomic file writes, session/event tracking, and unique Claim ID lifecycle.

---

## 2. Proposed Architecture & Directory Layout

```text
TechnicalTest/
├── index.html                  # Mobile viewport lock + #app mount
├── package.json                # Unchanged (npm start runs Vite + Express)
├── vite.config.js              # Unchanged (/api proxy -> localhost:3001)
├── server.js                   # Express 5 API + atomic JSON file store
├── data/
│   └── db.json                 # Auto-created local database (gitignored)
├── public/
│   ├── bg.png                  # Existing background
│   └── assets/                 # Custom sprites (Building, Man, gear, icons, Background, Player, Answer, Wall*, Bad, Goal)
└── src/
    ├── main.js                 # App entry: init session, log app_launch, mount router
    ├── config.js               # Centralized event, game, physics, and UI config
    ├── state.js                # Client session state (persisted in sessionStorage)
    ├── api.js                  # saveRecord(), getRecords(), claim & admin API calls
    ├── style.css               # Global mobile-first styles, animations & portrait lock
    ├── data/
    │   ├── questions.json      # Quiz questions (existing format)
    │   └── mazes.json          # Declarative maze layouts (walls, hazards/holes, start, goal)
    ├── engine/
    │   ├── tiltInput.js        # DeviceOrientation, iOS permission, calibration, drag fallback
    │   ├── ballPhysics.js      # 2D ball integration, friction, wall/circle collisions
    │   └── quizSystem.js       # Pure quiz state machine (shuffle, scoring, passMark check)
    └── screens/
        ├── landingScreen.js    # Building entrance + walk-in animation
        ├── menuScreen.js       # 2-button menu (Quiz / MiniGame) + progress + Admin corner btn
        ├── quizScreen.js       # Tilt-ball quiz with dynamic 2..4+ answer zones
        ├── mazeScreen.js       # Wooden-labyrinth tilt-ball maze (<60s timer)
        ├── finalScreen.js      # Dual-win verification + unique Claim ID display
        └── adminScreen.js      # PIN gate, metrics dashboard, Claim ID lookup/toggle
```

### Architectural Principles
- **Unidirectional Screen Lifecycle**: Every screen module exports `mount(container, ctx)` and returns a `cleanup()` function (or registers disposers) that removes `requestAnimationFrame` loops, event listeners, and timers before the next screen mounts.
- **Zero External Runtime Dependencies**: Canvas 2D + CSS3 transforms + Vanilla ES modules keep bundle size tiny for fast loading over event Wi-Fi.
- **Session Continuity**: `state.js` stores `{ sessionId, quizPassed, quizBestScore, miniGamePassed, miniGameBestTime, claimId }` in `sessionStorage` so an accidental page reload does not wipe a player's progress mid-flow.

---

## 3. Centralized Configuration (`src/config.js` & `questions.json`)

All event-specific copy, rules, and tuning live in `src/config.js` so organizers can reskin and rebalance the app for future events without touching game logic.

```js
// src/config.js
export const CONFIG = {
  event: {
    clientName: 'Harbour Point Community Club',
    eventName: 'FunFest @ Downtown West',
    appTitle: 'Play & Win',
    claimPrefix: 'HPCC',
  },
  copy: {
    landingTitle: 'Welcome to FunFest!',
    landingSubtitle: 'Tap the entrance to step inside and play for a prize.',
    startButton: 'Enter Club',
    menuTitle: 'Choose Your Challenge',
    menuSubtitle: 'Win both games to unlock your prize!',
    quizButton: 'Fun-Fact Quiz',
    miniGameButton: 'Tilt-Ball Maze',
    finalWinTitle: 'Congratulations!',
    finalWinBody: 'Show this Claim ID at the prize booth to collect your reward.',
  },
  quiz: {
    questionCount: 5,         // Number of questions per run (capped at questions.json length)
    shuffleQuestions: true,   // Randomize order each attempt
    passMark: 0.8,            // 80% required to pass
    dwellMs: 650,             // Time ball must stay inside an answer zone to lock in
    feedbackMs: 1100,         // Pause after answering before next question
  },
  miniGame: {
    timeLimitSec: 60,         // Must finish under 1 minute
    maxScore: 100,            // Fixed max score; reaching goal awards 100
    mazeId: 'classic-1',      // Key into src/data/mazes.json
    holePenaltySec: 0,        // Optional time penalty on hole fall (0 = respawn only)
    respawnInvulnMs: 500,
  },
  physics: {
    sensitivity: 28,          // Acceleration multiplier from tilt degrees
    maxTiltDeg: 30,           // Clamp sensor input to [-30, +30] deg
    friction: 0.94,           // Per-frame damping (normalized to 60fps)
    maxSpeed: 520,            // Logical px/sec cap
    wallBounce: 0.35,         // Restitution on maze/arena walls
    deadzoneDeg: 2.0,         // Ignore micro-jitter near flat
  },
  admin: {
    pin: '1234',              // Set to '' to disable PIN prompt
    refreshIntervalMs: 0,     // 0 = manual refresh button only
  },
}
```

### `questions.json` Compatibility
- Each entry in `src/data/questions.json` follows:
  `{ "id": number, "question": string, "options": string[], "answerIndex": number }`.
- `quizScreen.js` slices `questions` to `Math.min(CONFIG.quiz.questionCount, questions.length)` (with optional Fisher-Yates shuffle).
- Pass condition: `Math.ceil(selectedQuestions.length * CONFIG.quiz.passMark)` (e.g., `5 * 0.8 = 4` correct; `6 * 0.8 = 5` correct).

---

## 4. Screen-by-Screen & State Machine Design

### 4.1 Screen State Machine

```text
[LANDING] --(Tap Start + Walk-In Anim + iOS Sensor Prompt)--> [MENU]
   |                                                            |
   +--(Corner Admin Btn)----------------------------------------+--> [ADMIN]
                                                                |
   [MENU] --(Tap Quiz)------> [QUIZ] -----(Pass >= 80% / Fail)--+
   [MENU] --(Tap MiniGame)--> [MAZE] -----(Goal < 60s / Fail)---+
                                                                |
   [MENU] --(Both quizPassed && miniGamePassed)-----------------> [FINAL]
```

- **Auto-Advance Convenience**: When a player wins the second required game (so both `quizPassed` and `miniGamePassed` become `true`), their result overlay offers a primary **"Claim Your Prize"** button that navigates directly to `[FINAL]`.
- **Direct URL/Guard**: Mounting `[FINAL]` verifies `state.quizPassed && state.miniGamePassed`; if false, it redirects back to `[MENU]`.

### 4.2 Screen Specifications

#### A. Landing / Splash + Walk-In (`landingScreen.js`)
- **Visuals**: Building entrance illustration (uses custom image in `public/assets/` if provided, or clean CSS/SVG architectural facade fallback). Subtle corner **Admin** button (`opacity: 0.55`, 44x44px hit area).
- **Interaction**:
  1. Player taps **Enter Club**.
  2. **Crucial iOS Step**: Inside this direct click handler, call `tiltInput.requestPermission()` so iOS 13+ grants `DeviceOrientationEvent` access before gameplay begins.
  3. Trigger CSS keyframe animation: player character walks toward the doorway and fades/scales into the entrance (`~900ms`).
  4. Transition to `[MENU]`.
- **Tracking**: On first app boot per `sessionStorage` session, fire `saveRecord({ type: 'app_launch', sessionId })`.

#### B. 2-Button Menu (`menuScreen.js`)
- **Layout**: Event header, progress badge (`0/2`, `1/2`, or `2/2 Challenges Complete`), and **two large primary buttons**:
  1. **Fun-Fact Quiz** — shows `"Passed ✓"` badge if `state.quizPassed` is true (still replayable).
  2. **Tilt-Ball Maze** — shows `"Passed ✓"` badge if `state.miniGamePassed` is true (still replayable).
- **Conditional CTA**: If both are passed, display a highlighted **"View Prize Claim ID"** button.
- **Corner Button**: Subtle **Admin** icon button in top-right/bottom-right corner.
- **Tracking**: Tapping either game logs `{ type: 'game_picked', game: 'quiz' | 'minigame', sessionId }`.

#### C. Tilt-Ball Quiz (`quizScreen.js`)
- **Layout**:
  - Top HUD: Question progress (`Q 2 / 5`), current score, and a **Calibrate / Control Mode** pill (`Tilt` vs `Tap/Drag`).
  - Question banner below HUD.
  - Playfield `<canvas>` (or responsive positioned arena) containing the **player ball** (spawns at center) and **`N` answer zones** (`N = question.options.length`, supporting 2, 3, or 4+ options):
    - `2` options: Left / Right halves (or Top-Left / Bottom-Right).
    - `3` options: Triangle arrangement (Top-Left, Top-Right, Bottom-Center).
    - `4` options: 4 corners (TL, TR, BL, BR).
    - `>4` options: Equal radial sectors around center.
- **Selection Mechanic**:
  - Rolling the ball into an answer zone fills a radial progress ring around that zone over `CONFIG.quiz.dwellMs` (`650ms`). Leaving the zone resets the ring. This prevents accidental answers from brief edge grazes.
  - **Tap/Drag Fallback**: If tilt is unavailable or user toggles fallback, players can drag the ball or tap an answer zone directly.
- **Result & Tracking**:
  - On completion, compute `passed = score >= Math.ceil(total * CONFIG.quiz.passMark)`.
  - Log `{ type: 'game_result', game: 'quiz', passed, score, maxScore: total, sessionId }`.
  - Show pass/fail overlay with **Try Again** and **Back to Menu** (or **Claim Prize** if both games are now won).

#### D. Tilt-Ball Maze MiniGame (`mazeScreen.js`)
- **Visuals**: Wooden-labyrinth aesthetic rendered on `<canvas>` (warm wood tones, bevelled walls, dark recessed holes, checkered/glowing **GOAL** pad, and metallic/bright player ball with drop shadow).
- **Maze Data (`src/data/mazes.json`)**:
  - Defined in normalized `0..1` coordinates (e.g., `9:14` portrait aspect ratio) so the maze scales cleanly to any phone screen:
    - `start: { x, y }`, `goal: { x, y, r }`
    - `walls: [{ x, y, w, h }]`
    - `holes: [{ x, y, r }]`
- **Rules & Scoring**:
  - Countdown timer from `CONFIG.miniGame.timeLimitSec` (`60s`).
  - Falling into a hole (`dist(ball, hole) < hole.r * 0.75`): plays brief shrink/flash animation (`350ms`) and respawns ball at `start` (forgiving for kids and grandparents; costs time rather than instant game-over).
  - Reaching `goal`: stops timer, awards `score = CONFIG.miniGame.maxScore` (`100`), sets `state.miniGamePassed = true`.
  - Timer hits `0`: awards `score = 0`, `passed = false`, shows **Try Again** / **Back to Menu**.
- **Tracking**: Log `{ type: 'game_result', game: 'minigame', passed, score, maxScore: 100, durationSec, sessionId }`.

#### E. Final Screen (`finalScreen.js`)
- **Precondition**: `state.quizPassed && state.miniGamePassed`.
- **Claim ID Issuance**:
  - On mount, if `state.claimId` is not yet set, call `POST /api/claims` with `{ sessionId }`.
  - Server idempotently returns `{ claimId, claimed }` (e.g., `HPCC-4829`) and persists it in `db.json` so one winning session = one Claim ID.
- **UI**:
  - Celebratory header, high-contrast **Claim ID** card (large monospace text), live badge (`Unclaimed` / `Claimed`), and **"Show this screen at the prize booth"** instruction.
  - **Play Again (New Player)** button at bottom that resets `sessionStorage` and returns to `[LANDING]` for shared-device/booth use.
- **Tracking**: Log `{ type: 'final_screen_view', sessionId, claimId }` once per Final Screen visit.

#### F. Admin Screen (`adminScreen.js`)
- **Access**: Optional PIN modal if `CONFIG.admin.pin` is non-empty.
- **Metrics Grid** (computed from server data):
  - App Launches (`app_launch` count)
  - Total Players (unique `sessionId` count across events)
  - Game Picked Breakdown (`Quiz` count vs. `MiniGame` count)
  - Quiz Wins / Losses (and pass rate %)
  - MiniGame Wins / Losses (and pass rate %)
  - Final Screen Views (`final_screen_view` count)
  - Rewards Claimed (`claimed === true` count / total issued Claim IDs)
- **Prize Claim Verification**:
  - Search/filter input for Claim ID (e.g., type `4829` to find `HPCC-4829`).
  - Table/card list of issued Claim IDs showing timestamp, status (`Pending` / `Claimed`), and a **"Mark Claimed"** / **"Undo"** toggle button calling `PATCH /api/claims/:claimId`.
- **Utility Controls**: **Refresh** button, **Export JSON** download button, and **Reset Data** button (with confirmation dialog for pre-event test cleanup).

---

## 5. Shared Phone-Tilt (`DeviceOrientation`) & Ball Physics Engine

### 5.1 `src/engine/tiltInput.js`

Responsibilities:
1. **iOS 13+ Permission**:
   - Check `typeof DeviceOrientationEvent?.requestPermission === 'function'`.
   - Must be invoked inside a user gesture (tap on **Enter Club** or **Calibrate**).
   - Store permission state (`'granted' | 'denied' | 'unsupported' | 'prompt'`).
2. **Calibration (Zero-Offset)**:
   - Players hold phones at ~30–45 degrees, not flat on a table.
   - `calibrate()` captures the current `(beta, gamma)` as `(baseBeta, baseGamma)` so holding the phone naturally is neutral `(0, 0)`.
   - Auto-calibrate on the first valid sensor reading when a game starts, plus a manual **Re-center** button in the HUD.
3. **Orientation Normalization**:
   - Read `gamma` (left/right tilt, `-90..90`) and `beta` (front/back tilt, `-180..180`).
   - Subtract `baseGamma` / `baseBeta`, apply `deadzoneDeg` (`2.0°`), clamp to `±maxTiltDeg` (`30°`), and normalize to `[-1, 1]` vector `{ ax, ay }`.
   - Handle `screen.orientation.angle` (`0`, `90`, `-90`/`270`) if rotated, while locking/encouraging portrait play.
4. **Desktop & Accessibility Fallback**:
   - If `DeviceOrientation` emits no events within `1000ms` (e.g., desktop browser / DevTools without sensor override) or permission is denied, automatically enable **Pointer Drag / Virtual Tilt** (dragging anywhere on the canvas applies `{ ax, ay }` proportional to drag vector, or arrow/WASD keys on desktop).
   - Expose a manual toggle in the HUD so users can switch between `Tilt` and `Touch/Drag` anytime.

### 5.2 `src/engine/ballPhysics.js`

60fps frame-rate-independent 2D physics loop:
- **Time Step**: Compute `dt = Math.min((now - lastTime) / 1000, 0.05)` (clamped to `50ms` to prevent tunneling on tab-switch).
- **Integration**:
  ```js
  vx += ax * sensitivity * dt * 60
  vy += ay * sensitivity * dt * 60
  const damp = Math.pow(friction, dt * 60)
  vx *= damp
  vy *= damp
  // Clamp speed to maxSpeed, then update x, y
  ```
- **Collisions**:
  - **Arena Bounds**: Keep ball within `[r, width - r]` and `[r, height - r]`, reflecting velocity by `-wallBounce`.
  - **AABB Walls (Maze)**: Closest-point-on-rectangle test against circle `(ball.x, ball.y, ball.r)`. On overlap, push ball out along minimum penetration normal and reflect normal velocity component by `wallBounce`.
  - **Circular Zones (Quiz Answers, Maze Holes, Maze Goal)**: Distance check `hypot(dx, dy) < zone.r`.

---

## 6. Backend & Local Persistence (`server.js` & `src/api.js`)

### 6.1 Local File Schema (`data/db.json`)

Single JSON file managed by `server.js` (auto-initialized if missing):

```json
{
  "records": [
    {
      "id": "rec_1732620000_a1b2",
      "type": "app_launch",
      "sessionId": "sess_9f8c7d",
      "timestamp": "2026-11-26T14:00:00.000Z"
    },
    {
      "id": "rec_1732620045_c3d4",
      "type": "game_result",
      "game": "quiz",
      "passed": true,
      "score": 5,
      "maxScore": 5,
      "sessionId": "sess_9f8c7d",
      "timestamp": "2026-11-26T14:00:45.000Z"
    }
  ],
  "claims": [
    {
      "claimId": "HPCC-4829",
      "sessionId": "sess_9f8c7d",
      "issuedAt": "2026-11-26T14:02:10.000Z",
      "claimed": false,
      "claimedAt": null
    }
  ]
}
```

### 6.2 Concurrency & Atomic Writes (`server.js`)

Multiple phones on the same Wi-Fi will hit `server.js` concurrently. To prevent race conditions or partial-write JSON corruption:
- **In-Memory Write Queue**: Chain all mutating file operations onto a module-level promise (`writeQueue = writeQueue.then(...)`).
- **Atomic Write**: Write serialized JSON to `data/db.json.tmp` and `fs.rename` over `data/db.json`.

### 6.3 Express 5 API Routes (`server.js`)

| Method & Path | Purpose | Request / Response |
| :--- | :--- | :--- |
| `GET /api/ping` | Health check (existing) | `-> { ok: true }` |
| `POST /api/records` | Append an event record | Body: `{ type, sessionId, ... }` -> `201 { ok: true, record }` |
| `GET /api/records` | Return all raw records | `-> record[]` (preserves starter contract) |
| `GET /api/admin/summary` | Aggregated metrics + claims list | `-> { metrics: { appLaunches, totalPlayers, quizPicked, miniGamePicked, quizWins, quizLosses, miniGameWins, miniGameLosses, finalScreenViews, rewardsClaimed }, claims }` |
| `POST /api/claims` | Issue (or return existing) Claim ID for a winning `sessionId` | Body: `{ sessionId, prefix? }` -> `{ claimId, claimed, issuedAt }` |
| `PATCH /api/claims/:claimId` | Toggle/set prize claimed status | Body: `{ claimed: boolean }` -> `{ ok: true, claim }` |
| `DELETE /api/admin/reset` | Clear `records` and `claims` for pre-event testing | `-> { ok: true }` |

### 6.4 Client API (`src/api.js`)

Keep `saveRecord(record)` and `getRecords()` as the primary exports (per starter comments), and add claim/admin helpers:
- `saveRecord(record)` -> `POST /api/records` (best-effort; catches network errors so gameplay never crashes if server drops briefly).
- `getRecords()` -> `GET /api/records`.
- `issueClaim(sessionId)` -> `POST /api/claims`.
- `getAdminSummary()` -> `GET /api/admin/summary`.
- `setClaimStatus(claimId, claimed)` -> `PATCH /api/claims/${encodeURIComponent(claimId)}`.
- `resetAdminData()` -> `DELETE /api/admin/reset`.

---

## 7. Mobile UX, Error Handling & Verification Plan

### 7.1 Mobile UX & Accessibility
- **Touch, Viewport & Portrait Lock**: `touch-action: none` on game canvases to prevent pull-to-refresh or page scrolling while dragging/tilting; `min-height: 44px` on all buttons; high-contrast typography for outdoor/bright-hall readability. Calls `screen.orientation?.lock?.('portrait')` on entry and shows a `.landscape-lock` CSS overlay on mobile landscape so play stays strictly portrait.
- **HTTPS & Tilt vs. Drag Fallback**: Mobile browsers (iOS Safari and Android Chrome) require **HTTPS** (`https://`) for `DeviceOrientationEvent` tilt sensors. [vite.config.js](file:///C:/Users/spxte/Documents/Temp%20Algo/GitVer/TechnicalTest/vite.config.js) uses `@vitejs/plugin-basic-ssl` so LAN phones load over `https://` with tilt enabled (accept the self-signed cert warning once). If served over plain HTTP instead, both games automatically fall back to **Drag / Tap** controls.
- **All-Ages Affordances**: Large ball and generous answer zones in Quiz; forgiving hole respawn (instead of instant game-over) in Maze; clear visual progress rings and audio-optional visual flashes (no mandatory sound).
- **Offline / Server Error Resilience**: If `/api/records` fails during gameplay, log a console warning and let the player continue; only `FinalScreen` Claim ID issuance shows a retry button if the server is unreachable.

### 7.2 Verification Plan

| Test Area | How to Verify | Expected Result |
| :--- | :--- | :--- |
| **Boot & Proxy** | Run `npm start`; open `http://localhost:5173` on desktop & LAN phone. | App loads; `app_launch` recorded in `data/db.json`. |
| **iOS Tilt Permission** | Open on iOS Safari via LAN IP; tap **Enter Club**. | Native Motion & Orientation prompt appears; granting enables smooth ball tilt. |
| **Desktop Fallback** | Open in Chrome DevTools (`Ctrl+Shift+M`) without sensor override. | Auto-detects no tilt events and enables pointer drag / keyboard arrows. |
| **Quiz Configurability** | Change `questionCount`, `passMark`, or `questions.json` option counts (`2`, `3`, `4`). | Arena renders matching number of answer zones; pass/fail threshold updates accurately. |
| **Maze MiniGame** | Test wall collision, hole respawn, timeout at `60s`, and goal completion `< 60s`. | Hole respawns at start; reaching goal `< 60s` marks `miniGamePassed = true`. |
| **Dual-Win Gate & Claim ID** | Complete only Quiz -> check Menu; complete Maze -> reach Final Screen; reload Final Screen. | Final Screen locked until both games passed; same `claimId` returned on reload. |
| **Admin Metrics & Claim Toggle** | Open Admin Screen, verify all 6+ metrics, search `claimId`, click **Mark Claimed**, refresh. | Counts match `data/db.json`; `claimed: true` persists across page reloads and server restarts. |
| **Concurrent Writes** | Play simultaneously on 2+ phones on Wi-Fi. | Both phones' records and Claim IDs persist cleanly in `data/db.json` without corruption. |

### 7.3 Running, Testing on Mobile & Stopping the Server
- **First-Time Setup:** Run `npm.cmd install` in the project folder (use `npm.cmd` in PowerShell if `npm.ps1` is blocked by execution policy).
- **Production Build Check:** Run `npm.cmd run build` to verify Vite bundling.
- **Start App & Server:** Run `npm.cmd start` (launches Express on port `3001` and Vite on port `5173` via `concurrently -k`).
- **Test on Phone:** Connect the phone to the same Wi-Fi (or hotspot) and open the **Network** URL printed by Vite (e.g., `http://192.168.x.x:5173`). Allow Node.js through Windows Firewall if prompted.
- **Stop App & Server:** Press `Ctrl + C` in the terminal running `npm.cmd start` (press `Y` + `Enter` if Windows prompts `Terminate batch job (Y/N)?`). If a Node process stays stuck, run `taskkill /F /IM node.exe` in PowerShell.

### 7.4 Future Improvements
- **More Secure Player ID:** Currently, `sessionId` is stored in `sessionStorage`, so clearing browser cache or opening a new tab creates a new player session. For stricter one-prize-per-person enforcement, implement **user login / authentication** (e.g., phone/email sign-in or event registration ID) in a future version.
