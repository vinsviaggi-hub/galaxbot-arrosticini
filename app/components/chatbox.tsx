"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "arrost_chat_history_v1";

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Ciao! Sono l’assistente del laboratorio. Dimmi cosa ti serve: orari, ritiro/consegna, come prenotare scatole 50/100/200, info generali.",
};

export default function ChatBox() {
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [WELCOME];

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed as Msg[];
      }
    } catch {}
    return [WELCOME];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // salva chat (max 80)
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
    } catch {}
  }, [messages]);

  // scroll giù
  useEffect(() => {
    try {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    } catch {}
  }, [messages, loading]);

  // ultimi 20 messaggi max
  const historyToSend = useMemo(() => messages.slice(-20), [messages]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    // costruiamo subito la history completa (evita storia vecchia)
    const nextHistory = [...historyToSend, { role: "user" as const, content: text }];

    // aggiungo subito user in UI
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
        }),
      });

      const out = await res.json().catch(() => null);

      if (!res.ok || !out?.reply) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: out?.error || "Errore. Riprova tra poco." },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: String(out.reply) }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Errore rete. Controlla connessione." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    const base: Msg[] = [WELCOME];
    setMessages(base);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    } catch {}
  }

  return (
    <div className="chatWrap">
      {/* ✅ tolti i bottoni “Orari / Come prenotare / Consegna / Svuota” */}

      <div className="chatList" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="bubble assistant">Sto scrivendo…</div>}
      </div>

      <div className="chatInputRow">
        <input
          className="chatInput"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi una domanda…"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="chatSend" onClick={() => send()} disabled={loading}>
          {loading ? "..." : "Invia"}
        </button>
      </div>

      <div className="chatHint">
        Se vuoi prenotare: usa il modulo. Qui l’assistente risponde a <b>una domanda per volta</b>.
        {/* opzionale, discreto */}
        <button
          type="button"
          onClick={clearChat}
          disabled={loading}
          style={{
            marginLeft: 10,
            fontWeight: 900,
            fontSize: 12,
            background: "transparent",
            border: "none",
            color: "rgba(244,246,255,.72)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Svuota chat
        </button>
      </div>
    </div>
  );
}