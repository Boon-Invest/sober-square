import { useEffect, useState } from "react";
import "./App.css";
import { GRID, TOTAL, rowOf, colOf, crossCells, block3x3 } from "./game/board";
import {
  newGameState,
  hydrateState,
  startNewGame,
  fireShot,
  detonateBomb,
  revealIntel,
  applyCheckIn,
  claimShareBonus,
  claimPwaInstallBonus,
  claimNotifBonus,
  advanceTutorialStep,
  grantTutorialStarterKit,
  grantTutorialBonusShots,
  TUTORIAL_DONE,
} from "./game/engine";
import { todayKey } from "./game/utils";
import { playHit, playMiss, playBoom, playPing, playEventSounds } from "./game/sound";
import { shareProgress } from "./game/share";
import { isStandalonePwa, detectPlatform } from "./game/platform";
import { BOMB_MILESTONES, INTEL_MILESTONES, milestoneProgress } from "./game/milestones";
import ShipIcon from "./components/ShipIcon";
import HowToPlay from "./components/HowToPlay";

const STORAGE_KEY = "sober_square_battleship_v1";
const INSTALL_HINT_KEY = "sober_square_install_hint_dismissed";
const BOMB_INTRO_KEY = "sober_square_seen_bomb_intro";
const INTEL_INTRO_KEY = "sober_square_seen_intel_intro";
const NOTIF_KEY = "sober_square_notif_settings";
const NOTIF_LAST_FIRED_KEY = "sober_square_last_notif";

// Logo badge: a 3x3 grid glyph (miniature radar grid), not a lettered mark.
const LOGO_DOT_CLASSES = ["", "edge", "", "edge", "center", "edge", "", "edge", ""];
const COL_LABELS = Array.from({ length: GRID }, (_, i) => String.fromCharCode(65 + i));
const ROW_LABELS = Array.from({ length: GRID }, (_, i) => String(i + 1));

