import {
  TOTAL,
  rowOf,
  crossCells,
  block3x3,
  randomBlock3x3,
  generateBoard,
  placeShip,
} from "./board";
import { SHIP_DEFS } from "./ships";
import { todayKey } from "./utils";
import { BOMB_MILESTONES, INTEL_MILESTONES } from "./milestones";

const SHOOTABLE = new Set(["hidden", "spotted"]);
const SOBER_DAY_LOOT_CHANCE = 0.15;
const LAND_HIT_LOOT_CHANCE = 0.33;
const LOOT_TYPES = ["shots", "bomb", "intel", "autohit", "spot", "rowIntel"];
const SHOT_LOOT_AMOUNTS = [1, 2, 3, 5];

// Onboarding sequence for a brand-new player only. tutorialStep 0..3 each
// show one guided popup; TUTORIAL_DONE means the sequence has finished (or,
// for any pre-existing save that predates this feature, is treated as
// already finished -- see hydrateState below).
export const TUTORIAL_DONE = 6;

function findShipAt(ships, cellIdx) {
  return ships.find((s) => !s.sunk && s.cells.includes(cellIdx));
}

function cloneState(state) {
  return {
    ...state,
    ships: state.ships.map((s) => ({ ...s, cells: s.cells, hits: [...s.hits] })),
    cellStatus: [...state.cellStatus],
    journal: [...(state.journal ?? [])],
    flags: [...(state.flags ?? [])],
    checkInHistory: [...(state.checkInHistory ?? [])],
    events: [],
    lootResult: null,
  };
}

// Fields that live on the player's profile and survive a "New Game" reset,
// as opposed to the current board/fleet which gets regenerated.
export function newGameState(prevProfile) {
  const { land, greenery, ships } = generateBoard(SHIP_DEFS);
  return {
    land,
    greenery,
    ships,
    cellStatus: Array(TOTAL).fill("hidden"),
    streakDays: prevProfile?.streakDays ?? 0,
    highestStreak: prevProfile?.highestStreak ?? 0,
    totalSoberDays: prevProfile?.totalSoberDays ?? 0,
    lastCheckDate: prevProfile?.lastCheckDate ?? null,
    lastShareBonusDate: prevProfile?.lastShareBonusDate ?? null,
    pwaBonusClaimed: prevProfile?.pwaBonusClaimed ?? false,
    notifBonusClaimed: prevProfile?.notifBonusClaimed ?? false,
    recordBonusPending: prevProfile?.recordBonusPending ?? false,
    lifetimeShipsSunk: prevProfile?.lifetimeShipsSunk ?? 0,
    gamesWon: prevProfile?.gamesWon ?? 0,
    gamesLost: prevProfile?.gamesLost ?? 0,
    journal: prevProfile?.journal ?? [],
    // Only a true first-ever player (prevProfile === null) starts the
    // onboarding sequence; a returning player starting a fresh game after a
    // win/loss carries over their already-finished tutorialStep.
    tutorialStep: prevProfile?.tutorialStep ?? 0,
    gameMode: prevProfile?.gameMode ?? "sobriety",
    daysElapsed: 0,
    shotsAvailable: 0,
    bombsAvailable: 0,
    intelAvailable: 0,
    status: "playing",
    flags: [],
    checkInHistory: prevProfile?.checkInHistory ?? [],
    events: [],
    lootResult: null,
  };
}

// Fills in defaults for fields added in later versions so older saves
// (and progress) keep working without a storage-key bump.
export function hydrateState(loaded) {
  if (!loaded) return null;
  return {
    ...loaded,
    journal: Array.isArray(loaded.journal) ? loaded.journal : [],
    lifetimeShipsSunk: Number.isFinite(loaded.lifetimeShipsSunk) ? loaded.lifetimeShipsSunk : 0,
    gamesWon: Number.isFinite(loaded.gamesWon) ? loaded.gamesWon : 0,
    gamesLost: Number.isFinite(loaded.gamesLost) ? loaded.gamesLost : 0,
    recordBonusPending: Boolean(loaded.recordBonusPending),
    lastShareBonusDate: loaded.lastShareBonusDate ?? null,
    pwaBonusClaimed: Boolean(loaded.pwaBonusClaimed),
    notifBonusClaimed: Boolean(loaded.notifBonusClaimed),
    tutorialStep: Number.isFinite(loaded.tutorialStep) ? loaded.tutorialStep : TUTORIAL_DONE,
    gameMode: loaded.gameMode || "sobriety",
    flags: Array.isArray(loaded.flags) ? loaded.flags : [],
    checkInHistory: Array.isArray(loaded.checkInHistory) ? loaded.checkInHistory : [],
    events: [],
    lootResult: null,
  };
}

