import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const DEFAULT_GRID = 3;

const STORAGE_KEY = "sober_square_state";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function randFromSeed(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeArtCss(seed) {
  const r = randFromSeed(seed);

  const hue = Math.floor(r() * 360);
  const hue2 = (hue + 80 + Math.floor(r() * 160)) % 360;
  const hue3 = (hue2 + 40 + Math.floor(r() * 140)) % 360;

  const a = 0.55 + r() * 0.25; // 0.55..0.80

  const spot = (h, s, l, alpha) =>
    `radial-gradient(circle at ${r() * 100}% ${r() * 100}%, hsla(${h},${s}%,${l}%,${alpha}), transparent ${45 + r() * 25}%)`;

  const sweep = (deg, h1, h2) =>
    `conic-gradient(from ${deg}deg at ${20 + r() * 60}% ${20 + r() * 60}%, hsla(${h1},85%,55%,${a}) 0deg, hsla(${h2},85%,50%,${a}) 120deg, hsla(${h1},85%,45%,${a}) 240deg, hsla(${h2},85%,55%,${a}) 360deg)`;

  const base = `linear-gradient(${Math.floor(r() * 360)}deg, hsla(${hue},75%,14%,1), hsla(${hue2},75%,10%,1))`;

  const vignette = `radial-gradient(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 85%)`;

  const grain = `repeating-linear-gradient(
  ${Math.floor(r() * 180)}deg,
  rgba(255,255,255,0.03) 0px,
  rgba(255,255,255,0.03) 0.7px,
  rgba(0,0,0,0.03) 1.4px,
  rgba(0,0,0,0.03) 2.1px
)`;

const glaze = `radial-gradient(circle at ${20 + r() * 60}% ${15 + r() * 55}%,
  rgba(255,255,255,0.12),
  transparent 55%
)`;

const spark = () =>
  `radial-gradient(circle at ${r() * 100}% ${r() * 100}%,
    hsla(${Math.floor(r() * 360)},95%,70%,0.9),
    transparent 6%)`;

 const sparks = Array.from({ length: 18 }, spark);

 const voids = Array.from({ length: 6 }, () =>
  `radial-gradient(circle at ${r() * 100}% ${r() * 100}%,
    rgba(0,0,0,0.55),
    transparent 40%)`
);

return [
  vignette,
  grain,
  glaze,
  ...sparks,
  ...voids,
  sweep(Math.floor(r() * 360), hue2, hue3),
  spot(hue, 92, 62, 0.55),
  spot(hue2, 90, 58, 0.45),
  spot(hue3, 88, 54, 0.40),
  base,
].join(",");
}

export default function App() {
  const BUILD = import.meta.env.VITE_BUILD || "dev";
  
  function forceRefresh() {
    const url = new URL(window.location.href);
    url.searchParams.set("v", BUILD);
    url.searchParams.set("t", Date.now().toString());
    window.location.replace(url.toString());
  }
  const devMode = import.meta.env.DEV; // ON in npm run dev, OFF in npm run build

  const [modal, setModal] = useState(null);
  const shareRef = useRef(null);

  const [seed, setSeed] = useState(() => {
    const s = loadState();
    return s?.seed ?? Math.floor(Math.random() * 1e9);
  });

  const [revealed, setRevealed] = useState(() => {
    const s = loadState();
    return new Set(s?.revealed ?? []);
  });

  const [answeredNo, setAnsweredNo] = useState(() => {
    const s = loadState();
    return s?.answeredNo ?? false;
  });

  const [lastCheckDate, setLastCheckDate] = useState(() => {
    const s = loadState();
    return s?.lastCheckDate ?? null;
  });

  const [lastRevealDate, setLastRevealDate] = useState(() => {
    const s = loadState();
    return s?.lastRevealDate ?? null;
  });

const [badges, setBadges] = useState(() => {
  const s = loadState();
  return safeArray(s?.badges);
});

  const [pendingBadge, setPendingBadge] = useState(null);

  const [streakDays, setStreakDays] = useState(() => {
  const s = loadState();
  return Number.isFinite(s?.streakDays) ? s.streakDays : 0;
});

const [totalSoberDays, setTotalSoberDays] = useState(() => {
  const s = loadState();
  return Number.isFinite(s?.totalSoberDays) ? s.totalSoberDays : 0;
});

const [gridSize] = useState(() => {
  const s = loadState();
  const g = s?.gridSize;
  return Number.isFinite(g) ? g : DEFAULT_GRID;
});
const GRID = gridSize;
const TOTAL = GRID * GRID;

  const background = useMemo(() => makeArtCss(seed), [seed]);

  function showMessage(title, body) {
    setModal({
      title,
      body,
      actions: [{ label: "OK", onClick: () => setModal(null) }],
    });
  }

  function resetImage() {
    setSeed(Math.floor(Math.random() * 1e9));
    setRevealed(new Set());
    setAnsweredNo(false);
    setLastRevealDate(null);
  }

  async function shareCompletion(earned) {
    const node = shareRef.current;
    if (!node) return;

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, { cacheBust: true });

    const link = document.createElement("a");
    link.download = `sober-square-badge-${earned.number}.png`;
    link.href = dataUrl;
    link.click();
  }

  // Persist state
  useEffect(() => {
    saveState({
      seed,
      revealed: Array.from(revealed),
      answeredNo,
      lastCheckDate,
      lastRevealDate,
      badges,
      streakDays,
      totalSoberDays,
    });
  }, [seed, revealed, answeredNo, lastCheckDate, lastRevealDate, badges, streakDays, totalSoberDays]);

  // Daily check-in modal blocks the app until answered
  useEffect(() => {
    const today = todayKey();

    if (lastCheckDate !== today) {
      setAnsweredNo(false);

      setModal({
        title: "Daily check-in",
        body: "Did you drink yesterday?",
        actions: [
          {
            label: "Yes (reset)",
            onClick: () => {
              setLastCheckDate(today);
              setStreakDays(0);
              resetImage();
              setModal(null);
            },
          },
          {
            label: "No",
            onClick: () => {
              setLastCheckDate(today);
              setAnsweredNo(true);
              setStreakDays((d) => d + 1);
              setTotalSoberDays((d) => d + 1);
              setModal(null);
            },
          },
        ],
      });
    }
  }, [lastCheckDate]);

  // Completion -> earn badge -> share or next
  useEffect(() => {
    if (revealed.size === TOTAL && !pendingBadge) {
      const earned = {
        id: `${todayKey()}-${seed}-${badges.length + 1}`,
        number: safeArray(badges).length + 1,
        date: todayKey(),
        seed,
      };

      setPendingBadge(earned);

      setModal({
        title: "Image completed 🎉",
        body: `Badge #${earned.number} earned • ${totalSoberDays} days alcohol-free`,
        actions: [
          {
            label: "Share",
            onClick: async () => {
              setBadges((prev) => [earned, ...safeArray(prev)]);
              await shareCompletion(earned);
              setPendingBadge(null);
              resetImage();
              setModal(null);
            },
          },
          {
            label: "Next image",
            onClick: () => {
              setBadges((prev) => [earned, ...safeArray(prev)]);
              setPendingBadge(null);
              resetImage();
              setModal(null);
            },
          },
        ],
      });
    }
  }, [revealed, pendingBadge, badges.length, seed]);

  function revealCell(i) {
    const today = todayKey();

    if (lastCheckDate !== today) {
      showMessage("Answer required", "Please complete today's check-in first.");
      return;
    }

    if (!answeredNo) {
      showMessage("Not unlocked", "You answered Yes today, so the image reset.");
      return;
    }

    if (lastRevealDate === today) {
      showMessage("Come back tomorrow", "You've already revealed a square today.");
      return;
    }

    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });

    setLastRevealDate(today);
    showMessage("Nice.", "Square revealed. See you tomorrow.");
  }

  return (
    <div className="page">
      <h1>Sober Square</h1>
      <div className="buildLabel">Build {BUILD}</div>

      <p>Streak: {streakDays} days</p>
      <p>Total alcohol-free days: {totalSoberDays}</p>
      <p>Badges: {badges.length}</p>
      
      <button onClick={forceRefresh} style={{ marginTop: 8 }}>
      Refresh
      </button>

      {devMode && (
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() =>
              setRevealed(new Set(Array.from({ length: TOTAL }, (_, i) => i)))
            }
          >
            Dev: Complete image
          </button>
          <button onClick={() => resetImage()}>Dev: Reset image</button>
          <button
            onClick={() => {
              // Force the daily check-in modal to show again for testing
              setLastCheckDate("1900-01-01");
            }}
          >
            Dev: Show check-in
          </button>
        </div>
      )}

      <div className="art" style={{ backgroundImage: background }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${GRID}, 1fr)`,
            gridTemplateRows: `repeat(${GRID}, 1fr)`,
          }}
        >
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              className={revealed.has(i) ? "cell revealed" : "cell"}
              onClick={() => revealCell(i)}
              aria-label={`square ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <p>
        {revealed.size}/{TOTAL} squares revealed
      </p>

      {modal && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>{modal.title}</h2>
            <p>{modal.body}</p>
            <div className="modalActions">
              {modal.actions.map((a, idx) => (
                <button key={idx} onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden share card used for PNG export */}
      <div className="shareCardWrapper">
        <div
          className="shareCard"
          ref={shareRef}
          style={{ backgroundImage: background }}
        >
          <div className="shareOverlay">
            <div className="shareTitle">Sober Square</div>
            <div className="shareSub">
              Badge #{pendingBadge ? pendingBadge.number : badges.length + 1}
            </div>
                        <div className="shareSmall">
              {GRID * GRID} days. One image revealed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
