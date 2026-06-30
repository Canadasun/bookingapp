"use client";

import { useEffect, useState, useCallback } from "react";
import { Gift, Plus, Ban, Copy, Check, Ticket } from "lucide-react";
import { toast } from "sonner";
import { api, type GiftCard, type GiftCardStatus } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<null | "issue" | "redeem">(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [cardToVoid, setCardToVoid] = useState<GiftCard | null>(null);
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const { french, formatCurrency, formatDate } = useDashboardLocale();

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try { setCards(await api.giftCards.list(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement" : "Failed to load")); }
    finally { setLoading(false); }
  }, [bizId, french]);
  useEffect(() => { load(); }, [load]);

  async function doVoidCard() {
    if (!cardToVoid) return;
    try { await api.giftCards.void(bizId, cardToVoid.id); setCardToVoid(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setCardToVoid(null); }
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code)
      .then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); })
      .catch(() => toast.error("Could not copy to clipboard"));
  }

  const outstanding = cards.filter((c) => c.status === "ACTIVE").reduce((s, c) => s + c.balanceCents, 0);

  return (
    <div className="max-w-3xl mx-auto">
      <ConfirmDialog
        open={cardToVoid !== null}
        title={french ? `Annuler la carte-cadeau ${cardToVoid?.code}?` : `Void gift card ${cardToVoid?.code}?`}
        description={french ? "Son solde restant ne pourra plus être utilisé." : "Its remaining balance can no longer be used."}
        confirmLabel={french ? "Annuler la carte" : "Void card"}
        variant="destructive"
        onConfirm={doVoidCard}
        onCancel={() => setCardToVoid(null)}
      />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{french ? "Cartes-cadeaux" : "Gift cards"}</h2>
          <p className="text-sm text-gray-500">{french ? "Vendez ou offrez des cartes-cadeaux, puis échangez-les au paiement." : "Sell or comp gift cards, then redeem them at checkout."}</p>
          {outstanding > 0 && <p className="text-xs text-gray-400 mt-1">{formatCurrency(outstanding)} {french ? "à utiliser sur les cartes actives" : "outstanding across active cards"}</p>}
        </div>
        {!mode && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setMode("redeem")}><Ticket className="w-4 h-4 mr-1.5" /> {french ? "Échanger" : "Redeem"}</Button>
            <Button onClick={() => setMode("issue")}><Plus className="w-4 h-4 mr-1.5" /> {french ? "Émettre" : "Issue"}</Button>
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
        <EmptyState title={french ? "Aucune carte-cadeau" : "No gift cards yet"} description={french ? "Émettez votre première carte-cadeau pour commencer." : "Issue your first gift card to get started."} />
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
                      {c.recipientName ? `${french ? "Pour" : "For"} ${c.recipientName}` : (french ? "Aucun destinataire" : "No recipient")}
                      {c.recipientEmail ? ` · ${c.recipientEmail}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {french ? "Émise le" : "Issued"} {formatDate(c.createdAt, { year: "numeric", month: "short", day: "numeric" })}
                      {c.expiresAt ? ` · ${french ? "expire le" : "expires"} ${formatDate(c.expiresAt, { year: "numeric", month: "short", day: "numeric" })}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(c.balanceCents)}</p>
                    <p className="text-xs text-gray-400">{french ? "sur" : "of"} {formatCurrency(c.initialCents)}</p>
                    {c.status === "ACTIVE" && (
                      <button onClick={() => setCardToVoid(c)} className="text-xs text-gray-400 hover:text-red-600 inline-flex items-center gap-1 mt-1.5">
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
  const [recipientLocale, setRecipientLocale] = useState<"en" | "fr">("en");
  const [saving, setSaving] = useState(false);
  const { french } = useDashboardLocale();

  async function submit() {
    const dollars = parseFloat(amount);
    if (!dollars || dollars < 1) { toast.error(french ? "Entrez un montant d’au moins 1 $" : "Enter an amount of at least $1"); return; }
    setSaving(true);
    try {
      const card = await api.giftCards.issue(bizId, {
        amountCents: Math.round(dollars * 100),
        recipientName: recipientName || undefined,
        recipientEmail: recipientEmail || undefined,
        message: message || undefined,
        locale: recipientLocale,
      });
      toast.success(french ? `${card.code} émise${card.recipientEmail ? " — envoyée au destinataire" : ""}` : `Issued ${card.code}${card.recipientEmail ? " — emailed to recipient" : ""}`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        <div>
          <label htmlFor="gc-issue-amount" className="text-xs font-medium text-gray-500">{french ? "Montant ($)" : "Amount ($)"}</label>
          <Input id="gc-issue-amount" type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input aria-label="Recipient name (optional)" placeholder="Recipient name (optional)" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          <Input aria-label="Recipient email (optional)" type="email" placeholder="Recipient email (optional)" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
        </div>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400"
          placeholder="Gift message (optional)" />
        <div>
          <label htmlFor="gc-recipient-language" className="text-xs font-medium text-gray-500">{french ? "Langue du destinataire" : "Recipient language"}</label>
          <select id="gc-recipient-language" value={recipientLocale} onChange={(e) => setRecipientLocale(e.target.value as "en" | "fr")}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>
        <p className="text-[11px] text-gray-400">If you add a recipient email we&apos;ll send them the code automatically.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>{french ? "Annuler" : "Cancel"}</Button>
          <Button onClick={submit} loading={saving}>{french ? "Émettre la carte-cadeau" : "Issue gift card"}</Button>
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
  const { french, formatCurrency } = useDashboardLocale();

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
      toast.success(french ? `${formatCurrency(r.redeemedCents)} échangés — solde de ${formatCurrency(r.balanceCents)}` : `Redeemed ${formatCurrency(r.redeemedCents)} — ${formatCurrency(r.balanceCents)} left`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Redeem failed"); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="GIFT-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          <Button variant="outline" onClick={check} loading={checking}>{french ? "Vérifier" : "Check"}</Button>
        </div>
        {bal && (
          <p className="text-sm text-gray-600">
            {french ? "Solde" : "Balance"}: <strong className="text-gray-900">{formatCurrency(bal.balanceCents)}</strong>
            <span className="text-gray-400"> · {bal.status}</span>
          </p>
        )}
        <div>
          <label htmlFor="gc-redeem-amount" className="text-xs font-medium text-gray-500">{french ? "Montant à échanger ($)" : "Amount to redeem ($)"}</label>
          <Input id="gc-redeem-amount" type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onCancel} disabled={saving}>{french ? "Annuler" : "Cancel"}</Button>
          <Button onClick={submit} loading={saving}>{french ? "Échanger" : "Redeem"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
