import React, { useEffect, useRef } from 'react';
import { useThemeContext } from '@/ui/app/contexts/ThemeContext';

interface Star {
  X: number;
  Y: number;
  SX: number;
  SY: number;
  W: number;
  H: number;
  age: number;
  dies: number;
  ID: number;
  C: string;
  Draw: () => void;
}

export const AnimatedBackground: React.FC = () => {
  const { theme } = useThemeContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Record<number, Star>>({});
  const starIndexRef = useRef(0);
  const numStarsRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Configuration based on theme
    const isDark = theme === 'dark';
    const starColor = isDark ? '#ffffff' : '#000000';
    const bgColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    const acceleration = 0.1; // Much slower acceleration (90% slower than original)
    // Reduce star count significantly for small extension viewport
    const starsToDraw = Math.min(50, (canvas.width * canvas.height) / 1000);

    // Star constructor
    const createStar = (): Star => {
      const star: Star = {
        X: canvas.width / 2,
        Y: canvas.height / 2,
        SX: Math.random() * 10 - 5,
        SY: Math.random() * 10 - 5,
        W: 1,
        H: 1,
        age: 0,
        dies: 500,
        ID: 0,
        C: starColor,
        Draw: function () {
          this.X += this.SX;
          this.Y += this.SY;

          this.SX += this.SX / (50 / acceleration);
          this.SY += this.SY / (50 / acceleration);

          this.age++;

          if (
            this.age === Math.floor(50 / acceleration) ||
            this.age === Math.floor(150 / acceleration) ||
            this.age === Math.floor(300 / acceleration)
          ) {
            this.W++;
            this.H++;
          }

          if (
            this.X + this.W < 0 ||
            this.X > canvas.width ||
            this.Y + this.H < 0 ||
            this.Y > canvas.height
          ) {
            delete starsRef.current[this.ID];
            numStarsRef.current--;
          }

          ctx.fillStyle = this.C;
          ctx.fillRect(this.X, this.Y, this.W, this.H);
        }
      };

      // Position star
      const start =
        canvas.width > canvas.height ? canvas.width : canvas.height;
      star.X += star.SX * (start / 10);
      star.Y += star.SY * (start / 10);

      starIndexRef.current++;
      star.ID = starIndexRef.current;
      starsRef.current[star.ID] = star;

      return star;
    };

    const draw = () => {
      // Handle window resizing
      if (canvas.width !== window.innerWidth) {
        canvas.width = window.innerWidth;
      }
      if (canvas.height !== window.innerHeight) {
        canvas.height = window.innerHeight;
      }

      // Clear canvas with semi-transparent background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create new stars
      for (let i = numStarsRef.current; i < starsToDraw; i++) {
        createStar();
        numStarsRef.current++;
      }

      // Draw all stars
      for (const star in starsRef.current) {
        starsRef.current[star].Draw();
      }
    };

    // Animation loop using requestAnimationFrame for smooth 60fps rendering
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Start animation loop
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Reset animation state
      starsRef.current = {};
      starIndexRef.current = 0;
      numStarsRef.current = 0;
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
