import Link from "next/link";
import { Accessibility, Keyboard, Eye, Volume2, RefreshCw, Mail, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Accessibility Statement — Pulse" };

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Booking</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">Accessibility Statement</h1>
            <p className="text-emerald-100 text-sm">Last reviewed: June 12, 2026 · Pulse Appointments Inc.</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 flex gap-4 text-slate-700">
              <Accessibility className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                Pulse Appointments is committed to ensuring that our web platform and mobile application are accessible to everyone, including people with disabilities. We believe that equal digital access is a matter of human dignity — not a feature, but a right.
              </p>
            </div>

            {/* Our Commitment */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Our Commitment
              </h2>
              <div className="space-y-3">
                <p>
                  Pulse Appointments actively engineers its web dashboard (<strong>www.pulseappointments.com</strong>) and client booking portal to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.2, Level AA</strong>. These guidelines are published by the World Wide Web Consortium (W3C) and represent the internationally recognized standard for digital accessibility.
                </p>
                <p>
                  Our engineering team conducts targeted accessibility reviews aligned with the four POUR governing principles:
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {[
                    { label: "Perceivable", desc: "Content is presentable in ways all users can perceive, including adequate colour contrast (minimum 4.5:1 ratio) and meaningful text alternatives." },
                    { label: "Operable", desc: "All interface components and navigation are operable by keyboard alone, with no time-limited interactions that cannot be extended." },
                    { label: "Understandable", desc: "Text is readable and predictable. Forms include descriptive labels and clear error messages." },
                    { label: "Robust", desc: "Content is compatible with current and future assistive technologies including screen readers and browser accessibility APIs." },
                  ].map(({ label, desc }) => (
                    <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1">
                      <p className="font-semibold text-slate-800 text-xs uppercase tracking-wide">{label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Ongoing Actions */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-500" /> Ongoing Actions
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Keyboard className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Full Keyboard Navigation</p>
                    <p className="text-slate-500">All interactive elements — modals, drawers, dropdown menus, date pickers, and form controls — are fully operable without a mouse. Escape key closes all overlays. Focus is trapped within open dialogs and restored on close. A visible skip-to-content link is available at the top of every page.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Screen Reader Compatibility</p>
                    <p className="text-slate-500">We use semantic HTML5 landmarks (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">main</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">nav</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">header</code>) and ARIA roles (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">role=&quot;dialog&quot;</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-modal</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-labelledby</code>) throughout the platform. Live-region announcements are issued for async state changes. All interactive controls carry descriptive <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-label</code> attributes.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Eye className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Colour Contrast &amp; Visual Clarity</p>
                    <p className="text-slate-500">Text and interactive elements are tested to meet the WCAG 2.2 AA minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text. Colour is never the only means of conveying information.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Known Limitations */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Known Limitations</h2>
              <p className="text-slate-600">
                While we strive for full WCAG 2.2 AA conformance, some third-party embedded components (such as the Stripe payment element) are outside our direct control and may not fully conform. We work with these vendors to encourage accessible design and provide alternative paths where possible.
              </p>
            </section>

            {/* Feedback and Assistance Channel */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-500" /> Feedback &amp; Assistance Channel
              </h2>
              <p className="text-slate-600 mb-4">
                If you encounter an accessibility barrier on any Pulse page or feature, we want to hear about it. Your feedback directly informs our remediation priorities.
              </p>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Report an Accessibility Barrier</p>
                <ul className="text-sm text-slate-600 space-y-1.5">
                  <li><strong>Email:</strong> <a href="mailto:support@pulseappointments.com?subject=Accessibility%20Feedback" className="text-violet-600 hover:underline">support@pulseappointments.com</a></li>
                  <li><strong>Subject line:</strong> Accessibility Feedback</li>
                  <li><strong>Include:</strong> The page URL, the assistive technology you use, and a description of the barrier</li>
                  <li><strong>Response time:</strong> We aim to respond within 2 business days and to remediate confirmed barriers within 30 days</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                If you require content in an alternative format or need assistance completing a task on our platform, contact us at the address above and we will provide reasonable accommodation.
              </p>
            </section>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">Questions? support@pulseappointments.com</p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-violet-600 font-semibold text-sm hover:underline">Privacy Policy</Link>
                <Link href="/support" className="text-violet-600 font-semibold text-sm hover:underline">Support</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
