import React, { useEffect, useRef } from 'react';

import { useThemeContext } from '@/ui/app/contexts/ThemeContext';

interface Star {
  x: number;
  y: number;
  z: number;
}

export const AnimatedBackground: React.FC = () => {
  const { theme } = useThemeContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let devicePixelRatio = window.devicePixelRatio || 1;

    const STAR_COUNT = 140;
    const SPEED = 0.0015; // Slow, gentle drift
    const DEPTH = 1.5; // Controls perspective depth

    let stars: Star[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const randomStar = (): Star => ({
      x: (Math.random() - 0.5) * 2, // -1..1
      y: (Math.random() - 0.5) * 2,
      z: Math.random() * DEPTH + 0.1
    });

    const init = () => {
      stars = new Array(STAR_COUNT).fill(0).map(randomStar);
    };

    const project = (star: Star) => {
      const fov = Math.min(width, height) * 0.8;
      const scale = fov / (star.z * fov);
      return {
        x: star.x * scale * fov + width / 2,
        y: star.y * scale * fov + height / 2,
        r: Math.max(0.6, 2.2 - star.z * 1.6)
      };
    };

    const step = () => {
      const isDark = theme === 'dark';
      // Fill solid background
      ctx.fillStyle = isDark ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, width, height);
      const starColor = isDark ? '#ffffff' : '#000000';

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Move star towards viewer
        s.z -= SPEED;
        if (s.z <= 0.02) {
          stars[i] = randomStar();
          continue;
        }
        const p = project(s);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
          stars[i] = randomStar();
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = starColor;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(step);
    };

    const onResize = () => {
      resize();
      init();
    };

    resize();
    // Ensure canvas has solid background immediately
    canvas.style.backgroundColor = theme === 'dark' ? '#000000' : '#ffffff';
    init();
    animationRef.current = requestAnimationFrame(step);
    window.addEventListener('resize', onResize);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
      id="field"
    />
  );
};

export default AnimatedBackground;
