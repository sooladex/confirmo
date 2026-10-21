"use client";
import Link from "next/link";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Une erreur est survenue. Réessayez.");
      window.location.href = "/app";
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={submit}>
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" />Confirmo</Link>
        <h1>{signup ? "Créer votre compte" : "Se connecter"}</h1>
        {signup && (
          <label className="field">Nom de la boutique
            <input id="shop" name="shop" required maxLength={80} placeholder="Ex. Dar Caftan" autoComplete="organization" />
          </label>
        )}
        <label className="field">E-mail
          <input id="email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">Mot de passe
          <input id="password" name="password" type="password" required minLength={signup ? 8 : 1}
            autoComplete={signup ? "new-password" : "current-password"} />
        </label>
        {signup && <p className="hint">8 caractères minimum.</p>}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary lg" disabled={busy}>
          {busy ? "Un instant…" : signup ? "Créer mon compte" : "Se connecter"}
        </button>
        <p className="hint">
          {signup ? <>Déjà un compte ? <Link href="/login">Se connecter</Link></> : <>Pas encore de compte ? <Link href="/signup">Créer un compte</Link></>}
        </p>
      </form>
    </main>
  );
}
