"use client";

import { useEffect } from "react";

export default function XFeed() {
  useEffect(() => {
    if (document.getElementById("twitter-script")) return;

    const script = document.createElement("script");
    script.id = "twitter-script";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div style={{ marginTop: "24px" }}>
      <a
        className="twitter-timeline"
        data-height="500"
        data-theme="light"
        href="https://twitter.com/61larus"
      >
        X akışı yükleniyor...
      </a>
    </div>
  );
}