export function startNewGame(state) {
  return newGameState(state);
}

// Onboarding: advance to a specific tutorial step with no side effects
// (used for the steps that are just informational, no resource grant).
export function advanceTutorialStep(state, toStep) {
  const next = cloneState(state);
  next.tutorialStep = toStep;
  return next;
}

// Onboarding step 1 -> 2: hand a brand-new player one of each resource so
// they have something to try Fire/Bomb/Intel with right away.
export function grantTutorialStarterKit(state) {
  const next = cloneState(state);
  next.shotsAvailable = Math.max(next.shotsAvailable, 1);
  next.bombsAvailable = Math.max(next.bombsAvailable, 1);
  next.intelAvailable = Math.max(next.intelAvailable, 1);
  next.tutorialStep = 3;
  return next;
}

// Onboarding step 3 -> 4: a few more shots to keep a new player hunting.
export function grantTutorialBonusShots(state) {
  const next = cloneState(state);
  next.shotsAvailable += 5;
  next.tutorialStep = 4;
  return next;
}

// Sharing progress earns a bonus shot, capped once per calendar day.
// There's no way for a website to know who a native share sheet was sent
// to, so this can't verify "a new friend" -- it's an honest once-a-day
// nudge, not an anti-abuse system.
export function setGameMode(state, mode) {
  const next = cloneState(state);
  next.gameMode = mode;
  return next;
}

export function toggleFlag(state, cellIdx) {
  if (state.cellStatus[cellIdx] !== "hidden") return state;
  const next = cloneState(state);
  next.flags = [...(state.flags || [])];
  const i = next.flags.indexOf(cellIdx);
  if (i >= 0) {
    next.flags.splice(i, 1);
  } else {
    next.flags.push(cellIdx);
  }
  return next;
}

export function claimShareBonus(state) {
  const today = todayKey();
  const next = cloneState(state);

  if (state.lastShareBonusDate === today) {
    next.events.push("You've already claimed today's share bonus. Come back tomorrow!");
    return next;
  }

  next.lastShareBonusDate = today;
  next.shotsAvailable += 1;
  next.events.push("Thanks for sharing! +1 shot.");
  return next;
}

// One-time bonus for adding the app to the home screen. There's no install
// event on iOS Safari, so this is claimed the moment we ever detect the app
// running in standalone display mode -- see isStandalonePwa() in platform.js.
export function claimPwaInstallBonus(state) {
  if (state.pwaBonusClaimed) return state;

  const next = cloneState(state);
  next.pwaBonusClaimed = true;
  next.shotsAvailable += 1;
  next.events.push("Thanks for adding Sober Square to your home screen! +1 shot.");
  return next;
}

export function claimNotifBonus(state) {
  if (state.notifBonusClaimed) return state;

  const next = cloneState(state);
  next.notifBonusClaimed = true;
  next.shotsAvailable += 1;
  next.events.push("Daily reminders enabled! +1 shot for staying accountable.");
  return next;
}

function applyHitAt(next, cellIdx) {
  next.flags = next.flags.filter((f) => f !== cellIdx);
  const isLand = next.land.includes(cellIdx);
  const ship = !isLand ? findShipAt(next.ships, cellIdx) : null;

  if (!ship) {
    next.cellStatus[cellIdx] = "miss";
    if (isLand) {
      rollLootBox(next, LAND_HIT_LOOT_CHANCE);
    }
    return { hit: false, isLand };
  }

  ship.hits = [...ship.hits, cellIdx];
  if (ship.hits.length >= ship.size) {
    ship.sunk = true;
    for (const c of ship.cells) next.cellStatus[c] = "sunk";
    next.lifetimeShipsSunk = (next.lifetimeShipsSunk ?? 0) + 1;
    next.events.push(`${ship.name} sunk!`);
  } else {
    next.cellStatus[cellIdx] = "hit";
  }
  return { hit: true, isLand: false };
}

function checkWin(next) {
  if (next.ships.every((s) => s.sunk)) next.status = "won";
}

