"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement | null) => void;
      };
    };
  }
}

export default function XFeed() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderTimeline = () => {
      window.twttr?.widgets?.load(ref.current);
      setTimeout(() => window.twttr?.widgets?.load(ref.current), 800);
    };

    const existing = document.getElementById("twitter-wjs");

    if (existing) {
      renderTimeline();
      return;
    }

    const script = document.createElement("script");
    script.id = "twitter-wjs";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = renderTimeline;
    document.body.appendChild(script);
  }, []);

  return (
    <div ref={ref} style={{ marginTop: "24px" }}>
      <p style={{ fontSize: "14px", opacity: 0.6, marginBottom: "12px" }}>
        61Larus X akışı
      </p>

      <a
        className="twitter-timeline"
        data-height="520"
        data-theme="light"
        data-chrome="noheader nofooter transparent"
        href="https://twitter.com/6Larus"
      >
        61Larus X akışı yükleniyor...
      </a>
    </div>
  );
}
