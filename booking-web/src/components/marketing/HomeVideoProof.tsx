"use client";

import { useState } from "react";
import { Play, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function HomeVideoProof({
  videoId,
  title,
  playLabel,
  privacyNote,
}: {
  videoId: string;
  title: string;
  playLabel: string;
  privacyNote: string;
}) {
  const [playing, setPlaying] = useState(false);
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-[1.5rem] bg-black shadow-2xl shadow-violet-100">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setPlaying(true);
          trackEvent("homepage_proof_video_played", { video_id: videoId });
        }}
        className="group relative block aspect-video w-full overflow-hidden rounded-[1.5rem] bg-[#19212B] bg-cover bg-center text-white shadow-2xl shadow-violet-100"
        style={{ backgroundImage: `linear-gradient(rgba(15,23,42,.18), rgba(15,23,42,.62)), url("${thumbnail}")` }}
        aria-label={playLabel}
      >
        <span className="absolute inset-0 bg-violet-900/10 transition-colors group-hover:bg-violet-900/20" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-violet-700 shadow-xl transition-transform group-hover:scale-105">
            <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
          </span>
        </span>
        <span className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-left text-xs font-medium text-white/90">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {privacyNote}
        </span>
      </button>
    </div>
  );
}
