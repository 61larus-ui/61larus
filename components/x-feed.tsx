"use client";

import { useEffect } from "react";

export default function XFeed() {
  useEffect(() => {
    if (!document.getElementById("twitter-script")) {
      const script = document.createElement("script");
      script.id = "twitter-script";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div style={{ marginTop: "24px" }}>
      <p style={{ fontSize: "14px", opacity: 0.6 }}>
        61Larus X paylaşımları
      </p>

      <blockquote className="twitter-tweet">
        <a href="https://x.com/6Larus/status/2048436993718157792"></a>
      </blockquote>

      <a
        href="https://x.com/6Larus"
        target="_blank"
        style={{
          display: "inline-block",
          marginTop: "12px",
          fontSize: "14px",
          textDecoration: "underline"
        }}
      >
        {"X\u2019te takip et →"}
      </a>
    </div>
  );
}
