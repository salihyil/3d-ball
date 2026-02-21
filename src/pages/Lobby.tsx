import { OrbitControls, Stage } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BoostPads, Field, Obstacles } from "../components/GameScene";
import { socket } from "../hooks/useNetwork";
import { useSoundSettings } from "../hooks/useSoundSettings";
import type { PlayerInfo, RoomInfo, Team } from "../types";

const SAMPLE_TEXTURES = [
  { id: "default", name: "Default Green", url: "" },
  {
    id: "grass",
    name: "Lush Grass",
    url: "/textures/grass.png",
  },
  {
    id: "cyber",
    name: "Cyber Grid",
    url: "/textures/cyber.png",
  },
  {
    id: "sand",
    name: "Desert Sand",
    url: "/textures/sand.png",
  },
];

export default function Lobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostLeft, setHostLeft] = useState(false);
  const { isSoundEnabled, toggleSound } = useSoundSettings();

  const [pitchTexture, setPitchTexture] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dummyLatestRef = useRef(null);

  useEffect(() => {
    const nickname = sessionStorage.getItem("bb-nickname");
    if (!nickname) {
      navigate(`/?join=${roomId}`);
      return;
    }

    socket.emit(
      "join-room",
      { roomId: roomId!, nickname },
      (res: { success: boolean; error?: string; room?: RoomInfo }) => {
        if (res.room) {
          setRoom(res.room);
        } else if (res.error === "Room not found") {
          navigate("/");
        }
      },
    );

    const handleRoomUpdate = (roomInfo: RoomInfo) => {
      setRoom(roomInfo);
    };

    const handleGameStart = () => {
      sessionStorage.setItem(`in-room-${roomId}`, "true");
      navigate(`/game/${roomId}`);
    };

    const handleRoomDestroyed = () => {
      setHostLeft(true);
    };

    socket.on("room-update", handleRoomUpdate);
    socket.on("game-start", handleGameStart);
    socket.on("room-destroyed", handleRoomDestroyed);

    return () => {
      socket.off("room-update", handleRoomUpdate);
      socket.off("game-start", handleGameStart);
      socket.off("room-destroyed", handleRoomDestroyed);
    };
  }, [roomId, navigate]);

  const handleSwitchTeam = useCallback((team: Team) => {
    socket.emit("switch-team", { team }, (res: { error?: string; success?: boolean }) => {
      if (res.error) {
        alert(res.error);
      }
    });
  }, []);

  const handleStart = useCallback(() => {
    socket.emit("start-game");
  }, []);

  const handleLeave = useCallback(() => {
    socket.emit("leave-room");
    navigate("/");
  }, [navigate]);

  const handleToggleFeatures = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    socket.emit("toggle-features", { enableFeatures: enabled });
  }, []);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/lobby/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  const handleTextureSelect = (url: string) => {
    setPitchTexture(url);
    if (!url || url === "" || url === "none") {
      localStorage.setItem("bb-custom-pitch", "none");
    } else {
      localStorage.setItem("bb-custom-pitch", url);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handleTextureSelect(url);
    }
  };

  if (hostLeft) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <div
            className="glass-card animate-in text-center"
            style={{ padding: "40px", maxWidth: "400px" }}>
            <h2 style={{ color: "#ff4a4a", marginBottom: "16px" }}>Host Disconnected</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
              The host has unexpectedly left the game or their connection dropped. This room has
              been closed.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => navigate("/")}>
              Return to Main Menu
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!room) {
    return (
      <>
        <div className="bg-animated" />
        <div className="page-center">
          <p style={{ color: "var(--text-secondary)" }}>Connecting to room...</p>
        </div>
      </>
    );
  }

  const myId = socket.id;
  const isHost = room.hostId === myId;
  const bluePlayers = room.players.filter((p: PlayerInfo) => p.team === "blue");
  const redPlayers = room.players.filter((p: PlayerInfo) => p.team === "red");
  const canStart = true; // Allow 1-player games

  return (
    <>
      <div className="bg-animated" />
      <div className="page-center">
        <div className="lobby-container">
          <div
            className="glass-card animate-in"
            style={{ padding: "24px", margin: "0 auto" }}>
            {/* Header */}
            <div
              className="lobby-header"
              style={{ marginBottom: "16px" }}>
              <h2
                className="lobby-title"
                style={{ fontSize: "24px" }}>
                Game Lobby
              </h2>
              <div className="lobby-room-code">
                <span className="lobby-code">{roomId}</span>
                <button
                  className="btn btn-outline lobby-copy-btn"
                  onClick={handleCopyLink}>
                  {copied ? "✓ Copied!" : "📋 Copy Link"}
                </button>
              </div>
              <button
                className="btn btn-outline"
                style={{ marginLeft: "8px", padding: "8px", width: "40px" }}
                onClick={toggleSound}
                title="Toggle Sound">
                {isSoundEnabled ? "🔊" : "🔇"}
              </button>
            </div>

            {/* Teams */}
            <div className="lobby-teams">
              <div className="team-panel blue">
                <div className="team-title">
                  <span className="team-dot" />
                  Blue Team ({bluePlayers.length}/5)
                </div>
                <div className="team-players">
                  {bluePlayers.map((p: PlayerInfo) => (
                    <div
                      key={p.id}
                      className="team-player">
                      {p.nickname}
                      {p.isHost && <span className="host-badge">HOST</span>}
                      {p.id === myId && <span className="you-badge">YOU</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-blue"
                  style={{ marginTop: "12px", width: "100%", fontSize: "13px", padding: "8px" }}
                  onClick={() => handleSwitchTeam("blue")}
                  disabled={bluePlayers.length >= 5}>
                  {bluePlayers.length >= 5 ? "Team Full" : "Join Blue"}
                </button>
              </div>

              <div className="team-panel red">
                <div className="team-title">
                  <span className="team-dot" />
                  Red Team ({redPlayers.length}/5)
                </div>
                <div className="team-players">
                  {redPlayers.map((p: PlayerInfo) => (
                    <div
                      key={p.id}
                      className="team-player">
                      {p.nickname}
                      {p.isHost && <span className="host-badge">HOST</span>}
                      {p.id === myId && <span className="you-badge">YOU</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-red"
                  style={{ marginTop: "12px", width: "100%", fontSize: "13px", padding: "8px" }}
                  onClick={() => handleSwitchTeam("red")}
                  disabled={redPlayers.length >= 5}>
                  {redPlayers.length >= 5 ? "Team Full" : "Join Red"}
                </button>
              </div>
            </div>

            {/* Settings + Actions */}
            <div className="lobby-settings">
              <span className="label">Duration</span>
              <span
                className="mono"
                style={{ color: "var(--accent)" }}>
                {room.matchDuration} min
              </span>
              <span style={{ flex: 1 }} />
              <span
                className="label"
                style={{ color: "var(--text-muted)" }}>
                {room.players.length}/10 players
              </span>
            </div>

            {/* Feature Customization */}
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "8px",
              }}>
              <input
                type="checkbox"
                id="enableFeatures"
                checked={room.enableFeatures !== false}
                onChange={handleToggleFeatures}
                disabled={!isHost}
                style={{ width: "18px", height: "18px", cursor: isHost ? "pointer" : "default" }}
              />
              <label
                htmlFor="enableFeatures"
                className="label"
                style={{ marginBottom: 0, cursor: isHost ? "pointer" : "default" }}>
                Sahada engeller ve güçlendiriciler olsun mu?
              </label>
            </div>

            {/* Field Customization */}
            <div
              className="lobby-customization"
              style={{
                marginTop: "16px",
                padding: "16px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "8px",
              }}>
              <div
                style={{
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <span className="label">Match Field Texture</span>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  onClick={() => fileInputRef.current?.click()}>
                  Upload Custom Image
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                {SAMPLE_TEXTURES.map((texture) => (
                  <div
                    key={texture.id}
                    onClick={() => handleTextureSelect(texture.url)}
                    style={{
                      cursor: "pointer",
                      width: "60px",
                      height: "40px",
                      borderRadius: "4px",
                      border:
                        pitchTexture === texture.url
                          ? "2px solid #ffaa00"
                          : "2px solid transparent",
                      background: texture.url
                        ? `url(${texture.url}) center/cover`
                        : "var(--field-color, #1a5c2a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                      flexShrink: 0,
                    }}
                    title={texture.name}>
                    {!texture.url && "Default"}
                  </div>
                ))}

                {pitchTexture && !SAMPLE_TEXTURES.find((t) => t.url === pitchTexture) && (
                  <div
                    style={{
                      cursor: "pointer",
                      width: "60px",
                      height: "40px",
                      borderRadius: "4px",
                      border: "2px solid var(--accent)",
                      background: `url(${pitchTexture}) center/cover`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      flexShrink: 0,
                    }}
                    title="Custom Upload"
                  />
                )}
              </div>
            </div>

            {/* 3D Preview Section */}
            <div
              style={{
                marginTop: "16px",
                height: "200px",
                background: "#0a0a0a",
                borderRadius: "8px",
                overflow: "hidden",
                position: "relative",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  background: "rgba(0,0,0,0.6)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  zIndex: 10,
                  pointerEvents: "none",
                }}>
                Field Preview
              </div>
              <Canvas camera={{ position: [20, 20, 20], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight
                  position={[10, 10, 10]}
                  intensity={1}
                />
                <Stage
                  environment="city"
                  intensity={0.5}>
                  <Field textureUrl={pitchTexture} />
                  {room.enableFeatures !== false ? (
                    <>
                      <Obstacles />
                      <BoostPads latestRef={dummyLatestRef} />
                    </>
                  ) : null}
                </Stage>
                <OrbitControls
                  autoRotate
                  autoRotateSpeed={0.5}
                  enableZoom={false}
                  enablePan={false}
                  maxPolarAngle={Math.PI / 2.1}
                />
              </Canvas>
            </div>

            <div
              className="lobby-actions"
              style={{ marginTop: "24px" }}>
              <button
                className="btn btn-outline"
                onClick={handleLeave}>
                Leave
              </button>
              {room.gameState !== "lobby" ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    sessionStorage.setItem(`in-room-${roomId}`, "true");
                    socket.emit("enter-match");
                    navigate(`/game/${roomId}`);
                  }}>
                  ⚔️ Enter Match
                </button>
              ) : isHost ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    sessionStorage.setItem(`in-room-${roomId}`, "true");
                    handleStart();
                  }}
                  disabled={!canStart}>
                  {canStart ? "🚀 Start Game" : "Need players on both teams"}
                </button>
              ) : (
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "12px",
                  }}>
                  Waiting for host to start...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
