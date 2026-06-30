"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, MessageSquare, Send, Trash2, Plus, Users, Check } from "lucide-react";
import { toast } from "sonner";
import { api, type Campaign, type CampaignChannel, type CampaignAudience } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDashboardLocale } from "@/lib/dashboard-locale";

const AUDIENCES: { value: CampaignAudience; label: string; hint: string }[] = [
  { value: "ALL", label: "All clients", hint: "Everyone with a contact on file" },
  { value: "RECENT", label: "Recent", hint: "Visited in the last 30 days" },
  { value: "LAPSED", label: "Win-back", hint: "No visit in 60+ days" },
];

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [composing, setComposing] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const { french, formatDate } = useDashboardLocale();

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try { setCampaigns(await api.campaigns.list(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement" : "Failed to load")); }
    finally { setLoading(false); }
  }, [bizId, french]);
  useEffect(() => { load(); }, [load]);

  async function doSend() {
    if (!campaignToSend) return;
    try {
      const res = await api.campaigns.send(bizId, campaignToSend.id);
      toast.success(`Sending to ${res.recipientCount} client${res.recipientCount === 1 ? "" : "s"}`);
      setCampaignToSend(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); setCampaignToSend(null); }
  }

  async function doRemove() {
    if (!campaignToDelete) return;
    try { await api.campaigns.remove(bizId, campaignToDelete.id); setCampaignToDelete(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setCampaignToDelete(null); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ConfirmDialog
        open={campaignToSend !== null}
        title={`Send "${campaignToSend?.name}" now?`}
        description="This will send the message to all matching clients immediately. This cannot be undone."
        confirmLabel="Send campaign"
        variant="destructive"
        onConfirm={doSend}
        onCancel={() => setCampaignToSend(null)}
      />
      <ConfirmDialog
        open={campaignToDelete !== null}
        title={`Delete "${campaignToDelete?.name}"?`}
        description="This draft will be permanently deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doRemove}
        onCancel={() => setCampaignToDelete(null)}
      />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Marketing</h2>
          <p className="text-sm text-gray-500">{french ? "Joignez vos clients par courriel ou texto — promotions, nouvelles et reconquête." : "Reach your clients by email or text — promotions, news, win-backs."}</p>
        </div>
        {!composing && (
          <Button onClick={() => setComposing(true)}><Plus className="w-4 h-4 mr-1.5" /> {french ? "Nouvelle campagne" : "New campaign"}</Button>
        )}
      </div>

      {composing && <Composer bizId={bizId} onDone={() => { setComposing(false); load(); }} onCancel={() => setComposing(false)} />}

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">{loadError}</p>
          <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{french ? "Réessayer" : "Retry"}</button>
        </div>
      ) : loading ? <LoadingSpinner /> : campaigns.length === 0 && !composing ? (
        <EmptyState title={french ? "Aucune campagne" : "No campaigns yet"} description={french ? "Créez votre première campagne pour joindre vos clients." : "Create your first campaign to start reaching clients."} />
      ) : (
        <div className="space-y-3 mt-4">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {c.channel === "SMS" ? <MessageSquare className="w-4 h-4 text-violet-500 shrink-0" /> : <Mail className="w-4 h-4 text-violet-500 shrink-0" />}
                      <span className="font-medium text-gray-900 truncate">{c.name}</span>
                      <StatusPill status={c.status} />
                    </div>
                    {c.subject && <p className="text-sm text-gray-700 mt-1 truncate">{c.subject}</p>}
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2 whitespace-pre-wrap">{c.body}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {AUDIENCES.find((a) => a.value === c.audience)?.label ?? c.audience}
                      {c.status !== "DRAFT" && ` · sent to ${c.sentCount}/${c.recipientCount}`}
                      {c.sentAt && ` · ${formatDate(c.sentAt, { year: "numeric", month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === "DRAFT" && (
                      <>
                        <button onClick={() => setCampaignToSend(c)} aria-label={french ? "Envoyer la campagne maintenant" : "Send campaign now"} className="text-violet-600 hover:bg-violet-50 p-2 rounded-lg"><Send className="w-4 h-4" /></button>
                        <button onClick={() => setCampaignToDelete(c)} aria-label={french ? "Supprimer la campagne" : "Delete campaign"} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                    {c.status === "SENT" && <Check className="w-5 h-5 text-emerald-500" />}
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

function StatusPill({ status }: { status: Campaign["status"] }) {
  const map = {
    DRAFT: "bg-gray-100 text-gray-600",
    SENDING: "bg-amber-100 text-amber-700",
    SENT: "bg-emerald-100 text-emerald-700",
  } as const;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}

function Composer({ bizId, onDone, onCancel }: { bizId: string; onDone: () => void; onCancel: () => void }) {
  const { french } = useDashboardLocale();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("EMAIL");
  const [audience, setAudience] = useState<CampaignAudience>("ALL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {{name}}, ");
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api.campaigns.audienceCount(bizId, channel, audience).then((r) => { if (live) setCount(r.count); }).catch(() => {});
    return () => { live = false; };
  }, [bizId, channel, audience]);

  async function save(thenSend: boolean) {
    if (!name.trim()) { toast.error(french ? "Donnez un nom à votre campagne" : "Give your campaign a name"); return; }
    if (!body.trim()) { toast.error(french ? "Rédigez un message" : "Write a message"); return; }
    if (channel === "EMAIL" && !subject.trim()) { toast.error(french ? "Les campagnes par courriel nécessitent un objet" : "Email campaigns need a subject"); return; }
    setSaving(true);
    try {
      const c = await api.campaigns.create(bizId, { name, channel, audience, subject: channel === "EMAIL" ? subject : undefined, body });
      if (thenSend) {
        const res = await api.campaigns.send(bizId, c.id);
        toast.success(french ? `Envoi à ${res.recipientCount} client${res.recipientCount === 1 ? "" : "s"}` : `Sending to ${res.recipientCount} client${res.recipientCount === 1 ? "" : "s"}`);
      } else {
        toast.success(french ? "Enregistrée comme brouillon" : "Saved as draft");
      }
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : (french ? "Échec" : "Failed")); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-violet-200">
      <CardContent className="py-5 space-y-4">
        <Input placeholder={french ? "Nom de la campagne (interne)" : "Campaign name (internal)"} value={name} onChange={(e) => setName(e.target.value)} />

        <div className="flex gap-2">
          {(["EMAIL", "SMS"] as CampaignChannel[]).map((ch) => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${channel === ch ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {ch === "SMS" ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}{ch === "SMS" ? "Text (SMS)" : "Email"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {AUDIENCES.map((a) => (
            <button key={a.value} onClick={() => setAudience(a.value)}
              className={`text-left p-3 rounded-xl border transition-colors ${audience === a.value ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <p className={`text-sm font-medium ${audience === a.value ? "text-violet-700" : "text-gray-700"}`}>{a.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{a.hint}</p>
            </button>
          ))}
        </div>

        {channel === "EMAIL" && (
          <Input placeholder={french ? "Objet du courriel" : "Subject line"} value={subject} onChange={(e) => setSubject(e.target.value)} />
        )}

        <div>
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400"
            placeholder={french ? "Votre message…" : "Your message…"} />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-400">Use <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code> and <code className="bg-gray-100 px-1 rounded">{"{{business}}"}</code> as merge tags.</p>
            {channel === "SMS" && (
              <p className={`text-[11px] tabular-nums shrink-0 ml-2 ${body.length > 160 ? "text-amber-600 font-semibold" : "text-gray-400"}`}>
                {body.length} / 160 · {Math.ceil(body.length / 160) || 1} segment{Math.ceil(body.length / 160) > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users className="w-4 h-4 text-gray-400" />
            {count === null ? "…" : <><strong className="text-gray-700">{count}</strong> recipient{count === 1 ? "" : "s"}</>}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>{french ? "Annuler" : "Cancel"}</Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>{french ? "Enregistrer le brouillon" : "Save draft"}</Button>
            <Button onClick={() => save(true)} loading={saving} disabled={!count}><Send className="w-4 h-4 mr-1.5" /> {french ? "Envoyer maintenant" : "Send now"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
