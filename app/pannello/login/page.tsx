"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);

    setLoading(false);

    if (!r) return setMsg("Errore rete.");
    const data = await r.json().catch(() => null);

    if (!r.ok || data?.ok === false) {
      return setMsg(data?.error || "Login fallito.");
    }

    router.push("/pannello");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form
        onSubmit={onLogin}
        style={{
          width: "min(420px, 100%)",
          background: "rgba(10,14,22,.92)",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 10 }}>🔒 Pannello Prenotazioni</h1>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
          Inserisci la password per vedere le prenotazioni.
        </div>

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(255,255,255,.06)",
            color: "white",
            outline: "none",
          }}
        />

        <button
          disabled={loading}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(90deg, #ff3b30, #ffcc00)",
            fontWeight: 900,
            color: "rgba(16,20,30,.92)",
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Accesso..." : "Entra"}
        </button>

        <div style={{ marginTop: 10, minHeight: 18, fontSize: 13, color: "#ffd1d1" }}>
          {msg}
        </div>
      </form>
    </div>
  );
}