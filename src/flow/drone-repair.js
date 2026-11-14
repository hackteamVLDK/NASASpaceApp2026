/**
 * DroneRepairMiniGame — the rules, without the screen.
 *
 * SCENARIO.md section 5: clicking Drone #01 opens a modal in which the player wipes Martian
 * dust off the drone's solar panel and reconnects 2 coloured wires. When both are done the
 * drone wakes.
 *
 * The scenario does not give the wire colours, how much wiping is needed, or what a wrong
 * connection does. Those are PROPOSALS here, chosen to be forgiving for a seven-year-old:
 * nothing can be failed, a wrong plug simply does not stick.
 */

/** PROPOSAL: the two wire colours, matching the game's orange and ASTRA's cyan. */
export const WIRE_COLORS = Object.freeze(['orange', 'cyan']);

/** PROPOSAL: the panel counts as clean when at least this much dust is gone. */
export const CLEAN_ENOUGH = 0.95;

/**
 * Start a repair.
 * @param {{ socketOrder?: string[] }} [options] order of the sockets left to right; pass a
 *   shuffled copy of WIRE_COLORS to make the player look before plugging.
 */
export function createDroneRepair({ droneId = 'drone-01', socketOrder = [...WIRE_COLORS].reverse() } = {}) {
  if (socketOrder.length !== WIRE_COLORS.length || !WIRE_COLORS.every((c) => socketOrder.includes(c))) {
    throw new Error('socketOrder must contain each wire colour exactly once');
  }
  return {
    droneId,
    dust: 1, // 1 = panel fully covered, 0 = spotless
    wires: WIRE_COLORS.map((color) => ({ color, connected: false })),
    sockets: socketOrder.map((color) => ({ color, filled: false })),
    wrongTries: 0,
  };
}

/** Wipe some dust away. `amount` is the fraction of the panel cleaned by this stroke. */
export function wipe(game, amount) {
  if (!(amount > 0)) return game;
  game.dust = Math.max(0, game.dust - amount);
  return game;
}

/**
 * Try to plug a wire into a socket (by socket index, left to right).
 * @returns {boolean} true if it connected. A wrong colour does nothing except count a try.
 */
export function connectWire(game, wireColor, socketIndex) {
  const wire = game.wires.find((w) => w.color === wireColor);
  const socket = game.sockets[socketIndex];
  if (!wire || !socket || wire.connected || socket.filled) return false;
  if (socket.color !== wireColor) {
    game.wrongTries += 1;
    return false;
  }
  wire.connected = true;
  socket.filled = true;
  return true;
}

export const panelClean = (game) => game.dust <= 1 - CLEAN_ENOUGH;
export const wiresConnected = (game) => game.wires.every((w) => w.connected);

/** Both tasks done: the drone can wake. The screen then sends { type: 'wakeDrone', drone } to the simulation. */
export const isRepaired = (game) => panelClean(game) && wiresConnected(game);

/** 0..1, for a progress indicator: half for the panel, half for the wires. */
export function repairProgress(game) {
  const panel = Math.min(1, (1 - game.dust) / CLEAN_ENOUGH);
  const wires = game.wires.filter((w) => w.connected).length / game.wires.length;
  return (panel + wires) / 2;
}
