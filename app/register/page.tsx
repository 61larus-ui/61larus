"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Kayıt hatası: " + error.message);
      return;
    }

    if (data.user) {
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: data.user.id,
          email: data.user.email,
          role: "user",
        },
      ]);

      if (insertError) {
        alert("Users tablosuna yazma hatası: " + insertError.message);
        return;
      }
    }

    alert("Kayıt başarılı! Mail onayla.");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h1>Kayıt Ol</h1>

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
        onClick={handleRegister}
        style={{
          width: "100%",
          padding: 10,
          backgroundColor: "black",
          color: "white",
          borderRadius: 6,
          border: "none",
        }}
      >
        Kayıt Ol
      </button>
    </div>
  );
}