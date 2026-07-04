import {
  TOTAL,
  crossCells,
  block3x3,
  randomBlock3x3,
  generateBoard,
  placeShip,
} from "./board";
import { SHIP_DEFS } from "./ships";
import { todayKey } from "./utils";

const SHOOTABLE = new Set(["hidden", "spotted"]);
const SURPRISE_BONUS_CHANCE = 0.15;

function findShipAt(ships, cellIdx) {
  return ships.find((s) => !s.sunk && s.cells.includes(cellIdx));
}

function cloneState(state) {
  return {
    ...state,
    ships: state.ships.map((s) => ({ ...s, cells: s.cells, hits: [...s.hits] })),
    cellStatus: [...state.cellStatus],
    journal: [...(state.journal ?? [])],
    events: [],
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
    recordBonusPending: prevProfile?.recordBonusPending ?? false,
    lifetimeShipsSunk: prevProfile?.lifetimeShipsSunk ?? 0,
    gamesWon: prevProfile?.gamesWon ?? 0,
    gamesLost: prevProfile?.gamesLost ?? 0,
    journal: prevProfile?.journal ?? [],
    daysElapsed: 0,
    shotsAvailable: 0,
    bombsAvailable: 0,
    intelAvailable: 0,
    status: "playing",
    events: [],
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
    events: [],
  };
}

export function startNewGame(state) {
  return newGameState(state);
}

function applyHitAt(next, cellIdx) {
  const isLand = next.land.includes(cellIdx);
  const ship = !isLand ? findShipAt(next.ships, cellIdx) : null;

  if (!ship) {
    next.cellStatus[cellIdx] = "miss";
    return { hit: false };
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
  return { hit: true };
}

function checkWin(next) {
  if (next.ships.every((s) => s.sunk)) next.status = "won";
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
    const isLand = next.land.includes(cellIdx);
    const ship = !isLand ? findShipAt(next.ships, cellIdx) : null;
    next.cellStatus[cellIdx] = ship ? "spotted" : "miss";
  }

  return next;
}

// Rule 6: on every sober day (and, per clarification, on a relapse day too),
// a random 3x3 patch of fog rolls back in. If it catches a damaged-but-not-sunk
// ship, that ship redeploys to a fresh hidden spot and its damage is wiped.
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

// A random, delightful "supply drop" on some sober days: an extra shot,
// a bomb, an intel charge, or a free confirmed hit somewhere on the fleet.
function rollSurpriseBonus(next) {
  if (Math.random() >= SURPRISE_BONUS_CHANCE) return;

  const options = ["shot", "bomb", "intel", "autohit"];
  const choice = options[Math.floor(Math.random() * options.length)];

  if (choice === "shot") {
    next.shotsAvailable += 1;
    next.events.push("Surprise supply drop: +1 shot.");
  } else if (choice === "bomb") {
    next.bombsAvailable += 1;
    next.events.push("Surprise supply drop: +1 bomb.");
  } else if (choice === "intel") {
    next.intelAvailable += 1;
    next.events.push("Surprise supply drop: +1 intel charge.");
  } else {
    const cell = pickRandomUndiscoveredShipCell(next);
    if (cell === null) {
      next.shotsAvailable += 1;
      next.events.push("Surprise supply drop: +1 shot.");
    } else {
      applyHitAt(next, cell);
      next.events.push("Recon radioed in a confirmed hit, free of charge!");
      checkWin(next);
    }
  }
}

export function applyCheckIn(state, answeredSober, note) {
  const today = todayKey();
  if (state.lastCheckDate === today) return state;

  const next = cloneState(state);
  next.lastCheckDate = today;

  // A streak-record bonus shot only lives for the day it was earned.
  if (next.recordBonusPending) {
    next.shotsAvailable = Math.max(0, next.shotsAvailable - 1);
    next.recordBonusPending = false;
  }

  if (answeredSober) {
    next.streakDays += 1;
    next.totalSoberDays += 1;
    next.shotsAvailable += 1;

    if (next.streakDays > next.highestStreak) {
      next.highestStreak = next.streakDays;
      next.shotsAvailable += 1;
      next.recordBonusPending = true;
      next.events.push("New streak record! Bonus shot earned for today.");
    }

    if (next.streakDays % 7 === 0) {
      next.bombsAvailable += 1;
      next.events.push("7-day streak! A bomb charge is ready.");
    }
    if (next.streakDays % 21 === 0) {
      next.intelAvailable += 1;
      next.events.push("21-day streak! An intel charge is ready.");
    }

    rollSurpriseBonus(next);
  } else {
    next.journal = [
      { date: today, streakBefore: state.streakDays, note: note || "" },
      ...next.journal,
    ];
    next.streakDays = 0;
  }

  if (state.status === "playing") {
    next.daysElapsed = Math.min(60, next.daysElapsed + 1);
    applyFogEvent(next);
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
