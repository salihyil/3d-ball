import { v4 as uuidv4 } from 'uuid';
import { verifySupabaseToken } from '../auth/jwt.js';
import { supabaseAdmin } from '../config/supabase.js';
import { TITLE_COLORS } from './RoomManager.js';

export const socketAuthMiddleware = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const nickname = socket.handshake.auth?.nickname;
  const equippedAccessories = socket.handshake.auth?.equippedAccessories || [];
  const sessionId = socket.handshake.auth?.sessionId;

  // Fallback for Guest mode if no token provided
  if (!token) {
    const guestId = `Guest_${uuidv4().substring(0, 8)}`;
    const finalNickname = nickname || `Guest ${guestId.split('_')[1]}`;
    socket.user = {
      id: guestId,
      email: null,
      nickname: finalNickname,
      equippedAccessories: [], // Guests cannot have accessories for now
      isGuest: true,
      sessionId: sessionId || uuidv4(),
    };
    return next();
  }

  try {
    // Basic check for secret - if missing in dev, we might want to allow guest fallback or throw
    if (!process.env.SUPABASE_JWT_SECRET) {
      console.warn(
        '[AUTH] SUPABASE_JWT_SECRET is missing. Falling back to Guest mode for all.'
      );
      const guestId = `Guest_${uuidv4().substring(0, 8)}`;
      socket.user = {
        id: guestId,
        nickname: nickname || 'Guest',
        equippedAccessories: [],
        isGuest: true,
        sessionId: sessionId || uuidv4(),
      };
      return next();
    }

    const decoded = verifySupabaseToken(token);
    // decoded contains sub (userId), email, etc.
    const verifiedNickname = nickname || decoded.email.split('@')[0];

    // Fetch equipped cosmetics (title + goal explosion) from Supabase
    let cosmetics = {};
    try {
      const { data: equipped } = await supabaseAdmin
        .from('user_accessories')
        .select('accessory_id, accessories(name, category)')
        .eq('user_id', decoded.sub)
        .eq('is_equipped', true);

      if (equipped) {
        for (const item of equipped) {
          const acc = item.accessories;
          if (!acc) continue;
          if (acc.category === 'player_title') {
            cosmetics.title = acc.name;
            cosmetics.nameColor = TITLE_COLORS[acc.name] || '#ffd700';
          } else if (acc.category === 'goal_explosion') {
            cosmetics.goalExplosion = acc.name;
          }
        }
      }
    } catch (cosmeticErr) {
      console.warn('[AUTH] Failed to fetch cosmetics:', cosmeticErr.message);
    }

    socket.user = {
      id: decoded.sub,
      email: decoded.email,
      nickname: verifiedNickname,
      equippedAccessories,
      isGuest: false,
      sessionId,
      cosmetics,
    };
    next();
  } catch (err) {
    console.error('[AUTH] JWT Verification failed:', err.message);
    // On verification failure (expired etc), we can still allow them as Guest instead of rejecting
    const guestId = `Guest_${uuidv4().substring(0, 8)}`;
    socket.user = {
      id: guestId,
      nickname: (nickname || 'Guest') + ' (Exp)',
      equippedAccessories: [],
      isGuest: true,
      sessionId: sessionId || uuidv4(),
    };
    next();
  }
};
