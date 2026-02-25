import { OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { memo, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '../../hooks/useNetwork';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';
import { supabase } from '../../lib/supabase';
import { toast } from '../../utils/toast';
import { Character } from '../GameScene/Character';
import { CanvasErrorBoundary } from '../ui/CanvasErrorBoundary';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Internal Loading component for the 3D preview
function PreviewLoading() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#222" wireframe />
    </mesh>
  );
}

// ---- Coin Pack Card ----
function CoinPackCard({
  coins,
  price,
  label,
  bonus,
  popular,
  onClick,
}: {
  coins: number;
  price: number;
  label: string;
  bonus?: string;
  popular?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: popular ? '14px 10px 12px' : '12px 10px',
        background: popular
          ? 'linear-gradient(160deg, rgba(255,215,0,0.12) 0%, rgba(255,140,0,0.06) 100%)'
          : 'rgba(255,255,255,0.02)',
        border: popular
          ? '1px solid rgba(255,215,0,0.35)'
          : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget;
        t.style.transform = 'translateY(-3px) scale(1.03)';
        t.style.borderColor = popular
          ? 'rgba(255,215,0,0.6)'
          : 'rgba(255,215,0,0.3)';
        t.style.boxShadow = popular
          ? '0 8px 24px rgba(255,215,0,0.15), 0 0 20px rgba(255,215,0,0.1)'
          : '0 4px 16px rgba(255,215,0,0.08)';
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget;
        t.style.transform = '';
        t.style.borderColor = popular
          ? 'rgba(255,215,0,0.35)'
          : 'rgba(255,255,255,0.06)';
        t.style.boxShadow = '';
      }}
    >
      {/* Popular badge */}
      {popular && (
        <div
          style={{
            position: 'absolute',
            top: '-1px',
            right: '8px',
            background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
            color: '#000',
            fontSize: '7px',
            fontWeight: 900,
            padding: '2px 6px 3px',
            borderRadius: '0 0 4px 4px',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          BEST VALUE
        </div>
      )}

      {/* Coin icon */}
      <span style={{ fontSize: '22px', lineHeight: 1 }}>🪙</span>

      {/* Coin amount */}
      <span
        style={{
          fontSize: '18px',
          fontWeight: 800,
          color: '#ffd700',
          textShadow: '0 0 12px rgba(255,215,0,0.3)',
          lineHeight: 1,
        }}
      >
        {coins.toLocaleString()}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: '8px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        {label}
      </span>

      {/* Bonus tag */}
      {bonus && (
        <span
          style={{
            fontSize: '8px',
            fontWeight: 700,
            color: '#4ade80',
            background: 'rgba(74,222,128,0.1)',
            padding: '1px 6px',
            borderRadius: '3px',
            border: '1px solid rgba(74,222,128,0.2)',
          }}
        >
          {bonus}
        </span>
      )}

      {/* Price */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: '2px',
        }}
      >
        ${price}
      </span>
    </button>
  );
}

