import { useEffect, useState } from "react";
import "./App.css";
import { GRID, TOTAL, rowOf, colOf } from "./game/board";
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

// Logo badge: a 3x3 grid glyph (miniature radar grid), not a lettered mark.
const LOGO_DOT_CLASSES = ["", "edge", "", "edge", "center", "edge", "", "edge", ""];
const COL_LABELS = Array.from({ length: GRID }, (_, i) => String.fromCharCode(65 + i));
const ROW_LABELS = Array.from({ length: GRID }, (_, i) => String(i + 1));

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

  function forceRefresh() {
    const url = new URL(window.location.href);
    url.searchParams.set("v", BUILD);
    url.searchParams.set("t", Date.now().toString());
    window.location.replace(url.toString());
  }

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
      const next = fireShot(state, i);
      commit(next);
      if (next.cellStatus[i] === "hit") playHit();
      else if (next.cellStatus[i] === "miss") playMiss();
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
      commit(detonateBomb(state, i));
      playBoom();
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
      commit(revealIntel(state, i));
      playPing();
    }
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
      <p className="soloNote">
        SOLO OP &middot; no other player - a hidden AI-placed fleet awaits your orders.
      </p>

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
        <button className="utilityBtn" onClick={handleShare}>
          &#9703; BROADCAST
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
        <div className={`resourceWrap ${state.shotsAvailable > 0 ? "ready" : ""}`}>
          <button
            className={`resourceBtn fire ${mode === "fire" ? "active" : ""}`}
            onClick={() => setMode("fire")}
          >
            <span className="resIcon">&#9678;</span>FIRE
            <span className="resCount">{state.shotsAvailable}</span>
          </button>
        </div>
        <div className={`resourceWrap ${state.bombsAvailable > 0 ? "ready" : ""}`}>
          <button
            className={`resourceBtn bomb ${mode === "bomb" ? "active" : ""}`}
            onClick={() => setMode("bomb")}
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
        <div className={`resourceWrap ${state.intelAvailable > 0 ? "ready" : ""}`}>
          <button
            className={`resourceBtn intel ${mode === "intel" ? "active" : ""}`}
            onClick={() => setMode("intel")}
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
                else if (status === "hit") cls += " hit";
                else if (status === "sunk") cls += " sunk";
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
        <button className="forceRefresh" onClick={forceRefresh}>
          Refresh
        </button>
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

      {!showIntro && howToPlayOpen && (
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

      {!showIntro && !howToPlayOpen && activeModal && (
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
