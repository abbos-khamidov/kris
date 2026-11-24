import type { SpeechProvider } from "./types";
import { webSpeechProvider } from "./web-speech";

/** Providers in order of preference. A local Whisper provider would be registered here. */
const providers: SpeechProvider[] = [webSpeechProvider];

export function registerSpeechProvider(p: SpeechProvider) {
  providers.unshift(p);
}

export function getSpeechProvider(): SpeechProvider | null {
  return providers.find((p) => p.isSupported()) ?? null;
}

const CONSENT_KEY = "kris.voice.consent.v1";

/** UI preference only (not medical data). */
export function hasVoiceConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}
export function setVoiceConsent(v: boolean) {
  try {
    if (v) localStorage.setItem(CONSENT_KEY, "1");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* private mode: ask again next time */
  }
}
