export const rooms = new Map();

export const TITLE_COLORS = {
  VIP: '#ffd700',
  'Ace Striker': '#ff6b35',
  'Shadow Legend': '#a855f7',
  'Inferno King': '#ef4444',
};

// Start cleanup interval for empty or inactive rooms
export function startRoomCleanupInterval() {
  setInterval(() => {
    for (const [id, room] of rooms) {
      const isInactive =
        room.isEmpty() ||
        (room.isFullyDisconnected() && Date.now() - room.lastActivity > 60000);
      if (isInactive) {
        room.destroy();
        rooms.delete(id);
        console.log(`[CLEANUP] Room ${id} deleted (inactive)`);
      }
    }
  }, 30000);
}
