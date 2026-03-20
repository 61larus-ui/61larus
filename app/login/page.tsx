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
      alert("Giriş başarılı!");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Giriş Yap</h1>

      <input
        placeholder="Email"
        type="email"
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <input
        placeholder="Şifre"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <button onClick={handleLogin} style={{ width: "100%" }}>
        Giriş Yap
      </button>
    </div>
  );
}