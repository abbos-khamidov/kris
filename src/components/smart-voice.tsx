"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { voiceStatusAction } from "@/app/(app)/cards/voice-actions";

export interface SmartVoice {
  /** Dictate straight into the field and correct it in place (card sections 3–10 and extra pages). */
  enabled: boolean;
  /** Claude correction is configured on the server. */
  ai: boolean;
  /** Extra terms (product names on this card) whose spelling must be kept. */
  terms: string[];
}

const Ctx = createContext<SmartVoice>({ enabled: false, ai: false, terms: [] });
export const useSmartVoice = () => useContext(Ctx);

export function SmartVoiceProvider({ enabled, terms, children }: { enabled: boolean; terms: string[]; children: React.ReactNode }) {
  const [ai, setAi] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    voiceStatusAction()
      .then((r) => alive && r.ok && setAi(r.data.ai))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled]);
  return <Ctx.Provider value={{ enabled, ai, terms }}>{children}</Ctx.Provider>;
}
