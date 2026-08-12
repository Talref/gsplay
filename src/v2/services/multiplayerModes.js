const MULTIPLAYER_MODES = [
  { id: 'multiplayer', label: 'Multiplayer', sourceValues: ['Multiplayer'] },
  { id: 'co_op', label: 'Co-op', sourceValues: ['Co-operative', 'Co-op', 'Cooperative'] },
  { id: 'split_screen', label: 'Schermo condiviso', sourceValues: ['Split screen', 'Split-screen'] },
  {
    id: 'mmo',
    label: 'MMO',
    sourceValues: ['Massively Multiplayer Online (MMO)', 'MMO']
  },
  { id: 'battle_royale', label: 'Battle royale', sourceValues: ['Battle Royale'] }
];

function normalizedMultiplayerModes(sourceValues = []) {
  return MULTIPLAYER_MODES.filter((mode) =>
    mode.sourceValues.some((value) => sourceValues.includes(value))
  ).map(({ id, label }) => ({ id, label }));
}

module.exports = { MULTIPLAYER_MODES, normalizedMultiplayerModes };
