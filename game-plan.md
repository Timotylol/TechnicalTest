# Play & Win — Game Plan

> **Client:** Harbour Point Community Club  
> **Event:** FunFest @ Downtown West  
> **Status:** Complete (v1.0)

---

## 1. Overview
A mobile-first "Play & Win" web application for Harbour Point Community Club's **FunFest @ Downtown West**, designed for players of all ages—from kids to grandparents. Players enter through an animated splash screen into a two-button game menu featuring a **Fun-Fact Quiz** and a **Tilt-Ball Maze MiniGame**, both unified around intuitive phone-tilt ball controls. To claim a prize, players must pass the Quiz (`>= 80%`) and complete the MiniGame (reach the end goal under 1 minute) to unlock the Final Screen with a unique Claim ID. All event settings (questions, pass mark, timers, text) are centralized for easy reuse at future events, while an Admin Screen tracks app launches, game stats, Final Screen views, and prize claim verification against a shared local server file.

---

## 2. Menu / Landing
- **Other Ideas:**
  - **Door Open & Zoom In:** Tap "Start" -> building doors open and the camera zooms into the doorway -> transitions to Game Select.
- **Selected Idea:**
  - **Splash Screen -> Player Walks In:** The initial Landing/Splash screen shows the building entrance. Tapping to start plays the animation of the player character walking into the door.
  - **2-Button Menu Scene:** After the player walks in, it transitions to the Menu scene with **2 main buttons**—**Quiz** and **MiniGame**—each leading directly to its respective scene.
  - **Visual Assets:** Custom building/door/character images to be created and provided by the user later.
  - **Admin Access:** Subtle corner button on the Menu/Landing screen leading to the Admin Screen.
  - **Configurability:** Event title, welcome copy, and button text driven by centralized config.

---

## 3. Quiz
- **Previous Idea:** Virtual joystick to control a player character to collect an answer and put it in a basket to submit.
- **Other Ideas:**
  - Standard tap-to-select multiple-choice cards (useful as a fallback for desktop testing or accessibility).
- **Selected Idea:**
  - **Phone Tilt Ball Mechanic:** The player is a ball; tilting the phone (`DeviceOrientation`) moves the ball around the screen into the chosen answer zone/basket to answer each question.
  - **Scoring & Config:** 1 point per correct answer; configurable question list, question count, and pass mark (default `80%`) from the centralized config.
  - **Mobile Considerations:** Include iOS orientation permission prompt on start and an optional tap/drag fallback if tilt sensors are unavailable.

---

## 4. MiniGame
- **Previous Idea:** Items falling from the sky; the player moves left or right to collect good items and avoid bad ones.
- **Other Ideas:**
  - **2-Player Air/Ice Hockey:** Two players on opposite sides of the phone hitting a puck into the opposing goal.
- **Selected Idea:**
  - **Tilt-Ball Maze (Wooden Labyrinth Style):** Reuses the phone-tilt ball controls from the Quiz. The player tilts the phone to roll the ball through a maze, avoiding holes to reach the end goal—approachable for kids and nostalgic for older players.
  - **Time & Scoring:** Must finish under 1 minute; win condition is simply reaching the end goal (avoiding holes) rather than an `80%` score threshold.
  - **Configurability:** Time limit and maze/difficulty settings driven by centralized config.

---

## 5. Final Screen
- **Selected Idea:**
  - **Win Condition (Both Games):** Players must win **both** the Quiz (`>= 80%`) and the MiniGame (reach the end goal within the time limit) to unlock and reach the Final Screen.
  - **Win State & Unique Claim ID:** Upon winning both games, the Final Screen displays a **unique Claim ID** to show at the prize booth.
  - **One Prize Per Win (Claim Tracking):** The server's local database file stores the Claim ID and its `claimed` status so staff can verify whether a reward has already been claimed (checkable/toggleable from the Admin Screen).
  - **Loss / Retry State:** Players who do not reach the pass mark see their score and a **Try Again** option instead of a prize screen.
  - **Tracking:** Records Final Screen views to the server.
  - *(Note: Exact record schema and claim route details to be finalized in the tech design.)*

---

## 6. Admin Screen
- **Selected Idea:**
  - **Access:** Opened via the subtle corner button on the Menu/Landing screen (optionally guarded by a simple configurable PIN).
  - **Core Metrics (Brief + Custom):**
    - App launches (people who launched the web app) & total players
    - Game picked breakdown (Quiz vs. MiniGame)
    - Wins and losses per game (e.g., Quiz pass/fail, MiniGame pass/fail)
    - Final Screen views
    - Rewards claimed count
  - **Prize Claim Verification:** Lookup/list of winning Claim IDs so staff can check status and mark a reward as claimed.
  - **Utility Controls:** Refresh stats button (and optional Reset/Export for pre-event testing).
