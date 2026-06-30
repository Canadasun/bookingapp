"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const SUBJECTS_EN = [
  "Cancel or reschedule an appointment",
  "Refund or charge dispute",
  "I can't log in to my account",
  "My booking confirmation didn't arrive",
  "Delete my account or data",
  "Business owner – billing issue",
  "Business owner – payout / Stripe issue",
  "Business owner – account access",
  "Other",
];

const SUBJECTS_FR = [
  "Annuler ou reporter un rendez-vous",
  "Remboursement ou contestation de frais",
  "Je n’arrive pas à me connecter à mon compte",
  "Ma confirmation de réservation n’est pas arrivée",
  "Supprimer mon compte ou mes données",
  "Propriétaire d’entreprise – problème de facturation",
  "Propriétaire d’entreprise – paiement / problème Stripe",
  "Propriétaire d’entreprise – accès au compte",
  "Autre",
];

export function SupportForm({ locale = "en" }: { locale?: "en" | "fr" }) {
  const fr = locale === "fr";
  const subjects = fr ? SUBJECTS_FR : SUBJECTS_EN;
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      setError(fr ? "Veuillez remplir tous les champs." : "Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError(fr ? "Une erreur s’est produite. Veuillez écrire directement à support@pulseappointments.com." : "Something went wrong. Please email support@pulseappointments.com directly.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="text-base font-semibold text-slate-800">{fr ? "Message reçu" : "Message received"}</p>
        <p className="text-sm text-slate-500">
          {fr ? <>Nous répondrons à <strong>{form.email}</strong> dans un délai d’un jour ouvrable.</> : <>We&apos;ll reply to <strong>{form.email}</strong> within one business day.</>}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{fr ? "Votre nom" : "Your name"} <span className="text-red-400">*</span></label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={fr ? "Jeanne Tremblay" : "Jane Smith"}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{fr ? "Adresse courriel" : "Email address"} <span className="text-red-400">*</span></label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={fr ? "jeanne@exemple.com" : "jane@example.com"}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{fr ? "Pour quoi avez-vous besoin d’aide?" : "What do you need help with?"} <span className="text-red-400">*</span></label>
        <select
          required
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">{fr ? "Sélectionnez un sujet…" : "Select a topic…"}</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{fr ? "Détails" : "Details"} <span className="text-red-400">*</span></label>
        <textarea
          rows={4}
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder={fr ? "Décrivez votre problème — plus il y a de détails, plus vite nous pourrons vous aider." : "Describe your issue — the more detail, the faster we can help."}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        />
      </div>
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
      >
        {loading ? (fr ? "Envoi…" : "Sending…") : (fr ? "Envoyer le message" : "Send message")}
      </button>
      <p className="text-xs text-slate-400 text-center">{fr ? "Nous répondons dans un délai d’un jour ouvrable." : "We respond within one business day."}</p>
    </form>
  );
}
