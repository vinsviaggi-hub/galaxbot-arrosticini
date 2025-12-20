"use client";

import React, { useMemo, useState, type FormEvent } from "react";
import ChatBox from "./components/chatbox";

type Status = "idle" | "loading" | "success" | "error";
type OrderType = "ASPORTO" | "CONSEGNA" | "TAVOLO";

export default function Page() {
  // ✅ DATI CLIENTE (cambi solo questi)
  const BUSINESS_NAME = "Pala Pizza 🍕";
  const TAGLINE = "Pizzeria & Ristorante · Ordina o prenota in pochi secondi";
  const ADDRESS = "Via Roma 10, 00100 Roma (RM)";
  // ✅ Numero NON tuo (casuale)
  const PHONE = "+39 333 111 2233";

  const HOURS = useMemo(
    () => [
      { day: "Lun–Gio", time: "12:00–15:00 · 18:00–23:00" },
      { day: "Ven–Sab", time: "12:00–15:00 · 18:00–00:00" },
      { day: "Dom", time: "18:00–23:00" },
    ],
    []
  );

  const mapsLink = useMemo(() => {
    const q = encodeURIComponent(`${BUSINESS_NAME}, ${ADDRESS}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [BUSINESS_NAME, ADDRESS]);

  // === FORM ===
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<OrderType>("ASPORTO");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [order, setOrder] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const isDelivery = type === "CONSEGNA";
  const isTable = type === "TAVOLO";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!name.trim()) return setMsg("Scrivi il nome.");
    if (!phone.trim()) return setMsg("Scrivi un numero di telefono.");
    if (!date) return setMsg("Scegli una data.");
    if (!time) return setMsg("Scegli un orario.");

    if (isDelivery && !address.trim()) return setMsg("Per la consegna serve l’indirizzo.");
    if (!order.trim()) {
      return setMsg(
        isTable
          ? "Scrivi: numero persone + preferenza (interno/esterno)."
          : "Scrivi cosa vuoi ordinare."
      );
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ✅ allineato alla tua API /api/bookings (nome, telefono, tipo, data, ora...)
          nome: name.trim(),
          telefono: phone.trim(),
          tipo: type,
          data: date, // ✅ FIX BUILD: prima era "data," senza variabile
          ora: time,
          ordine: order.trim(),
          indirizzo: isDelivery ? address.trim() : "",
          note: notes.trim(),
          botOrManuale: "WEBAPP",
          negozio: BUSINESS_NAME,
        }),
      });

      const dataRes = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setMsg(dataRes?.error || "Errore durante l’invio. Riprova.");
        return;
      }

      setStatus("success");
      setMsg("Richiesta inviata ✅ Ti ricontattiamo appena possibile.");

      setName("");
      setPhone("");
      setDate("");
      setTime("");
      setOrder("");
      setAddress("");
      setNotes("");

      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("error");
      setMsg("Errore di rete. Controlla la connessione e riprova.");
    }
  }

  const inputClass =
    "w-full rounded-2xl bg-white/80 border border-black/10 px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-zinc-900 placeholder:text-zinc-500";
  const labelClass = "mb-1 text-sm font-semibold text-zinc-800";

  return (
    <main
      className="min-h-screen text-zinc-900"
      style={{
        background:
          "radial-gradient(1000px 700px at 10% 10%, rgba(255,187,122,0.55), transparent 60%)," +
          "radial-gradient(900px 650px at 90% 0%, rgba(255,120,120,0.35), transparent 55%)," +
          "radial-gradient(900px 650px at 70% 95%, rgba(80,200,140,0.22), transparent 55%)," +
          "linear-gradient(180deg, rgba(255,245,230,1) 0%, rgba(255,236,214,1) 35%, rgba(255,246,238,1) 100%)",
      }}
    >
      {/* HEADER */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-6">
        <div className="rounded-[28px] border border-black/10 bg-white/55 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.10)] overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                  {BUSINESS_NAME}
                </h1>
                <p className="text-zinc-700 text-base md:text-lg">{TAGLINE}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-black/10 px-3 py-2 text-sm font-medium text-zinc-800">
                    📍 {ADDRESS}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-black/10 px-3 py-2 text-sm font-medium text-zinc-800">
                    ☎️ {PHONE}
                  </span>
                </div>

                {/* Orari a tendina */}
                <details className="mt-3 inline-block">
                  <summary className="cursor-pointer select-none inline-flex items-center gap-2 rounded-full bg-white/70 border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-white">
                    🕒 Orari di apertura <span className="text-zinc-500">▾</span>
                  </summary>
                  <div className="mt-2 w-[320px] max-w-full rounded-2xl border border-black/10 bg-white/85 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                    <ul className="space-y-2 text-sm text-zinc-800">
                      {HOURS.map((h) => (
                        <li key={h.day} className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{h.day}</span>
                          <span className="text-zinc-700">{h.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </div>

              <div className="flex flex-col gap-3 md:min-w-[240px]">
                <a
                  href={`tel:${PHONE.replace(/\s+/g, "")}`}
                  className="rounded-2xl bg-emerald-600 text-white px-5 py-3 text-center font-extrabold shadow-[0_10px_22px_rgba(16,185,129,0.22)] hover:bg-emerald-700 active:scale-[0.99]"
                >
                  Chiama ora
                </a>

                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-white/75 border border-black/10 px-5 py-3 text-center font-extrabold text-zinc-900 hover:bg-white active:scale-[0.99]"
                >
                  Indicazioni
                </a>

                <div className="rounded-2xl border border-black/10 bg-white/55 px-4 py-3 text-sm text-zinc-700">
                  Per ordini e prenotazioni, compila il modulo qui sotto.
                </div>
              </div>
            </div>
          </div>

          {/* barra colore (pizza vibes) */}
          <div
            className="h-2"
            style={{
              background:
                "linear-gradient(90deg, rgba(220,38,38,1) 0%, rgba(245,158,11,1) 45%, rgba(22,163,74,1) 100%)",
            }}
          />
        </div>
      </section>

      {/* CONTENUTO */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="grid gap-6 md:grid-cols-2">
          {/* FORM */}
          <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.10)] p-6">
            <h2 className="text-2xl font-extrabold">Ordina / Prenota</h2>
            <p className="mt-1 text-zinc-700">Inserisci i dati e invia la richiesta.</p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className={labelClass}>Nome</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Es. Marco"
                    autoComplete="name"
                  />
                </label>

                <label className="block">
                  <div className={labelClass}>Telefono</div>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="Es. 327 000 1122"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
              </div>

              <label className="block">
                <div className={labelClass}>Tipo</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OrderType)}
                  className={inputClass}
                >
                  <option value="ASPORTO">Asporto</option>
                  <option value="CONSEGNA">Consegna</option>
                  <option value="TAVOLO">Tavolo</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className={labelClass}>Data</div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <div className={labelClass}>Ora</div>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <div className={labelClass}>{isTable ? "Dettagli tavolo" : "Ordine"}</div>
                <textarea
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  className={
                    inputClass + " min-h-[110px] resize-none leading-relaxed"
                  }
                  placeholder={
                    isTable
                      ? "Es. 2 persone, interno (oppure 4 persone, esterno)"
                      : "Es. 2 margherite + 1 coca · (allergie? scrivilo qui)"
                  }
                />
              </label>

              {isDelivery && (
                <label className="block">
                  <div className={labelClass}>Indirizzo consegna</div>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={
                      inputClass + " min-h-[90px] resize-none leading-relaxed"
                    }
                    placeholder="Via, numero, citofono, interno…"
                  />
                </label>
              )}

              <label className="block">
                <div className={labelClass}>Note (opzionale)</div>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Es. senza glutine, no cipolla, ecc."
                />
              </label>

              {!!msg && (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-semibold",
                    status === "success"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : status === "error"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-black/10 bg-white/70 text-zinc-800",
                  ].join(" ")}
                >
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-2xl bg-emerald-700 text-white px-5 py-3 font-extrabold shadow-[0_10px_22px_rgba(16,185,129,0.18)] hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {status === "loading" ? "Invio in corso…" : "Invia"}
              </button>
            </form>
          </div>

          {/* CHAT */}
          <div className="rounded-[28px] border border-black/10 bg-white/60 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.10)] p-6">
            <h2 className="text-2xl font-extrabold">Chat assistente</h2>
            <p className="mt-1 text-zinc-700">
              Qui solo info: menu, senza glutine, allergeni, ingredienti, ecc. <br />
              Per ordini/prenotazioni usa il modulo a sinistra.
            </p>

            <div className="mt-4">
              <ChatBox />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}