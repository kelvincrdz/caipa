import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

type OverflowMarqueeProps = {
  text: string;
  className?: string;
  speedPxPerSecond?: number;
  gapPx?: number;
};

export function OverflowMarquee({
  text,
  className,
  speedPxPerSecond = 50,
  gapPx = 48,
}: OverflowMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [durationSec, setDurationSec] = useState(12);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const containerWidth = container.clientWidth;
      const textWidth = textEl.scrollWidth;
      const overflowing = textWidth > containerWidth + 2;
      setIsOverflowing(overflowing);

      if (overflowing) {
        setDurationSec(Math.max(textWidth / speedPxPerSecond, 6));
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(textEl);

    return () => observer.disconnect();
  }, [text, speedPxPerSecond]);

  return (
    <div ref={containerRef} className={cn("overflow-hidden whitespace-nowrap", className)}>
      {isOverflowing ? (
        <div
          className="caipa-overflow-marquee"
          style={{
            ["--marquee-duration" as string]: `${durationSec}s`,
            ["--marquee-gap" as string]: `${gapPx}px`,
          }}
        >
          <span ref={textRef} className="caipa-overflow-marquee-item">{text}</span>
          <span aria-hidden className="caipa-overflow-marquee-item">{text}</span>
        </div>
      ) : (
        <span ref={textRef} className="block truncate">{text}</span>
      )}
    </div>
  );
}