// Shape classes so a hit/sunk cell reads as part of an actual hull -- rounded
// at the bow/stern ends, oriented to match how the ship is actually laid out.
function getShipShapeClass(ships, cellIdx) {
  const ship = ships.find((s) => s.cells.includes(cellIdx));
  if (!ship || ship.size < 2) return "";
  const cellPos = ship.cells.indexOf(cellIdx);
  const isHorizontal = rowOf(ship.cells[0]) === rowOf(ship.cells[1]);
  let cls = isHorizontal ? " shipH" : " shipV";
  if (cellPos === 0) cls += " shipBow";
  if (cellPos === ship.size - 1) cls += " shipStern";
  if (cellPos > 0 && cellPos < ship.size - 1) cls += " shipMid";
  return cls;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return hydrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function App() {
  const BUILD = __BUILD_ID__;

  const [state, setState] = useState(() => loadState() ?? newGameState(null));
  const [mode, setMode] = useState("fire");
  const [toasts, setToasts] = useState([]);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showRecordShare, setShowRecordShare] = useState(false);
  const [showNoShotsShare, setShowNoShotsShare] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_HINT_KEY) === "1"
  );
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem(STORAGE_KEY)
  );
  const [actionResult, setActionResult] = useState(null);
  const [pendingLoot, setPendingLoot] = useState(null);
  const [flashTargets, setFlashTargets] = useState([]);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [seenBombIntro, setSeenBombIntro] = useState(
    () => localStorage.getItem(BOMB_INTRO_KEY) === "1"
  );
  const [seenIntelIntro, setSeenIntelIntro] = useState(
    () => localStorage.getItem(INTEL_INTRO_KEY) === "1"
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTime, setNotifTime] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTIF_KEY));
      return saved?.time || "09:00";
    } catch { return "09:00"; }
  });
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTIF_KEY));
      return saved?.enabled || false;
    } catch { return false; }
  });

  function flashButtons(targets) {
    setFlashTargets(targets);
    setTimeout(() => setFlashTargets([]), 5000);
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    setPendingTarget(null);
  }

  function dismissBombIntro() {
    localStorage.setItem(BOMB_INTRO_KEY, "1");
    setSeenBombIntro(true);
  }

  function dismissIntelIntro() {
    localStorage.setItem(INTEL_INTRO_KEY, "1");
    setSeenIntelIntro(true);
  }

  async function enableNotifications(time) {
    if (!("Notification" in window)) {
      showToast("Notifications aren't supported on this browser.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      showToast("Permission denied — check your browser settings.");
      return;
    }
    const settings = { enabled: true, time };
    localStorage.setItem(NOTIF_KEY, JSON.stringify(settings));
    setNotifEnabled(true);
    setNotifTime(time);
    commit(claimNotifBonus(state));
    setNotifOpen(false);
  }

  function disableNotifications() {
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ enabled: false, time: notifTime }));
    setNotifEnabled(false);
    showToast("Daily reminders turned off.");
    setNotifOpen(false);
  }

  function downloadCalendarReminder() {
    const [h, m] = notifTime.split(":");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const uid = `sober-square-${dateStr}@sobersquare`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SoberSquare//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${dateStr}T${h}${m}00`,
      "RRULE:FREQ=DAILY",
      "DURATION:PT5M",
      "SUMMARY:Sober Square - Daily Check-in",
      "DESCRIPTION:Open Sober Square to log your day and keep your streak going!",
      "BEGIN:VALARM",
      "TRIGGER:PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Time to check in!",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sober-square-reminder.ics";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Calendar file downloaded — add it to your calendar app.");
  }

  const showInstallHint = !isStandalonePwa() && !installDismissed;
  const platform = detectPlatform();

  function dismissInstallHint() {
    localStorage.setItem(INSTALL_HINT_KEY, "1");
    setInstallDismissed(true);
  }

  // Persist the freshly-generated board once so a reload before any action
  // doesn't silently regenerate a new one.
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) saveState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next) {
    saveState(next);
    setState(next);
  }

  function pushToasts(messages) {
    const entries = messages.map((msg) => ({ id: `${Date.now()}-${Math.random()}`, msg }));
    setToasts((prev) => [...prev, ...entries]);
    entries.forEach((entry) => {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== entry.id));
      }, 4200);
    });
  }

  function showToast(msg) {
    pushToasts([msg]);
  }

  function notifyEvents(next) {
    if (next.events && next.events.length) {
      pushToasts(next.events);
      playEventSounds(next.events);
      if (next.events.some((e) => e.includes("streak record"))) {
        setShowRecordShare(true);
      }
    }
  }

  function commit(next) {
    persist(next);
    notifyEvents(next);
    return next;
  }

  // For triggers that fire from an effect/event listener rather than a click
  // handler, where the closed-over `state` variable could be stale by the
  // time it runs -- uses the functional setState form to always read fresh.
  function commitViaUpdater(updater) {
    setState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      saveState(next);
      notifyEvents(next);
      return next;
    });
  }

  // Grant the home-screen-install bonus the moment we ever detect the app
  // running standalone (covers iOS, which has no install event at all), and
  // also listen for the real-time Android/Chromium install signal.
  useEffect(() => {
    commitViaUpdater((prev) =>
      isStandalonePwa() ? claimPwaInstallBonus(prev) : prev
    );

    function handleAppInstalled() {
      commitViaUpdater((prev) => claimPwaInstallBonus(prev));
    }

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notifEnabled) return;
    function checkReminder() {
      const today = todayKey();
      if (state.lastCheckDate === today) return;
      const now = new Date();
      const [h, m] = notifTime.split(":").map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (now < target) return;
      const lastFired = localStorage.getItem(NOTIF_LAST_FIRED_KEY);
      if (lastFired === today) return;
      localStorage.setItem(NOTIF_LAST_FIRED_KEY, today);
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification("Sober Square — Daily Debrief", {
            body: "Time to check in! Open the app to log your day.",
            icon: "/icon-192.png",
            tag: "daily-reminder",
          });
        });
      } else if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Sober Square — Daily Debrief", {
          body: "Time to check in! Open the app to log your day.",
          icon: "/icon-192.png",
          tag: "daily-reminder",
        });
      }
    }
    checkReminder();
    const interval = setInterval(checkReminder, 60_000);
    return () => clearInterval(interval);
  }, [notifEnabled, notifTime, state.lastCheckDate]);

  function commitCheckIn(sober, note) {
    commit(applyCheckIn(state, sober, note));
  }

  function finishReflection(save) {
    commitCheckIn(false, save ? reflectionNote.trim() : "");
    setReflectionOpen(false);
    setReflectionNote("");
  }

  // Daily check-in gate, then win/loss notice, derived fresh from state each render.
  function getGateModal() {
    const today = todayKey();
    if (state.lastCheckDate !== today) {
      if (reflectionOpen) {
        return {
          title: "ANYTHING TO LOG?",
          body: "Optional - saved to your private log only.",
          isReflection: true,
        };
      }
      return {
        title: "DAILY DEBRIEF",
        body: "Did you drink yesterday?",
        actions: [
          { label: "Yes, I drank", variant: "secondary", onClick: () => setReflectionOpen(true) },
          { label: "No, stayed sober", variant: "primary", onClick: () => commitCheckIn(true) },
        ],
      };
    }
    if (state.status === "won") {
      return {
        title: "FLEET NEUTRALIZED 🎉",
        body: `You sank every ship with ${60 - state.daysElapsed} day(s) to spare.`,
        actions: [
          { label: "Deploy new mission", variant: "primary", onClick: () => commit(startNewGame(state)) },
        ],
      };
    }
    if (state.status === "lost") {
      return {
        title: "MISSION TIMED OUT",
        body: "60 days are up and enemy ships are still out there.",
        actions: [
          { label: "Deploy new mission", variant: "primary", onClick: () => commit(startNewGame(state)) },
        ],
      };
    }
    return null;
  }

  const activeModal = getGateModal();

  // What to do next, plus a nudge if a bomb/intel milestone is within reach.
  function buildEncouragement(nextState) {
    let action;
    if (nextState.shotsAvailable > 0) {
      action = `You've got ${nextState.shotsAvailable} shot${nextState.shotsAvailable > 1 ? "s" : ""} left - take another!`;
    } else if (nextState.bombsAvailable > 0) {
      action = "No shots left, but you've got a Bomb ready - switch modes and use it!";
    } else if (nextState.intelAvailable > 0) {
      action = "No shots left - try your Intel charge to scout safely.";
    } else {
      action = "Out of moves for now. Stay sober for tomorrow's shot, or broadcast for a bonus one.";
    }

    const bombP = milestoneProgress(nextState.streakDays, BOMB_MILESTONES);
    const intelP = milestoneProgress(nextState.streakDays, INTEL_MILESTONES);
    const gaps = [];
    if (bombP.next) gaps.push({ gap: bombP.next - nextState.streakDays, label: "Bomb" });
    if (intelP.next) gaps.push({ gap: intelP.next - nextState.streakDays, label: "Intel" });
    // Surface every milestone within reach, not just the closest one -- an
    // approaching Intel charge is just as worth calling out as a Bomb, since
    // its 3x3 reveal is a big edge against the fleet in its own right.
    const nearby = gaps.filter((g) => g.gap > 0 && g.gap <= 2).sort((a, b) => a.gap - b.gap);
    for (const g of nearby) {
      action += ` Only ${g.gap} more sober day${g.gap > 1 ? "s" : ""} until your next ${g.label} charge!`;
    }

    return action;
  }

  function buildActionResultMessage(actionMode, prevState, next, cellIdx) {
    const encouragement = buildEncouragement(next);

    if (actionMode === "fire") {
      const status = next.cellStatus[cellIdx];
      const wasLand = next.land.includes(cellIdx);
      if (status === "sunk") {
        const ship = next.ships.find((s) => s.cells.includes(cellIdx));
        return {
          title: "Direct hit - SUNK!",
          body: `You've sunk the ${ship ? ship.name : "ship"}! ${encouragement}`,
        };
      }
      if (status === "hit") {
        return { title: "Hit!", body: `Nice shooting - you've damaged a ship. ${encouragement}` };
      }
      if (wasLand) {
        return { title: "Land ho!", body: `Ah, no ship there - just land. ${encouragement}` };
      }
      return { title: "Miss - just water", body: `Ah, miss - you've hit open water. ${encouragement}` };
    }

    if (actionMode === "bomb") {
      let hits = 0;
      let sunk = 0;
      for (const c of crossCells(cellIdx)) {
        if (next.cellStatus[c] === "hit") hits++;
        if (next.cellStatus[c] === "sunk" && prevState.cellStatus[c] !== "sunk") sunk++;
      }
      if (sunk > 0) {
        return { title: "Bomb away - direct hit!", body: `Your blast sank a ship! ${encouragement}` };
      }
      if (hits > 0) {
        return {
          title: "Bomb away - contact!",
          body: `You damaged ${hits} cell${hits > 1 ? "s" : ""} in the blast. ${encouragement}`,
        };
      }
      return {
        title: "Bomb away - no contact",
        body: `Just water and land in that blast radius. ${encouragement}`,
      };
    }

    if (actionMode === "intel") {
      let spotted = 0;
      for (const c of block3x3(cellIdx)) {
        if (next.cellStatus[c] === "spotted" && prevState.cellStatus[c] !== "spotted") spotted++;
      }
      if (spotted > 0) {
        return {
          title: "Intel sweep - contact!",
          body: `You've spotted ${spotted} ship cell${spotted > 1 ? "s" : ""} in that area. ${encouragement}`,
        };
      }
      return { title: "Intel sweep - clear", body: `Nothing but water and land out there. ${encouragement}` };
    }

    return null;
  }

  function dismissActionResult() {
    setActionResult(null);
  }

  function dismissLootModal() {
    const target = pendingLoot?.flashTarget;
    setPendingLoot(null);
    if (target) flashButtons([target]);
  }

  // Onboarding sequence for a brand-new player only (see tutorialStep in engine.js).
  function getTutorialModal() {
    if (state.tutorialStep === 0) {
      return {
        title: "Why 60 days?",
        body:
          'Fun fact: it takes about 60 days to build a new habit - that\'s exactly why you\'ve got 60 days to hunt down this fleet. Good news: these are the only "shots" you\'ll be taking from now on.',
        action: { label: "Next", onClick: () => commit(advanceTutorialStep(state, 1)) },
      };
    }
    if (state.tutorialStep === 1) {
      return {
        title: "Your starter kit",
        body:
          "Here's one of each to get you started: a Fire shot, a Bomb, and an Intel charge. Try them all out at your own pace - no pressure.",
        action: {
          label: "Let's go",
          onClick: () => {
            commit(grantTutorialStarterKit(state));
            flashButtons(["fire", "bomb", "intel"]);
          },
        },
      };
    }
    if (state.tutorialStep === 2) {
      return {
        title: "Keep hunting",
        body: "Nice work exploring - here's 5 more shots to keep you going.",
        action: {
          label: "Thanks!",
          onClick: () => {
            commit(grantTutorialBonusShots(state));
            flashButtons(["fire"]);
          },
        },
      };
    }
    if (state.tutorialStep === 3) {
      return {
        title: "One more tip",
        body:
          "Broadcasting your progress earns you +1 shot every day you do it - and accountability really does help with staying sober. Try the Broadcast button anytime.",
        action: {
          label: "Got it",
          onClick: () => {
            commit(advanceTutorialStep(state, 4));
            flashButtons(["broadcast"]);
          },
        },
      };
    }
    if (state.tutorialStep === 4) {
      return {
        title: "Stay on target",
        body:
          "Set up a daily reminder so you never miss a check-in. You'll earn +1 bonus shot for turning it on.",
        action: {
          label: "Set reminder",
          onClick: () => {
            commit(advanceTutorialStep(state, TUTORIAL_DONE));
            setNotifOpen(true);
          },
        },
        secondaryAction: {
          label: "Skip",
          onClick: () => commit(advanceTutorialStep(state, TUTORIAL_DONE)),
        },
      };
    }
    return null;
  }

  const tutorialModal = !showIntro ? getTutorialModal() : null;

  function handleCellClick(i) {
    if (mode === "fire") {
      if (!["hidden", "spotted"].includes(state.cellStatus[i])) return;
      if (state.shotsAvailable <= 0) {
        if (state.lastShareBonusDate !== todayKey()) {
          setShowNoShotsShare(true);
        } else {
          showToast("No shots left. Stay sober to earn another guess.");
        }
        return;
      }
      const prevState = state;
      const next = fireShot(state, i);
      commit(next);
      if (next.cellStatus[i] === "hit") playHit();
      else if (next.cellStatus[i] === "miss") playMiss();
      setActionResult(buildActionResultMessage("fire", prevState, next, i));
      if (next.lootResult) setPendingLoot(next.lootResult);
    } else if (mode === "bomb") {
      if (state.bombsAvailable <= 0) {
        const { next: nextMilestone } = milestoneProgress(state.streakDays, BOMB_MILESTONES);
        showToast(
          nextMilestone
            ? `No bombs charged. Reach a ${nextMilestone}-day streak to earn one.`
            : "No bombs charged."
        );
        return;
      }
      // Preview only -- tapping elsewhere just moves the preview. The
      // action only actually fires once the user taps Confirm.
      setPendingTarget(i);
    } else if (mode === "intel") {
      if (state.intelAvailable <= 0) {
        const { next: nextMilestone } = milestoneProgress(state.streakDays, INTEL_MILESTONES);
        showToast(
          nextMilestone
            ? `No intel charges. Reach a ${nextMilestone}-day streak to earn one.`
            : "No intel charges."
        );
        return;
      }
      setPendingTarget(i);
    }
  }

  function confirmBomb() {
    const cellIdx = pendingTarget;
    if (cellIdx === null) return;
    const prevState = state;
    const next = detonateBomb(state, cellIdx);
    commit(next);
    playBoom();
    setActionResult(buildActionResultMessage("bomb", prevState, next, cellIdx));
    if (next.lootResult) setPendingLoot(next.lootResult);
    setPendingTarget(null);
  }

  function confirmIntel() {
    const cellIdx = pendingTarget;
    if (cellIdx === null) return;
    const prevState = state;
    const next = revealIntel(state, cellIdx);
    commit(next);
    playPing();
    setActionResult(buildActionResultMessage("intel", prevState, next, cellIdx));
    if (next.lootResult) setPendingLoot(next.lootResult);
    setPendingTarget(null);
  }

  async function handleShare() {
    const result = await shareProgress({
      highestStreak: state.highestStreak,
      totalSoberDays: state.totalSoberDays,
    });
    if (result === "copied") showToast("Broadcast copied to your clipboard!");
    else if (result === "unsupported") showToast("Sharing isn't supported on this browser.");

    if (result === "shared" || result === "copied") {
      commit(claimShareBonus(state));
    }

    setShowRecordShare(false);
    setShowNoShotsShare(false);
  }

  const daysRemaining = 60 - state.daysElapsed;
  const bombProgress = milestoneProgress(state.streakDays, BOMB_MILESTONES);
  const intelProgress = milestoneProgress(state.streakDays, INTEL_MILESTONES);
  const tensionClass = daysRemaining <= 5 ? " critical" : daysRemaining <= 14 ? " tense" : "";

  const previewCells =
    pendingTarget !== null
      ? mode === "bomb"
        ? crossCells(pendingTarget)
        : mode === "intel"
        ? block3x3(pendingTarget)
        : []
      : [];
  const previewSet = new Set(previewCells);

  function getNextStepMessage() {
    if (state.shotsAvailable > 0) {
      return "Tap a hidden square on the board to fire.";
    }
    if (state.bombsAvailable > 0) {
      return "Bomb ready - switch modes, tap a square.";
    }
    if (state.intelAvailable > 0) {
      return "Intel ready - switch modes to scout safely.";
    }
    return "Out of moves. Stay sober for tomorrow's shot, or broadcast for a bonus.";
  }

  return (
    <div className="page">
      <div className="scanOverlay" />

      <div className="titleRow">
        <div className="logoBadge">
          {LOGO_DOT_CLASSES.map((cls, idx) => (
            <span key={idx} className={`logoDot ${cls}`} />
          ))}
        </div>
        <div className="wordmarkWrap">
          <div className="wordmark">SOBER SQUARE</div>
          <div className="eyebrow">ATTACK RADAR CONSOLE</div>
        </div>
        <button
          className="helpButton"
          onClick={() => setHowToPlayOpen(true)}
          aria-label="How to play"
        >
          ?
        </button>
      </div>

      {showInstallHint && (
        <div className="installHint">
          <span className="blinkDot" />
          {platform === "ios" && (
            <span>
              Install: tap Share in Safari &rarr; &ldquo;Add to Home Screen&rdquo;.
              {!state.pwaBonusClaimed && " +1 shot for doing it!"}
            </span>
          )}
          {platform === "android" && (
            <span>
              Install: &#8942; menu in Chrome &rarr; &ldquo;Add to Home screen&rdquo;.
              {!state.pwaBonusClaimed && " +1 shot for doing it!"}
            </span>
          )}
          {platform === "other" && (
            <span>
              Add to your home screen for the best experience.
              {!state.pwaBonusClaimed && " Bonus shot included!"}
            </span>
          )}
          <button className="installHintClose" onClick={dismissInstallHint} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="statsGrid">
        <div className="statCard">
          <span className="statLabel">Streak</span>
          <span className="statValue">{state.streakDays}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Best</span>
          <span className="statValue">{state.highestStreak}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Dry total</span>
          <span className="statValue">{state.totalSoberDays}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Clock</span>
          <span className="statValue">{Math.max(0, daysRemaining)}/60</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Sunk</span>
          <span className="statValue">{state.lifetimeShipsSunk}</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Cleared</span>
          <span className="statValue">{state.gamesWon}</span>
        </div>
      </div>

      <div className="utilityRow">
        <button className="utilityBtn" onClick={() => setHistoryOpen(true)}>
          &#9702; LOG
        </button>
        <button
          className={`utilityBtn ${flashTargets.includes("broadcast") ? "flashing" : ""}`}
          onClick={handleShare}
        >
          &#9703; BROADCAST
        </button>
        <button
          className={`utilityBtn ${notifEnabled ? "notifActive" : ""}`}
          onClick={() => setNotifOpen(true)}
        >
          &#128276; REMIND
        </button>
      </div>

      {showRecordShare && (
        <div className="recordBanner">
          <span>NEW RECORD STREAK - broadcast the win?</span>
          <div className="recordBannerActions">
            <button onClick={handleShare}>Broadcast</button>
            <button onClick={() => setShowRecordShare(false)}>Dismiss</button>
          </div>
        </div>
      )}

      {showNoShotsShare && (
        <div className="recordBanner">
          <span>OUT OF SHOTS - broadcast for a bonus round</span>
          <div className="recordBannerActions">
            <button onClick={handleShare}>Broadcast</button>
            <button onClick={() => setShowNoShotsShare(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="nextStepBanner">
        <span className="blinkDot" />
        <span className="ordersLabel">ORDERS</span>
        <span>{getNextStepMessage()}</span>
      </div>

      <div className="resourceRow">
        <div
          className={`resourceWrap ${state.shotsAvailable > 0 ? "ready" : ""} ${flashTargets.includes("fire") ? "flashing" : ""}`}
        >
          <button
            className={`resourceBtn fire ${mode === "fire" ? "active" : ""}`}
            onClick={() => selectMode("fire")}
          >
            <span className="resIcon">&#9678;</span>FIRE
            <span className="resCount">{state.shotsAvailable}</span>
          </button>
        </div>
        <div
          className={`resourceWrap ${state.bombsAvailable > 0 ? "ready" : ""} ${flashTargets.includes("bomb") ? "flashing" : ""}`}
        >
          <button
            className={`resourceBtn bomb ${mode === "bomb" ? "active" : ""}`}
            onClick={() => selectMode("bomb")}
            disabled={state.bombsAvailable <= 0}
          >
            <span className="resIcon">&#10022;</span>BOMB
            <span className="resCount">{state.bombsAvailable}</span>
          </button>
          <div className="progressTrack">
            <div className="progressFill bomb" style={{ width: `${bombProgress.fraction * 100}%` }} />
          </div>
          <span className="progressLabel">
            {bombProgress.next ? `NEXT D${bombProgress.next}` : "MAXED"}
          </span>
        </div>
        <div
          className={`resourceWrap ${state.intelAvailable > 0 ? "ready" : ""} ${flashTargets.includes("intel") ? "flashing" : ""}`}
        >
          <button
            className={`resourceBtn intel ${mode === "intel" ? "active" : ""}`}
            onClick={() => selectMode("intel")}
            disabled={state.intelAvailable <= 0}
          >
            <span className="resIcon">&#9670;</span>INTEL
            <span className="resCount">{state.intelAvailable}</span>
          </button>
          <div className="progressTrack">
            <div className="progressFill intel" style={{ width: `${intelProgress.fraction * 100}%` }} />
          </div>
          <span className="progressLabel">
            {intelProgress.next ? `NEXT D${intelProgress.next}` : "MAXED"}
          </span>
        </div>
      </div>
      <p className="modeHint">
        {mode === "fire" && "Tap a hidden square to fire a single shot."}
        {mode === "bomb" && "Tap a square to detonate a 5-cell cross."}
        {mode === "intel" && "Tap a square to reveal a 3×3 area, no damage."}
      </p>

      {mode === "bomb" && pendingTarget !== null && (
        <div className="confirmBanner">
          <span>Confirm Bomb strike here?</span>
          <div className="confirmBannerActions">
            <button className="primary" onClick={confirmBomb}>
              Confirm
            </button>
            <button className="secondary" onClick={() => setPendingTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "intel" && pendingTarget !== null && (
        <div className="confirmBanner">
          <span>Confirm Intel scan here?</span>
          <div className="confirmBannerActions">
            <button className="primary" onClick={confirmIntel}>
              Confirm
            </button>
            <button className="secondary" onClick={() => setPendingTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="boardFrame">
        <div className="colRuler">
          <span className="rulerCell" />
          {COL_LABELS.map((l, idx) => (
            <span key={idx} className="rulerCell">{l}</span>
          ))}
        </div>
        <div className="boardRowWrap">
          <div className="rowRuler">
            {ROW_LABELS.map((l, idx) => (
              <span key={idx} className="rulerCell">{l}</span>
            ))}
          </div>
          <div className={`board${tensionClass}`}>
            <div className="radarSweep" />
            <div className="cornerBracket tl" />
            <div className="cornerBracket tr" />
            <div className="cornerBracket bl" />
            <div className="cornerBracket br" />
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${GRID}, 1fr)`,
                gridTemplateRows: `repeat(${GRID}, 1fr)`,
              }}
            >
              {Array.from({ length: TOTAL }).map((_, i) => {
                const status = state.cellStatus[i];
                const isLand = state.land.includes(i);
                const isGreenery = state.greenery.includes(i);
                let cls = "cell";
                let style;
                if (status === "hidden") cls += " fog";
                else if (status === "spotted") cls += " spotted";
                else if (status === "hit") cls += " hit" + getShipShapeClass(state.ships, i);
                else if (status === "sunk") cls += " sunk" + getShipShapeClass(state.ships, i);
                else {
                  cls += isLand ? " land" : " water";
                  if (isLand) {
                    style = {
                      "--tx1": `${(i * 37) % 100}%`,
                      "--ty1": `${(i * 59) % 100}%`,
                      "--tx2": `${(i * 71) % 100}%`,
                      "--ty2": `${(i * 83) % 100}%`,
                      "--tx3": `${(i * 13) % 100}%`,
                      "--ty3": `${(i * 29) % 100}%`,
                    };
                  }
                }
                if (status !== "hidden" && isLand && isGreenery) cls += " greenery";
                if (previewSet.has(i)) cls += " previewTarget";

                return (
                  <button
                    key={i}
                    className={cls}
                    style={style}
                    onClick={() => handleCellClick(i)}
                    aria-label={`row ${rowOf(i) + 1} column ${colOf(i) + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="legend">
        <span><i className="swatch fog" />FOG</span>
        <span><i className="swatch water" />WATER</span>
        <span><i className="swatch land" />LAND</span>
        <span><i className="swatch hit" />HIT</span>
        <span><i className="swatch sunk" />SUNK</span>
        <span><i className="swatch spotted" />SIGHTED</span>
      </div>

      <div className="fleetList">
        <h2>Target roster</h2>
        {state.ships.map((ship) => {
          const statusClass = ship.sunk ? "sunk" : ship.hits.length > 0 ? "damaged" : "healthy";
          const statusText = ship.sunk ? "SUNK" : `${ship.hits.length}/${ship.size} HIT`;
          return (
            <div key={ship.id} className="fleetRow">
              <span className="fleetName">{ship.name}</span>
              <ShipIcon size={ship.size} hitCount={ship.hits.length} sunk={ship.sunk} />
              <span className={`fleetStatus ${statusClass}`}>{statusText}</span>
            </div>
          );
        })}
      </div>

      <div className="footerRow">
        <div className="buildLabel">BUILD {BUILD}</div>
      </div>

      <div className="toastStack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.msg}
          </div>
        ))}
      </div>

      {showIntro && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard howToPlayCard">
            <div className="modalCorner" />
            <h2>Welcome aboard, operator</h2>
            <HowToPlay />
            <div className="modalActions">
              <button className="primary" onClick={() => setShowIntro(false)}>
                Begin mission
              </button>
            </div>
          </div>
        </div>
      )}

      {!showIntro && tutorialModal && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>{tutorialModal.title}</h2>
            <p>{tutorialModal.body}</p>
            <div className="modalActions">
              {tutorialModal.secondaryAction && (
                <button className="secondary" onClick={tutorialModal.secondaryAction.onClick}>
                  {tutorialModal.secondaryAction.label}
                </button>
              )}
              <button className="primary" onClick={tutorialModal.action.onClick}>
                {tutorialModal.action.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showIntro && !tutorialModal && howToPlayOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard howToPlayCard">
            <h2>Field manual</h2>
            <HowToPlay />
            <div className="modalActions">
              <button className="primary" onClick={() => setHowToPlayOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!showIntro && !tutorialModal && !howToPlayOpen && activeModal && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>{activeModal.title}</h2>
            <p>{activeModal.body}</p>
            {activeModal.isReflection ? (
              <>
                <textarea
                  className="reflectionInput"
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                />
                <div className="modalActions">
                  <button className="secondary" onClick={() => finishReflection(false)}>
                    Skip
                  </button>
                  <button className="primary" onClick={() => finishReflection(true)}>
                    Save
                  </button>
                </div>
              </>
            ) : (
              <div className="modalActions">
                {activeModal.actions.map((a, idx) => (
                  <button key={idx} className={a.variant} onClick={a.onClick}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!showIntro && !tutorialModal && !howToPlayOpen && !activeModal && actionResult && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>{actionResult.title}</h2>
            <p>{actionResult.body}</p>
            <div className="modalActions">
              <button className="primary" onClick={dismissActionResult}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {!showIntro && !tutorialModal && !howToPlayOpen && !activeModal && !actionResult && pendingLoot && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard lootCard">
            <div className="lootIcon">&#127873;</div>
            <h2>Loot box found!</h2>
            <p className="lootLabel">{pendingLoot.label}</p>
            <div className="modalActions">
              <button className="primary" onClick={dismissLootModal}>
                Nice!
              </button>
            </div>
          </div>
        </div>
      )}

      {!showIntro && !tutorialModal && !howToPlayOpen && !activeModal && !actionResult && !pendingLoot &&
        mode === "bomb" && !seenBombIntro && (
          <div className="modalOverlay" role="dialog" aria-modal="true">
            <div className="modalCard">
              <h2>How Bomb works</h2>
              <p>
                Tap a square on the board to preview a 5-square cross blast around
                it. Like what you see? Tap Confirm to strike - or tap a different
                square first to move the preview.
              </p>
              <div className="modalActions">
                <button className="primary" onClick={dismissBombIntro}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

      {!showIntro && !tutorialModal && !howToPlayOpen && !activeModal && !actionResult && !pendingLoot &&
        mode === "intel" && !seenIntelIntro && (
          <div className="modalOverlay" role="dialog" aria-modal="true">
            <div className="modalCard">
              <h2>How Intel works</h2>
              <p>
                Tap a square on the board to preview a 3&times;3 scan area. Tap
                Confirm to reveal it (no damage) - or tap a different square first
                to move the preview.
              </p>
              <div className="modalActions">
                <button className="primary" onClick={dismissIntelIntro}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

      {notifOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard notifCard">
            <h2>Daily reminder</h2>
            {!state.notifBonusClaimed && (
              <p className="notifBonus">+1 bonus shot for enabling reminders!</p>
            )}
            <p>
              Pick your preferred check-in time. Browser notifications fire
              when the app is open; a calendar event is the most reliable
              daily alarm across all devices.
            </p>

            <div className="notifTimePicker">
              <span className="notifTimeLabel">Remind me at</span>
              <input
                type="time"
                value={notifTime}
                onChange={(e) => setNotifTime(e.target.value)}
              />
            </div>

            <div className="notifMenu">
              <div className="notifMenuItem">
                <div className="notifMenuIcon">&#128276;</div>
                <div className="notifMenuBody">
                  <div className="notifMenuTitle">Browser notifications</div>
                  <div className="notifMenuDesc">
                    {notifEnabled
                      ? "Active — you'll get a nudge when the app is open."
                      : "Get a push when you open the app past your reminder time."}
                  </div>
                </div>
                {notifEnabled ? (
                  <button className="notifMenuAction on" onClick={disableNotifications}>ON</button>
                ) : (
                  <button className="notifMenuAction" onClick={() => enableNotifications(notifTime)}>OFF</button>
                )}
              </div>
              <div className="notifMenuItem">
                <div className="notifMenuIcon">&#128197;</div>
                <div className="notifMenuBody">
                  <div className="notifMenuTitle">Calendar event</div>
                  <div className="notifMenuDesc">
                    Downloads a recurring daily event — works on any phone or desktop.
                  </div>
                </div>
                <button className="notifMenuAction" onClick={downloadCalendarReminder}>GET</button>
              </div>
            </div>

            <div className="modalActions">
              <button className="primary" onClick={() => setNotifOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard historyCard">
            <h2>Mission log</h2>
            {state.journal.length === 0 ? (
              <p>No entries yet.</p>
            ) : (
              <div className="journalList">
                {state.journal.map((entry, idx) => (
                  <div key={idx} className="journalEntry">
                    <div className="journalDate">
                      {entry.date} &middot; streak was {entry.streakBefore}d
                    </div>
                    {entry.note && <div className="journalNote">{entry.note}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="modalActions">
              <button className="primary" onClick={() => setHistoryOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
