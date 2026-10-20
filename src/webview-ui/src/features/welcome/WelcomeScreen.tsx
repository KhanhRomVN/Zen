import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./WelcomeScreen.css";

const STEPS: [number, string][] = [
  [0, "Starting workspace"],
  [20, "Connecting backend"],
  [42, "Loading providers"],
  [64, "Loading accounts"],
  [84, "Waking AI agent"],
  [100, "Ready"],
];

const DELAY = 900;
const DURATION = 3800;
const HOLD = 500;
const FADE = 700;

const delay = (value: string) => ({ "--d": value }) as CSSProperties;

interface WelcomeScreenProps {
  onDone: () => void;
}

const WelcomeScreen = ({ onDone }: WelcomeScreenProps) => {
  const [percent, setPercent] = useState(0);
  const [exiting, setExiting] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const leavingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setExiting(true);
    timersRef.current.push(window.setTimeout(() => onDoneRef.current(), FADE));
  }, []);

  const skip = useCallback(() => {
    if (leavingRef.current) return;
    if (barRef.current) barRef.current.style.width = "100%";
    setPercent(100);
    leave();
  }, [leave]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 0 : DELAY;
    const duration = reduced ? 500 : DURATION;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      if (leavingRef.current) return;
      const t = (now - start - wait) / duration;
      if (t > 0) {
        const value = t >= 1 ? 100 : t * t * (3 - 2 * t) * 100;
        if (barRef.current) barRef.current.style.width = `${value}%`;
        setPercent(Math.floor(value));
        if (value >= 100) {
          timersRef.current.push(window.setTimeout(leave, reduced ? 200 : HOLD));
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    };
  }, [leave]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["Escape", " ", "Enter"].includes(e.key)) skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skip]);

  const label =
    [...STEPS].reverse().find(([threshold]) => percent >= threshold)?.[1] ??
    STEPS[0][1];

  return (
    <div
      className={`zw${exiting ? " zw--exit" : ""}`}
      role="status"
      aria-label="Starting Zen"
      onClick={skip}
    >
      <div className="zw-stage">
        <div className="zw-glyph zw-fi" style={delay(".2s")}>
          <img
            src={`${(window as any).__zenImagesUri}/icon.png`}
            alt="Zen"
            draggable={false}
          />
        </div>
        <div className="zw-wordmark zw-fi" style={delay(".5s")}>
          Zen
        </div>
        <div className="zw-tagline zw-fi" style={delay(".8s")}>
          AI-powered coding assistant for VSCode
        </div>
        <p className="zw-slogan zw-fi" style={delay("1.1s")}>
          Any LLM, your editor, every change under control.
        </p>
        <div className="zw-progress zw-fi" style={delay("1s")}>
          <div className="zw-track">
            <i ref={barRef} />
          </div>
          <div className="zw-legend">
            <span>{label}</span>
            <b>{percent}%</b>
          </div>
        </div>
      </div>
      <div className="zw-skip zw-fi" style={delay("1.4s")}>
        Click or press Esc to skip
      </div>
    </div>
  );
};

export default WelcomeScreen;