// Loot box: triggered either by chance on a sober check-in day, or by
// chance whenever a shot/bomb lands on land. Six possible rewards, chosen
// uniformly; `lootResult` is a transient (non-persisted-meaningfully) field
// the UI reads once to show a dedicated popup and flash the relevant button.
function rollLootBox(next, chance) {
  if (Math.random() >= chance) return;

  const type = LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)];

  if (type === "shots") {
    const amount = SHOT_LOOT_AMOUNTS[Math.floor(Math.random() * SHOT_LOOT_AMOUNTS.length)];
    next.shotsAvailable += amount;
    const label = `+${amount} Shot${amount > 1 ? "s" : ""}`;
    next.events.push(`Loot box found: ${label}!`);
    next.lootResult = { type: "shots", label, flashTarget: "fire" };
    return;
  }

  if (type === "bomb") {
    next.bombsAvailable += 1;
    next.events.push("Loot box found: +1 Bomb!");
    next.lootResult = { type: "bomb", label: "+1 Bomb", flashTarget: "bomb" };
    return;
  }

  if (type === "intel") {
    next.intelAvailable += 1;
    next.events.push("Loot box found: +1 Intel Charge!");
    next.lootResult = { type: "intel", label: "+1 Intel Charge", flashTarget: "intel" };
    return;
  }

  if (type === "autohit") {
    const cell = pickRandomUndiscoveredShipCell(next);
    if (cell === null) {
      next.shotsAvailable += 1;
      next.events.push("Loot box found: +1 Shot!");
      next.lootResult = { type: "shots", label: "+1 Shot", flashTarget: "fire" };
      return;
    }
    applyHitAt(next, cell);
    checkWin(next);
    next.events.push("Loot box found: recon radioed in a free confirmed hit!");
    next.lootResult = { type: "autohit", label: "Free Confirmed Hit!", flashTarget: "fire" };
    return;
  }

  if (type === "spot") {
    const cell = pickRandomUndiscoveredShipCell(next);
    if (cell === null) {
      next.shotsAvailable += 1;
      next.events.push("Loot box found: +1 Shot!");
      next.lootResult = { type: "shots", label: "+1 Shot", flashTarget: "fire" };
      return;
    }
    next.cellStatus[cell] = "spotted";
    next.events.push("Loot box found: a ship has been spotted on the board!");
    next.lootResult = { type: "spot", label: "Ship Spotted!", flashTarget: "fire" };
    return;
  }

  // rowIntel
  const cell = pickRandomUndiscoveredShipCell(next);
  if (cell === null) {
    next.shotsAvailable += 1;
    next.events.push("Loot box found: +1 Shot!");
    next.lootResult = { type: "shots", label: "+1 Shot", flashTarget: "fire" };
    return;
  }
  next.cellStatus[cell] = "spotted";
  const rowLetter = String.fromCharCode(65 + rowOf(cell));
  next.events.push(`Loot box found: intelligence report - a vessel in row ${rowLetter}!`);
  next.lootResult = { type: "rowIntel", label: `Vessel spotted in row ${rowLetter}`, flashTarget: "fire" };
}

export function fireShot(state, cellIdx) {
  if (state.status !== "playing") return state;
  if (state.shotsAvailable <= 0) return state;
  if (!SHOOTABLE.has(state.cellStatus[cellIdx])) return state;

  const next = cloneState(state);
  next.shotsAvailable -= 1;

  const { hit } = applyHitAt(next, cellIdx);
  if (hit) next.shotsAvailable += 1; // chain: a hit refunds the shot

  checkWin(next);
  return next;
}

export function detonateBomb(state, centerIdx) {
  if (state.status !== "playing") return state;
  if (state.bombsAvailable <= 0) return state;

  const next = cloneState(state);
  next.bombsAvailable -= 1;

  for (const cellIdx of crossCells(centerIdx)) {
    if (!SHOOTABLE.has(next.cellStatus[cellIdx])) continue;
    applyHitAt(next, cellIdx);
  }

  checkWin(next);
  return next;
}

export function revealIntel(state, centerIdx) {
  if (state.status !== "playing") return state;
  if (state.intelAvailable <= 0) return state;

  const next = cloneState(state);
  next.intelAvailable -= 1;

  for (const cellIdx of block3x3(centerIdx)) {
    if (next.cellStatus[cellIdx] !== "hidden") continue;
    next.flags = next.flags.filter((f) => f !== cellIdx);
    const isLand = next.land.includes(cellIdx);
    const ship = !isLand ? findShipAt(next.ships, cellIdx) : null;
    next.cellStatus[cellIdx] = ship ? "spotted" : "miss";
  }

  return next;
}

