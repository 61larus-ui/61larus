"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert("Kayıt başarılı! Mailini kontrol et.");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Kayıt Ol</h1>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <input
        placeholder="Şifre"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10, width: "100%" }}
      />

      <button onClick={handleRegister} style={{ width: "100%" }}>
        Kayıt Ol
      </button>
    </div>
  );
}