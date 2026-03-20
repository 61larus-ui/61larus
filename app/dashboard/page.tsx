"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setEmail(data.user.email || "");
      } else {
        window.location.href = "/login";
      }
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>

      <p>Hoş geldin: {email}</p>

      <button
        onClick={handleLogout}
        style={{
          padding: 10,
          backgroundColor: "black",
          color: "white",
          borderRadius: 6,
          border: "none",
        }}
      >
        Çıkış Yap
      </button>
    </div>
  );
}