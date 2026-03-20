"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Giriş hatası: " + error.message);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h1>Giriş Yap</h1>

      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          display: "block",
          marginBottom: 10,
          width: "100%",
          padding: 10,
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />

      <input
        placeholder="Şifre"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          display: "block",
          marginBottom: 10,
          width: "100%",
          padding: 10,
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />

      <button
        onClick={handleLogin}
        style={{
          width: "100%",
          padding: 10,
          backgroundColor: "black",
          color: "white",
          borderRadius: 6,
          border: "none",
        }}
      >
        Giriş Yap
      </button>
    </div>
  );
}