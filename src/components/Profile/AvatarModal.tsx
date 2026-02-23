import { OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { memo, Suspense } from 'react';
import { socket } from '../../hooks/useNetwork';
import { usePlayerProfile } from '../../hooks/usePlayerProfile';
import { supabase } from '../../lib/supabase';
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

export const AvatarModal = memo(function AvatarModal({
  isOpen,
  onClose,
}: AvatarModalProps) {
  const { accessories, loading, toggleAccessory } = usePlayerProfile();

  if (!isOpen) return null;

  const handleEquip = async (id: string, category: string) => {
    try {
      const accessory = accessories.find((a) => a.id === id);
      if (!accessory) return;

      const isEquipping = !accessory.is_equipped;

      await toggleAccessory(id, category);

      // Construct the next list of IDs to emit immediately for lobby sync
      const nextIds = accessories
        .map((a) => {
          if (a.category === category) {
            // If we are equipping this item, it's the only one in the cat.
            // If we are unequipping it, the cat will be empty.
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

  const handleBuy = async (accessoryId: string, stripePriceId: string) => {
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
          accessoryId,
          priceId: stripePriceId,
        }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Purchase failed:', err);
      alert('Payment processing failed. Please try again.');
    }
  };

  const equippedIds = accessories.filter((a) => a.is_equipped).map((a) => a.id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card modal-card-wide glass-card animate-in"
        style={{
          padding: '0',
          background: 'rgba(5, 5, 8, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
              Gear Optimization // System Active
            </div>

            <CanvasErrorBoundary>
              <Canvas
                shadows
                camera={{ position: [0, 1, 5], fov: 40 }}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                  preserveDrawingBuffer: true,
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
              <div>X-01 AVATAR PLATFORM</div>
              <div>STAGING V2.4</div>
            </div>
          </div>

          {/* Accessory Selection Section */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '40px',
              maxWidth: '400px',
            }}
          >
            <div className="modal-header" style={{ marginBottom: '32px' }}>
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
                  LOADOUT
                </h2>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Select tactical gear for the next deployment.
              </p>
            </div>

            <div
              className="accessory-grid premium-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              {loading && accessories.length === 0 && (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                  }}
                >
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

              {['ball_skin', 'hat', 'aura', 'decal', 'trail'].map(
                (cat, catIdx) => {
                  const catItems = accessories.filter(
                    (a) => a.category === cat
                  );
                  if (catItems.length === 0) return null;

                  return (
                    <div key={cat}>
                      <div className="avatar-modal-gear-title">
                        {cat.replace('_', ' ')}s
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                        }}
                      >
                        {catItems.map((acc, i) => (
                          <div
                            key={acc.id}
                            className={`accessory-card glass-card accessory-card-stagger ${
                              acc.isOwned
                                ? acc.is_equipped
                                  ? 'active'
                                  : ''
                                : 'locked'
                            }`}
                            style={{
                              padding: '16px 8px',
                              margin: 0,
                              position: 'relative',
                              animationDelay: `${catIdx * 0.1 + i * 0.05}s`,
                              borderRadius: '4px',
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

                              {!acc.isOwned ? (
                                <button
                                  className="btn-buy"
                                  style={{
                                    marginTop: '8px',
                                    fontSize: '9px',
                                    padding: '4px 8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--accent)',
                                    border: '1px solid var(--accent)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBuy(
                                      acc.id,
                                      acc.stripe_price_id || ''
                                    );
                                  }}
                                >
                                  ${acc.price || '0'}
                                </button>
                              ) : (
                                acc.is_equipped && (
                                  <div className="equipped-badge-glow">
                                    READY
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <button
              onClick={onClose}
              className="btn btn-primary btn-battle-ready"
              style={{ width: '100%' }}
            >
              Initialize Loadout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
