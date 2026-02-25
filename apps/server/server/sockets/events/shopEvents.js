import { supabaseAdmin } from '../../config/supabase.js';
import { rooms } from '../RoomManager.js';

export function registerShopEvents(io, socket) {
  // ---- Buy Item with Coins ----
  socket.on('buy-item-with-coins', async (data, callback) => {
    if (!callback || typeof callback !== 'function') return;
    if (socket.user.isGuest) {
      return callback({ ok: false, error: 'guests_cannot_buy' });
    }

    const { accessoryId } = data || {};
    if (!accessoryId) {
      return callback({ ok: false, error: 'missing_accessory_id' });
    }

    try {
      const { data: result, error } = await supabaseAdmin.rpc(
        'buy_item_with_coins',
        {
          p_user_id: socket.user.id,
          p_accessory_id: accessoryId,
        }
      );

      if (error) {
        console.error('[COINS] RPC error:', error.message);
        return callback({ ok: false, error: error.message });
      }

      if (!result || !result.ok) {
        return callback({
          ok: false,
          error: result?.error || 'unknown_error',
          required: result?.required,
          balance: result?.balance,
        });
      }

      // Success — notify client
      socket.emit('item-unlocked', { id: accessoryId });
      socket.emit('coin-balance-updated', { balance: result.new_balance });
      console.log(
        `[COINS] ${socket.user.nickname} bought ${accessoryId}, new balance: ${result.new_balance}`
      );
      callback({ ok: true, newBalance: result.new_balance });
    } catch (err) {
      console.error('[COINS] Unexpected error:', err.message);
      callback({ ok: false, error: 'server_error' });
    }
  });

  // ---- Accessory Update ----
  socket.on('update-accessories', (data) => {
    const { accessories } = data;
    if (!Array.isArray(accessories)) return;

    // Update socket user state
    socket.user.equippedAccessories = accessories;

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.updatePlayerAccessories(socket.id, accessories);
        io.to(socket.roomId).emit('room-update', room.getRoomInfo());
      }
    }
  });
}
