"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function ImageUpload({ value, kind, onChange, shape = "square", documents = false }: {
  value?: string | null;
  kind?: "LOGO" | "AVATAR" | "COVER";
  onChange: (url: string | null) => void;
  shape?: "square" | "circle";
  documents?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const maxBytes = documents ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxBytes) { toast.error(documents ? "File must be 5 MB or smaller" : "Image must be 2 MB or smaller"); return; }
    setBusy(true);
    try {
      const { url } = await api.uploads.upload(file, kind);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";
  return (
    <div className="flex items-center gap-4">
      <div className={`w-16 h-16 ${radius} border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0`}>
        {value && !documents
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="Uploaded image" className="w-full h-full object-cover" />
          : <Upload className="w-5 h-5 text-gray-300" />}
      </div>
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept={documents ? "image/png,image/jpeg,image/webp,image/gif,application/pdf" : "image/png,image/jpeg,image/webp,image/gif"} className="hidden" onChange={pick} />
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <button type="button" onClick={() => onChange(null)}
            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" aria-label="Remove image">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">{documents ? "PDF, PNG, JPG, WebP or GIF · up to 5 MB" : "PNG, JPG, WebP or GIF · up to 2 MB"}</p>
    </div>
  );
}
