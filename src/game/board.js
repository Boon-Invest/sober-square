export const GRID = 15;
export const TOTAL = GRID * GRID;

export function idx(row, col) {
  return row * GRID + col;
}

export function rowOf(i) {
  return Math.floor(i / GRID);
}

export function colOf(i) {
  return i % GRID;
}

export function inBounds(row, col) {
  return row >= 0 && row < GRID && col >= 0 && col < GRID;
}

export function neighbors8(i) {
  const r = rowOf(i);
  const c = colOf(i);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) out.push(idx(nr, nc));
    }
  }
  return out;
}

// 5-cell plus/cross shape used by bombs. Clips at the edges.
export function crossCells(i) {
  const r = rowOf(i);
  const c = colOf(i);
  const deltas = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const out = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) out.push(idx(nr, nc));
  }
  return out;
}

// Always-9-cell 3x3 block, clamped inward so it never runs off the board.
export function block3x3(centerIdx) {
  const cr = rowOf(centerIdx);
  const cc = colOf(centerIdx);
  const topRow = Math.min(Math.max(cr - 1, 0), GRID - 3);
  const topCol = Math.min(Math.max(cc - 1, 0), GRID - 3);
  const out = [];
  for (let r = topRow; r < topRow + 3; r++) {
    for (let c = topCol; c < topCol + 3; c++) {
      out.push(idx(r, c));
    }
  }
  return out;
}

export function randomBlock3x3() {
  const topRow = Math.floor(Math.random() * (GRID - 2));
  const topCol = Math.floor(Math.random() * (GRID - 2));
  const out = [];
  for (let r = topRow; r < topRow + 3; r++) {
    for (let c = topCol; c < topCol + 3; c++) {
      out.push(idx(r, c));
    }
  }
  return out;
}

// Generates ~30% land as rectangular island blocks (easy to reason about).
export function generateLand() {
  const targetCount = Math.round(TOTAL * 0.30);
  const land = new Set();
  let guard = 0;

  while (land.size < targetCount && guard < 500) {
    guard++;
    const w = 2 + Math.floor(Math.random() * 4);
    const h = 2 + Math.floor(Math.random() * 3);
    const startR = 1 + Math.floor(Math.random() * (GRID - h - 1));
    const startC = 1 + Math.floor(Math.random() * (GRID - w - 1));

    for (let r = startR; r < startR + h; r++) {
      for (let c = startC; c < startC + w; c++) {
        const isCorner =
          (r === startR || r === startR + h - 1) &&
          (c === startC || c === startC + w - 1);
        if (isCorner && Math.random() < 0.15) continue;
        land.add(idx(r, c));
      }
    }
  }

  return land;
}

export function generateGreenery(land) {
  const greenery = new Set();
  for (const i of land) {
    if (Math.random() < 0.22) greenery.add(i);
  }
  return greenery;
}

function shipCandidateCells(size, orientation, startIdx) {
  const r = rowOf(startIdx);
  const c = colOf(startIdx);
  const cells = [];
  for (let k = 0; k < size; k++) {
    const rr = orientation === "H" ? r : r + k;
    const cc = orientation === "H" ? c + k : c;
    if (!inBounds(rr, cc)) return null;
    cells.push(idx(rr, cc));
  }
  return cells;
}

// land: Set of land indices
// shipCellsMap: Map<idx, shipId> for every OTHER ship already placed
// allowedMask: optional Set<idx> the candidate ship's cells must all fall within (used for relocation)
export function canPlaceShip(cells, land, shipCellsMap, allowedMask) {
  for (const c of cells) {
    if (land.has(c)) return false;
    if (shipCellsMap.has(c)) return false;
    if (allowedMask && !allowedMask.has(c)) return false;

    for (const n of neighbors8(c)) {
      if (shipCellsMap.has(n) && !cells.includes(n)) return false;
    }
  }
  return true;
}

export function placeShip(size, land, shipCellsMap, allowedMask, maxTries = 3000) {
  for (let t = 0; t < maxTries; t++) {
    const orientation = Math.random() < 0.5 ? "H" : "V";
    const startIdx = Math.floor(Math.random() * TOTAL);
    const cells = shipCandidateCells(size, orientation, startIdx);
    if (!cells) continue;
    if (canPlaceShip(cells, land, shipCellsMap, allowedMask)) return cells;
  }
  return null;
}

function placeAllShips(land, shipDefs) {
  const ships = [];
  const shipCellsMap = new Map();
  let idCounter = 0;

  for (const def of shipDefs) {
    for (let n = 0; n < def.count; n++) {
      const cells = placeShip(def.size, land, shipCellsMap, null);
      if (!cells) return null;

      const id = `${def.key}-${idCounter++}`;
      for (const c of cells) shipCellsMap.set(c, id);
      ships.push({ id, name: def.name, size: def.size, cells, hits: [], sunk: false });
    }
  }

  return ships;
}

export function generateBoard(shipDefs) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const land = generateLand();
    const ships = placeAllShips(land, shipDefs);
    if (ships) {
      const greenery = generateGreenery(land);
      return { land: Array.from(land), greenery: Array.from(greenery), ships };
    }
  }
  throw new Error("Failed to generate board after 50 attempts");
}