// Rule 6: on a relapse day (and only a relapse day -- a sober day never
// triggers this), a 3x3 patch of fog rolls back in, deliberately hunting a
// damaged-but-not-sunk ship if one exists (guaranteed target).
function applyFogEvent(next) {
  const damagedShips = next.ships.filter((s) => !s.sunk && s.hits.length > 0);

  let block;
  if (damagedShips.length > 0) {
    const target = damagedShips[Math.floor(Math.random() * damagedShips.length)];
    const anchor = target.cells[Math.floor(Math.random() * target.cells.length)];
    block = block3x3(anchor);
  } else {
    block = randomBlock3x3();
  }

  for (const cellIdx of block) {
    if (next.cellStatus[cellIdx] !== "sunk") {
      next.cellStatus[cellIdx] = "hidden";
    }
  }

  const blockSet = new Set(block);

  for (const ship of next.ships) {
    if (ship.sunk || ship.hits.length === 0) continue;
    if (!ship.cells.some((c) => blockSet.has(c))) continue;

    for (const c of ship.cells) next.cellStatus[c] = "hidden";

    const otherShipCells = new Map();
    for (const other of next.ships) {
      if (other.id === ship.id) continue;
      for (const c of other.cells) otherShipCells.set(c, other.id);
    }

    const hiddenMask = new Set();
    next.cellStatus.forEach((st, i) => {
      if (st === "hidden") hiddenMask.add(i);
    });

    const newCells = placeShip(ship.size, new Set(next.land), otherShipCells, hiddenMask);
    if (newCells) ship.cells = newCells;
    ship.hits = [];
  }
}

function pickRandomUndiscoveredShipCell(next) {
  const candidates = [];
  for (const ship of next.ships) {
    if (ship.sunk) continue;
    for (const c of ship.cells) {
      if (!ship.hits.includes(c)) candidates.push(c);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function applyCheckIn(state, answeredSober, note, drinkCount) {
  const today = todayKey();
  if (state.lastCheckDate === today) return state;

  const isReduction = state.gameMode === "reduction";
  const actualDrinks = isReduction
    ? (drinkCount ?? (answeredSober ? 0 : 1))
    : (answeredSober ? 0 : 1);
  const isSober = actualDrinks === 0;

  const next = cloneState(state);
  next.lastCheckDate = today;
  next.checkInHistory = [
    ...next.checkInHistory,
    { date: today, sober: isSober, drinkCount: actualDrinks },
  ];

  if (next.recordBonusPending) {
    next.shotsAvailable = Math.max(0, next.shotsAvailable - 1);
    next.recordBonusPending = false;
  }

  if (isSober) {
    next.streakDays += 1;
    next.totalSoberDays += 1;
    next.shotsAvailable += isReduction ? 3 : 1;

    if (next.streakDays > next.highestStreak) {
      next.highestStreak = next.streakDays;
      next.shotsAvailable += 1;
      next.recordBonusPending = true;
      next.events.push("New streak record! Bonus shot earned for today.");
    }

    if (BOMB_MILESTONES.includes(next.streakDays)) {
      next.bombsAvailable += 1;
      next.events.push(`Day ${next.streakDays} streak! A bomb charge is ready.`);
    }
    if (INTEL_MILESTONES.includes(next.streakDays)) {
      next.intelAvailable += 1;
      next.events.push(`Day ${next.streakDays} streak! An intel charge is ready.`);
    }

    rollLootBox(next, SOBER_DAY_LOOT_CHANCE);
  } else {
    if (isReduction) {
      if (actualDrinks === 1) next.shotsAvailable += 2;
      else if (actualDrinks === 2) next.shotsAvailable += 1;
    }

    next.journal = [
      { date: today, streakBefore: state.streakDays, note: note || "", drinkCount: actualDrinks },
      ...next.journal,
    ];
    next.streakDays = 0;
  }

  if (state.status === "playing") {
    next.daysElapsed = Math.min(60, next.daysElapsed + 1);
    const fogTriggered = isReduction ? actualDrinks >= 3 : !isSober;
    if (fogTriggered) {
      applyFogEvent(next);
    }
    checkWin(next);
    if (next.status === "won") {
      next.gamesWon += 1;
      next.events.push("Victory! The fleet is destroyed.");
    } else if (next.daysElapsed >= 60) {
      next.status = "lost";
      next.gamesLost += 1;
      next.events.push("60 days are up. The fleet got away this time.");
    }
  }

  return next;
}
