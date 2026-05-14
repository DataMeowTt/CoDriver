import { useEffect, useRef } from 'react';
import useRecordingStore from '../../stores/recordingStore';
import styles from './AudioVisualizer.module.css';

export default function AudioVisualizer() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserNode = useRecordingStore((s) => s.analyserNode);
  const status = useRecordingStore((s) => s.status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      if (analyserNode && status === 'recording') {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const barCount = 64;
        const barWidth = width / barCount;
        const gap = 2;

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * bufferLength);
          const value = dataArray[dataIndex] / 255;
          const barHeight = Math.max(2, value * height * 0.8);

          const x = i * barWidth;
          const y = (height - barHeight) / 2;

          // Gradient from cyan to emerald
          const t = i / barCount;
          const r = Math.round(34 + t * (16 - 34));
          const g = Math.round(211 + t * (185 - 211));
          const b = Math.round(238 + t * (129 - 238));

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + value * 0.4})`;
          ctx.beginPath();
          ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 2);
          ctx.fill();
        }
      } else {
        // Idle / paused state — subtle bars
        const barCount = 64;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const t = i / barCount;
          const phase = Date.now() / 1000 + i * 0.15;
          const value = status === 'paused'
            ? 0.1 + Math.sin(phase) * 0.05
            : 0.05 + Math.sin(phase * 0.5) * 0.02;
          const barHeight = Math.max(2, value * height);
          const x = i * barWidth;
          const y = (height - barHeight) / 2;

          ctx.fillStyle = `rgba(139, 149, 168, ${0.15 + value * 0.3})`;
          ctx.beginPath();
          ctx.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyserNode, status]);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
