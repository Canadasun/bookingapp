"use client";

import { useEffect, useState, useCallback } from "react";
import { Gift, Plus, Ban, Copy, Check, Ticket } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api, type GiftCard, type GiftCardStatus } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<null | "issue" | "redeem">(null);
  const [copied, setCopied] = useState<string | null>(null);
  const user = getUser();
  const bizId = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try { setCards(await api.giftCards.list(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  async function voidCard(c: GiftCard) {
    if (!confirm(`Void gift card ${c.code}? Its remaining balance can no longer be used.`)) return;
    try { await api.giftCards.void(bizId, c.id); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); });
  }

  const outstanding = cards.filter((c) => c.status === "ACTIVE").reduce((s, c) => s + c.balanceCents, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gift cards</h2>
          <p className="text-sm text-gray-500">Sell or comp gift cards, then redeem them at checkout.</p>
          {outstanding > 0 && <p className="text-xs text-gray-400 mt-1">{formatPrice(outstanding)} outstanding across active cards</p>}
        </div>
        {!mode && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setMode("redeem")}><Ticket className="w-4 h-4 mr-1.5" /> Redeem</Button>
            <Button onClick={() => setMode("issue")}><Plus className="w-4 h-4 mr-1.5" /> Issue</Button>
          </div>
        )}
      </div>

      {mode === "issue" && <IssueForm bizId={bizId} onDone={() => { setMode(null); load(); }} onCancel={() => setMode(null)} />}
      {mode === "redeem" && <RedeemForm bizId={bizId} onDone={() => { setMode(null); load(); }} onCancel={() => setMode(null)} />}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
        </div>
      ) : loading ? <LoadingSpinner /> : cards.length === 0 && !mode ? (
        <EmptyState title="No gift cards yet" description="Issue your first gift card to get started." />
      ) : (
        <div className="space-y-3 mt-4">
          {cards.map((c) => (
            <Card key={c.id} className={c.status === "ACTIVE" ? "" : "opacity-70"}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-violet-500 shrink-0" />
                      <button onClick={() => copy(c.code)} className="font-mono font-semibold text-gray-900 hover:text-violet-600 inline-flex items-center gap-1.5">
                        {c.code}
                        {copied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                      <StatusPill status={c.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {c.recipientName ? `For ${c.recipientName}` : "No recipient"}
                      {c.recipientEmail ? ` · ${c.recipientEmail}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Issued {format(new Date(c.createdAt), "MMM d, yyyy")}
                      {c.expiresAt ? ` · expires ${format(new Date(c.expiresAt), "MMM d, yyyy")}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">{formatPrice(c.balanceCents)}</p>
                    <p className="text-xs text-gray-400">of {formatPrice(c.initialCents)}</p>
                    {c.status === "ACTIVE" && (
                      <button onClick={() => voidCard(c)} className="text-xs text-gray-400 hover:text-red-600 inline-flex items-center gap-1 mt-1.5">
                        <Ban className="w-3 h-3" /> Void
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: GiftCardStatus }) {
  const map = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    REDEEMED: "bg-gray-100 text-gray-500",
    VOID: "bg-red-100 text-red-600",
  } as const;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

function IssueForm({ bizId, onDone, onCancel }: { bizId: string; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState("50");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const dollars = parseFloat(amount);
    if (!dollars || dollars < 1) { toast.error("Enter an amount of at least $1"); return; }
    setSaving(true);
    try {
      const card = await api.giftCards.issue(bizId, {
        amountCents: Math.round(dollars * 100),
        recipientName: recipientName || undefined,
        recipientEmail: recipientEmail || undefined,
        message: message || undefined,
      });
      toast.success(`Issued ${card.code}${card.recipientEmail ? " — emailed to recipient" : ""}`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Amount ($)</label>
          <Input type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Recipient name (optional)" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          <Input type="email" placeholder="Recipient email (optional)" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
        </div>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400"
          placeholder="Gift message (optional)" />
        <p className="text-[11px] text-gray-400">If you add a recipient email we&apos;ll send them the code automatically.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Issue gift card</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RedeemForm({ bizId, onDone, onCancel }: { bizId: string; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [checking, setChecking] = useState(false);
  const [bal, setBal] = useState<{ balanceCents: number; status: GiftCardStatus } | null>(null);
  const [saving, setSaving] = useState(false);

  async function check() {
    if (!code.trim()) return;
    setChecking(true); setBal(null);
    try { const r = await api.giftCards.balance(bizId, code.trim()); setBal({ balanceCents: r.balanceCents, status: r.status }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Card not found"); }
    finally { setChecking(false); }
  }

  async function submit() {
    const dollars = parseFloat(amount);
    if (!code.trim()) { toast.error("Enter a code"); return; }
    if (!dollars || dollars <= 0) { toast.error("Enter an amount to redeem"); return; }
    setSaving(true);
    try {
      const r = await api.giftCards.redeem(bizId, { code: code.trim(), amountCents: Math.round(dollars * 100) });
      toast.success(`Redeemed ${formatPrice(r.redeemedCents)} — ${formatPrice(r.balanceCents)} left`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Redeem failed"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="GIFT-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          <Button variant="outline" onClick={check} loading={checking}>Check</Button>
        </div>
        {bal && (
          <p className="text-sm text-gray-600">
            Balance: <strong className="text-gray-900">{formatPrice(bal.balanceCents)}</strong>
            <span className="text-gray-400"> · {bal.status}</span>
          </p>
        )}
        <div>
          <label className="text-xs font-medium text-gray-500">Amount to redeem ($)</label>
          <Input type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Redeem</Button>
        </div>
      </CardContent>
    </Card>
  );
}
