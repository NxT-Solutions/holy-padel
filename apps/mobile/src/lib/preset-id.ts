/** Collision-proof local id for a saved preset — matches newMatchId()'s shape. */
let presetCounter = 0;

export function newPresetId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid !== undefined) {
    return `preset-${uuid}`;
  }
  presetCounter += 1;
  return `preset-${String(Date.now())}-${String(presetCounter)}`;
}
