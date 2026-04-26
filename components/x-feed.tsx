"use client";

import { useEffect } from "react";

export default function XFeed() {
  useEffect(() => {
    const existingScript = document.getElementById("twitter-script");

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "twitter-script";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.onload = () => {
        // @ts-ignore
        if (window.twttr) {
          // @ts-ignore
          window.twttr.widgets.load();
        }
      };
      document.body.appendChild(script);
    } else {
      // @ts-ignore
      if (window.twttr) {
        // @ts-ignore
        window.twttr.widgets.load();
      }
    }
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
