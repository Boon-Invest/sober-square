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
} from "./game/engine";
import { todayKey } from "./game/utils";
import { playHit, playMiss, playBoom, playPing, playEventSounds } from "./game/sound";
import { shareProgress } from "./game/share";
import ShipIcon from "./components/ShipIcon";

const STORAGE_KEY = "sober_square_battleship_v1";

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
  const BUILD = __BUILD_DATE__;

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

  function commit(next) {
    persist(next);
    if (next.events && next.events.length) {
      pushToasts(next.events);
      playEventSounds(next.events);
      if (next.events.some((e) => e.includes("streak record"))) {
        setShowRecordShare(true);
      }
    }
    return next;
  }

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
          title: "Anything to note?",
          body: "Optional — jot down what happened. It's saved to your history, just for you.",
          isReflection: true,
        };
      }
      return {
        title: "Daily check-in",
        body: "Did you drink yesterday?",
        actions: [
          { label: "Yes, I drank", onClick: () => setReflectionOpen(true) },
          { label: "No, stayed sober", onClick: () => commitCheckIn(true) },
        ],
      };
    }
    if (state.status === "won") {
      return {
        title: "Fleet destroyed! 🎉",
        body: `You sank every ship with ${60 - state.daysElapsed} day(s) to spare.`,
        actions: [
          { label: "Start new game", onClick: () => commit(startNewGame(state)) },
        ],
      };
    }
    if (state.status === "lost") {
      return {
        title: "Fleet not destroyed",
        body: "60 days are up and enemy ships are still out there. Game over.",
        actions: [
          { label: "Start new game", onClick: () => commit(startNewGame(state)) },
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
        showToast("No shots left. Stay sober to earn another guess.");
        return;
      }
      const next = fireShot(state, i);
      commit(next);
      if (next.cellStatus[i] === "hit") playHit();
      else if (next.cellStatus[i] === "miss") playMiss();
    } else if (mode === "bomb") {
      if (state.bombsAvailable <= 0) {
        showToast("No bombs charged. Reach another 7-day streak to earn one.");
        return;
      }
      commit(detonateBomb(state, i));
      playBoom();
    } else if (mode === "intel") {
      if (state.intelAvailable <= 0) {
        showToast("No intel charges. Reach another 21-day streak to earn one.");
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
    if (result === "copied") showToast("Share text copied to your clipboard!");
    else if (result === "unsupported") showToast("Sharing isn't supported on this browser.");
    setShowRecordShare(false);
  }

  const daysRemaining = 60 - state.daysElapsed;
  const bombProgress = state.streakDays % 7;
  const intelProgress = state.streakDays % 21;
  const tensionClass = daysRemaining <= 5 ? " critical" : daysRemaining <= 14 ? " tense" : "";

  return (
    <div className="page">
      <h1>Sober Square</h1>
      <p className="subtitle">Battleship: find the fleet within 60 days</p>

      <div className="statsGrid">
        <div className="statCard">
          <span className="statLabel">Current streak</span>
          <span className="statValue">{state.streakDays}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Highest streak</span>
          <span className="statValue">{state.highestStreak}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Total alcohol-free</span>
          <span className="statValue">{state.totalSoberDays}d</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Days remaining</span>
          <span className="statValue">{Math.max(0, daysRemaining)}/60</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Ships sunk (lifetime)</span>
          <span className="statValue">{state.lifetimeShipsSunk}</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Fleets defeated</span>
          <span className="statValue">{state.gamesWon}</span>
        </div>
      </div>

      <div className="utilityRow">
        <button className="utilityBtn" onClick={() => setHistoryOpen(true)}>
          History
        </button>
        <button className="utilityBtn" onClick={handleShare}>
          Share progress
        </button>
      </div>

      {showRecordShare && (
        <div className="recordBanner">
          <span>New streak record! Tell someone about it.</span>
          <div className="recordBannerActions">
            <button onClick={handleShare}>Share</button>
            <button onClick={() => setShowRecordShare(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="resourceRow">
        <button
          className={`resourceBtn ${mode === "fire" ? "active" : ""}`}
          onClick={() => setMode("fire")}
        >
          Fire ({state.shotsAvailable})
        </button>
        <button
          className={`resourceBtn ${mode === "bomb" ? "active" : ""}`}
          onClick={() => setMode("bomb")}
          disabled={state.bombsAvailable <= 0}
        >
          Bomb ({state.bombsAvailable}) &middot; {bombProgress}/7
        </button>
        <button
          className={`resourceBtn ${mode === "intel" ? "active" : ""}`}
          onClick={() => setMode("intel")}
          disabled={state.intelAvailable <= 0}
        >
          Intel ({state.intelAvailable}) &middot; {intelProgress}/21
        </button>
      </div>
      <p className="modeHint">
        {mode === "fire" && "Tap a hidden square to fire a single shot."}
        {mode === "bomb" && "Tap a square to detonate a 5-cell cross around it."}
        {mode === "intel" && "Tap a square to reveal the 3x3 area around it (no damage)."}
      </p>

      <div className={`board${tensionClass}`}>
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
            if (status === "hidden") cls += " fog";
            else if (status === "spotted") cls += " spotted";
            else if (status === "hit") cls += " hit";
            else if (status === "sunk") cls += " sunk";
            else cls += isLand ? " land" : " water";
            if (status !== "hidden" && isLand && isGreenery) cls += " greenery";

            return (
              <button
                key={i}
                className={cls}
                onClick={() => handleCellClick(i)}
                aria-label={`row ${rowOf(i) + 1} column ${colOf(i) + 1}`}
              />
            );
          })}
        </div>
      </div>

      <div className="legend">
        <span><i className="swatch fog" /> Fog</span>
        <span><i className="swatch water" /> Water</span>
        <span><i className="swatch land" /> Land</span>
        <span><i className="swatch hit" /> Hit</span>
        <span><i className="swatch sunk" /> Sunk</span>
        <span><i className="swatch spotted" /> Sighted</span>
      </div>

      <div className="fleetList">
        <h2>Fleet</h2>
        {state.ships.map((ship) => (
          <div key={ship.id} className="fleetRow">
            <span className="fleetName">{ship.name}</span>
            <ShipIcon size={ship.size} hitCount={ship.hits.length} sunk={ship.sunk} />
            <span className="fleetStatus">
              {ship.sunk ? "Sunk" : `${ship.hits.length}/${ship.size} hit`}
            </span>
          </div>
        ))}
      </div>

      <div className="footerRow">
        <button className="forceRefresh" onClick={forceRefresh}>
          Refresh
        </button>
        <div className="buildLabel">Build {BUILD}</div>
      </div>

      <div className="toastStack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.msg}
          </div>
        ))}
      </div>

      {activeModal && (
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
                  <button onClick={() => finishReflection(false)}>Skip</button>
                  <button onClick={() => finishReflection(true)}>Save</button>
                </div>
              </>
            ) : (
              <div className="modalActions">
                {activeModal.actions.map((a, idx) => (
                  <button key={idx} onClick={a.onClick}>
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
            <h2>Reflection history</h2>
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
              <button onClick={() => setHistoryOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
