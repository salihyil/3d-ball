import React, { useEffect, useRef } from 'react';
import type { GameSnapshot } from '../types';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../types';

interface MiniMapProps {
  latestRef: React.MutableRefObject<GameSnapshot | null>;
}

export default function MiniMap({ latestRef }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const snapshot = latestRef.current;
      if (!snapshot) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // Clear canvas (CSS background handles the pitch color)
      ctx.clearRect(0, 0, cw, ch);

      // Draw center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cw / 2, 0);
      ctx.lineTo(cw / 2, ch);
      ctx.stroke();

      // Draw center circle
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, cw * 0.1, 0, Math.PI * 2);
      ctx.stroke();

      // Helper to map 3D coordinates (x, z) to 2D canvas (x, y)
      const mapX = (x: number) => ((x + FIELD_WIDTH / 2) / FIELD_WIDTH) * cw;
      // Z in 3D maps to Y in 2D
      const mapY = (z: number) => ((z + FIELD_HEIGHT / 2) / FIELD_HEIGHT) * ch;

      // Draw players
      Object.keys(snapshot.players).forEach((id) => {
        const p = snapshot.players[id];
        const px = mapX(p.position.x);
        const py = mapY(p.position.z);

        ctx.fillStyle = p.team === 'blue' ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator (velocity vector)
        if (p.velocity.x !== 0 || p.velocity.z !== 0) {
          const mag = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);
          const dirX = p.velocity.x / (mag || 1);
          const dirY = p.velocity.z / (mag || 1);
          
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + dirX * 6, py + dirY * 6);
          ctx.stroke();
        }
      });

      // Draw ball
      const bx = mapX(snapshot.ball.position.x);
      const by = mapY(snapshot.ball.position.z);
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Ball glow/border
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [latestRef]);

  return (
    <div className="hud-minimap">
      <canvas
        ref={canvasRef}
        width={200}
        height={125} // Ratio based on FIELD_WIDTH (80) and FIELD_HEIGHT (50)
        className="hud-minimap-canvas"
      />
    </div>
  );
}