export const AvatarModal = memo(function AvatarModal({
  isOpen,
  onClose,
}: AvatarModalProps) {
  const { t } = useTranslation();
  const { accessories, loading, toggleAccessory, buyWithCoins, profile } =
    usePlayerProfile();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const isBuyingRef = useRef(false);

  if (!isOpen) return null;

  const handleEquip = async (id: string, category: string) => {
    try {
      const accessory = accessories.find((a) => a.id === id);
      if (!accessory) return;

      const isEquipping = !accessory.is_equipped;

      await toggleAccessory(id, category);

      const nextIds = accessories
        .map((a) => {
          if (a.category === category) {
            if (isEquipping) {
              return a.id === id ? a.id : null;
            }
            return null;
          }
          return a.is_equipped ? a.id : null;
        })
        .filter((id): id is string => id !== null);

      socket.emit('update-accessories', { accessories: nextIds });
    } catch (err) {
      console.error('Failed to toggle accessory:', err);
    }
  };

  const handleBuyWithCoins = async (accessoryId: string) => {
    if (isBuyingRef.current) return;
    isBuyingRef.current = true;
    setBuyingId(accessoryId);
    try {
      const result = await buyWithCoins(accessoryId);
      if (result.ok) {
        // Success — item unlocked, balance updated automatically
      } else if (result.error === 'insufficient_coins') {
        setShowCoinShop(true);
      } else {
        toast.error(result.error || 'Purchase failed');
      }
    } catch (err) {
      console.error('Coin purchase failed:', err);
    } finally {
      isBuyingRef.current = false;
      setBuyingId(null);
    }
  };

  const handleBuyCoins = async (packId: 'starter' | 'value' = 'starter') => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session.access_token,
          type: 'coin_pack',
          coinPackId: packId,
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Coin purchase redirect failed:', err);
      toast.error('Failed to open payment page. Please try again.');
    }
  };

  const equippedIds = accessories.filter((a) => a.is_equipped).map((a) => a.id);
  const coinBalance = profile?.brawl_coins ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-card-wide glass-card animate-in"
        style={{
          padding: '0',
          background: 'rgba(5, 5, 8, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div
          className="avatar-modal-body"
          style={{ display: 'flex', flex: 1, minHeight: '600px' }}
        >
          {/* 3D Preview Section */}
          <div
            className="preview-section"
            style={{
              flex: 1.4,
              background: '#0a0a0f',
              position: 'relative',
              borderRight: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="preview-scanline"></div>
            <div className="preview-overlay-text">
              {t('profile.preview_status')}
            </div>

            <CanvasErrorBoundary>
              <Canvas
                shadows
                dpr={[1, 1.5]}
                camera={{ position: [0, 1, 5], fov: 40 }}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                }}
              >
                <color attach="background" args={['#0a0a0f']} />
                <Suspense fallback={<PreviewLoading />}>
                  <Stage
                    intensity={0.4}
                    environment="city"
                    adjustCamera={true}
                    shadows={{ type: 'contact', opacity: 0.2, blur: 3 }}
                  >
                    <Character
                      id="preview-avatar"
                      initialTeam="blue"
                      forceAccessories={equippedIds}
                    />
                  </Stage>
                </Suspense>
                <OrbitControls
                  enablePan={false}
                  enableZoom={true}
                  minDistance={2}
                  maxDistance={6}
                />
              </Canvas>
            </CanvasErrorBoundary>

            {/* Visual bottom bar for the preview */}
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                right: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <div>{t('profile.preview_platform')}</div>
              <div>{t('profile.preview_version')}</div>
            </div>
          </div>

          {/* Right Panel: Coin Balance + Shop / Accessories */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '32px',
              maxWidth: '420px',
              gap: '0',
            }}
          >
            {/* ========== HEADER ========== */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    background: 'var(--accent)',
                    boxShadow: '0 0 10px var(--accent)',
                  }}
                ></div>
                <h2
                  className="modal-title"
                  style={{ fontSize: '24px', margin: 0 }}
                >
                  {t('profile.title')}
                </h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                {t('profile.subtitle')}
              </p>
            </div>

            {/* ========== COIN WALLET BAR ========== */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                background:
                  'linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(255,140,0,0.03) 100%)',
                border: '1px solid rgba(255,215,0,0.15)',
                borderRadius: '10px',
                marginBottom: '8px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Animated shimmer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.04) 50%, transparent 100%)',
                  animation: 'scan 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }}
              />

              <span style={{ fontSize: '20px', zIndex: 1 }}>🪙</span>
              <div style={{ zIndex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#ffd700',
                    lineHeight: 1,
                    textShadow: '0 0 16px rgba(255,215,0,0.4)',
                  }}
                >
                  {coinBalance.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: 'rgba(255,215,0,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Brawl Coins
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCoinShop(!showCoinShop);
                }}
                style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 14px',
                  background: showCoinShop
                    ? 'rgba(255,215,0,0.2)'
                    : 'rgba(255,215,0,0.1)',
                  color: '#ffd700',
                  border: '1px solid rgba(255,215,0,0.25)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s ease',
                  zIndex: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,215,0,0.25)';
                  e.currentTarget.style.boxShadow =
                    '0 0 12px rgba(255,215,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = showCoinShop
                    ? 'rgba(255,215,0,0.2)'
                    : 'rgba(255,215,0,0.1)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {showCoinShop ? '✕' : '+ GET'}
              </button>
            </div>

            {/* ========== COIN SHOP PANEL (collapsible) ========== */}
            <div
              style={{
                maxHeight: showCoinShop ? '160px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '12px 0 16px',
                }}
              >
                <CoinPackCard
                  coins={500}
                  price={5}
                  label="Starter"
                  onClick={() => handleBuyCoins('starter')}
                />
                <CoinPackCard
                  coins={1200}
                  price={10}
                  label="Value Pack"
                  bonus="+20% EXTRA"
                  popular
                  onClick={() => handleBuyCoins('value')}
                />
              </div>
            </div>

            {/* ========== ACCESSORIES GRID ========== */}
            <div
              className="accessory-grid premium-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                transform: 'translateZ(0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
            >
              {loading && accessories.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div
                    className="animate-spin"
                    style={{
                      display: 'inline-block',
                      width: '24px',
                      height: '24px',
                      border: '2px solid rgba(255,255,255,0.05)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                    }}
                  ></div>
                </div>
              )}

              {[
                'ball_skin',
                'hat',
                'aura',
                'decal',
                'trail',
                'goal_explosion',
                'player_title',
              ].map((cat, catIdx) => {
                const catItems = accessories.filter((a) => a.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat}>
                    <div className="avatar-modal-gear-title">
                      {t(`profile.categories.${cat}`)}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px',
                      }}
                    >
                      {catItems.map((acc, i) => {
                        const canAfford = coinBalance >= acc.price_coins;
                        const isPaid = acc.price_coins > 0;

                        return (
                          <div
                            key={acc.id}
                            className={`accessory-card accessory-card-stagger ${
                              acc.isOwned
                                ? acc.is_equipped
                                  ? 'active'
                                  : ''
                                : 'locked'
                            }`}
                            style={{
                              padding: '14px 8px',
                              margin: 0,
                              position: 'relative',
                              animationDelay: `${catIdx * 0.1 + i * 0.05}s`,
                              borderRadius: '8px',
                              overflow: 'visible',
                            }}
                            onClick={() => {
                              if (acc.isOwned) {
                                handleEquip(acc.id, acc.category);
                              }
                            }}
                          >
                            <div className="accessory-card-inner">
                              <span
                                className="accessory-icon"
                                style={{
                                  fontSize: '24px',
                                  marginBottom: '8px',
                                  filter: acc.isOwned
                                    ? 'none'
                                    : 'grayscale(1) opacity(0.3)',
                                }}
                              >
                                {acc.category === 'hat'
                                  ? '⛑️'
                                  : acc.category === 'ball_skin'
                                    ? '🟣'
                                    : acc.category === 'aura'
                                      ? '🌀'
                                      : acc.category === 'decal'
                                        ? '💠'
                                        : acc.category === 'goal_explosion'
                                          ? '💥'
                                          : acc.category === 'player_title'
                                            ? '🏷️'
                                            : '⚡'}
                              </span>
                              <div
                                className="accessory-name"
                                style={{
                                  fontSize: '10px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  opacity: acc.isOwned ? 1 : 0.5,
                                }}
                              >
                                {acc.name}
                              </div>

                              {/* ---- Purchase / Status Badges ---- */}
                              {!acc.isOwned ? (
                                isPaid ? (
                                  <button
                                    className="btn-buy"
                                    disabled={buyingId === acc.id}
                                    style={{
                                      marginTop: '8px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '4px 10px',
                                      background: canAfford
                                        ? 'rgba(255,215,0,0.1)'
                                        : 'rgba(255,60,60,0.08)',
                                      color: canAfford ? '#ffd700' : '#ff6b6b',
                                      border: `1px solid ${
                                        canAfford
                                          ? 'rgba(255,215,0,0.3)'
                                          : 'rgba(255,60,60,0.2)'
                                      }`,
                                      borderRadius: '5px',
                                      fontFamily: 'var(--font-mono)',
                                      cursor:
                                        buyingId === acc.id
                                          ? 'wait'
                                          : 'pointer',
                                      opacity: buyingId === acc.id ? 0.5 : 1,
                                      transition: 'all 0.2s ease',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canAfford) {
                                        handleBuyWithCoins(acc.id);
                                      } else {
                                        setShowCoinShop(true);
                                      }
                                    }}
                                  >
                                    {buyingId === acc.id
                                      ? '...'
                                      : `${acc.price_coins} 🪙`}
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      marginTop: '8px',
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      color: '#4ade80',
                                      fontFamily: 'var(--font-mono)',
                                      letterSpacing: '1px',
                                    }}
                                  >
                                    FREE
                                  </span>
                                )
                              ) : (
                                acc.is_equipped && (
                                  <div className="equipped-badge-glow">
                                    {t('profile.ready_badge')}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="btn btn-primary btn-battle-ready"
              style={{ width: '100%' }}
            >
              {t('profile.initialize_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
