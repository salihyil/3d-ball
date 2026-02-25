import crypto from 'crypto';
import jwt from 'jsonwebtoken';

let supabasePublicKey = null;
const JWKS_URL = `${process.env.VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;

async function refreshSupabasePublicKey() {
  try {
    const response = await fetch(JWKS_URL);
    const { keys } = await response.json();
    const jwk = keys[0]; // Supabase usually has one active ES256 key
    if (jwk) {
      supabasePublicKey = crypto.createPublicKey({ format: 'jwk', key: jwk });
      console.log('✅ Supabase Public Key loaded for ES256');
    }
  } catch (err) {
    console.error('❌ Failed to fetch Supabase JWKS:', err.message);
  }
}

// Initial fetch
refreshSupabasePublicKey();

export function verifySupabaseToken(token) {
  const decodedHeader = jwt.decode(token, { complete: true });
  const alg = decodedHeader?.header?.alg;

  if (alg === 'ES256' && supabasePublicKey) {
    return jwt.verify(token, supabasePublicKey, { algorithms: ['ES256'] });
  }

  // Fallback to symmetric HS256
  return jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
    algorithms: ['HS256'],
  });
}
