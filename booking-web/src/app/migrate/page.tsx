"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ArrowRight, Truck } from "lucide-react";

const PLATFORMS = [
  "Vagaro", "Jane App", "Square Appointments", "Acuity Scheduling",
  "Calendly", "GlossGenius", "Mindbody", "Fresha", "Booksy",
  "SimplyBook", "Setmore", "Other",
];

const STEPS = [
  {
    n: "1",
    title: "Fill out this form",
    body: "Tell us which platform you're leaving and what you need moved. Takes 2 minutes.",
  },
  {
    n: "2",
    title: "We set up your Pulse account",
    body: "Our team configures your services, staff, hours, and intake questions — done in 48 hours.",
  },
  {
    n: "3",
    title: "Your clients come with you",
    body: "We import your full client list — names, emails, phone numbers — so nobody gets left behind.",
  },
];

const INCLUDED = [
  "Client list (name, email, phone)",
  "Service menu and pricing",
  "Staff profiles and working hours",
  "Intake / consultation questions",
  "Business settings and booking policies",
];

export default function MigratePage() {
  const [form, setForm] = useState({
    name: "", email: "", business: "", platform: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.business || !form.platform) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/migrate-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong — please email us at support@pulseappointments.com and we'll get back to you within a few hours.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-gray-900">Pulse Appointments</span>
          </Link>
          <Link href="/register" className="text-sm font-semibold bg-violet-600 text-white rounded-lg px-4 py-1.5 hover:bg-violet-700 transition-colors">
            Try free →
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-700 text-sm font-semibold px-4 py-2 rounded-full">
            <Truck className="w-4 h-4" /> Free Migration — 48 Hours
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Switch to Pulse.<br />We move everything for you.
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Your client list, services, staff, and settings — migrated from your old platform to Pulse in 48 hours.
            Free. No tech skills needed.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left: what's included + how it works */}
          <div className="space-y-8">
            {/* What we move */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-base">What we migrate for free</h2>
              <ul className="space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
                We work directly with your data export from Vagaro, Square, Acuity, Jane, and most other platforms. Need something not listed? Just mention it in the notes field.
              </p>
            </div>

            {/* How it works */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-900 text-base">How it works</h2>
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {s.n}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial placeholder */}
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-5">
              <p className="text-sm text-violet-800 italic">
                &ldquo;I was on Vagaro for 4 years and always put off switching because of my client list. The Pulse team moved everything over in a day. I didn&apos;t lose a single contact.&rdquo;
              </p>
              <p className="text-xs text-violet-600 font-semibold mt-2">— Salon owner, Toronto</p>
            </div>
          </div>

          {/* Right: form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
            {submitted ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                <h3 className="text-xl font-bold text-gray-900">Request received!</h3>
                <p className="text-gray-500 text-sm">
                  We&apos;ll email you at <strong>{form.email}</strong> within a few hours to get started.
                  Most migrations complete within 48 hours.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-violet-600 text-white font-semibold text-sm rounded-xl px-6 py-3 hover:bg-violet-700 transition-colors mt-4"
                >
                  Create your Pulse account now <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-bold text-gray-900 text-lg mb-2">Request your free migration</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@mybusiness.ca"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.business}
                    onChange={(e) => setForm({ ...form, business: e.target.value })}
                    placeholder="Bliss Lash Studio"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform you&apos;re leaving <span className="text-red-400">*</span></label>
                  <select
                    required
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="">Select platform…</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anything else? <span className="text-gray-400">(optional)</span></label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="e.g. I have ~200 clients, 3 staff, and need services imported too."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
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
                  {loading ? "Sending…" : "Request free migration →"}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  We respond within a few hours · Free for all new Pulse accounts
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Compare links */}
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-gray-500">Switching from a specific platform?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              ["Vagaro",              "/compare/pulse-vs-vagaro"],
              ["Square",             "/compare/pulse-vs-square-appointments"],
              ["Calendly",           "/compare/pulse-vs-calendly"],
              ["Acuity",             "/compare/pulse-vs-acuity-scheduling"],
              ["Jane App",           "/compare/pulse-vs-jane-app"],
              ["GlossGenius",        "/compare/pulse-vs-glossgenius"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-violet-600 font-medium border border-violet-200 rounded-full px-4 py-1.5 hover:bg-violet-50 transition-colors"
              >
                Pulse vs. {label}
              </Link>
            ))}
          </div>
        </div>

      </main>

      <footer className="border-t border-gray-100 bg-white mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
          <Link href="/" className="font-semibold text-gray-700">Pulse Appointments</Link>
          <div className="flex gap-5">
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/compare" className="hover:text-gray-600">Compare</Link>
            <Link href="/support" className="hover:text-gray-600">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
