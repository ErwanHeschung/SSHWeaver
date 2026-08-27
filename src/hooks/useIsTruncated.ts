import { useEffect, useRef, useState } from "react";

const ROUNDING_SLACK_PX = 1;

export function useIsTruncated<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () =>
      setTruncated(
        el.scrollWidth - el.clientWidth > ROUNDING_SLACK_PX ||
          el.scrollHeight - el.clientHeight > ROUNDING_SLACK_PX,
      );

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return [ref, truncated] as const;
}
