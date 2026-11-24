import type { SpeechErrorCode, SpeechProvider, SpeechSession } from "./types";

/* Minimal typings: lib.dom does not ship SpeechRecognition in every TypeScript version. */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const mapError = (e: string): SpeechErrorCode => {
  switch (e) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission-denied";
    case "audio-capture":
      return "no-microphone";
    case "network":
      return "network";
    case "no-speech":
      return "no-speech";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
};

export const webSpeechProvider: SpeechProvider = {
  id: "web-speech",
  label: "Браузерное распознавание (Web Speech API)",
  // Chromium/Safari implementations stream audio to the vendor's servers.
  sendsAudioToThirdParty: true,
  isSupported: () => ctor() !== null,
  start({ lang, onInterim, onFinal, onError, onEnd }): SpeechSession {
    const Ctor = ctor();
    if (!Ctor) {
      queueMicrotask(() => {
        onError("not-supported");
        onEnd();
      });
      return { stop() {}, abort() {} };
    }
    let wantRunning = true;
    let fatal = false;
    let rec: Recognition;

    const launch = () => {
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) onFinal(r[0].transcript.trim());
          else interim += r[0].transcript;
        }
        onInterim(interim);
      };
      rec.onerror = (e) => {
        const code = mapError(e.error);
        // "no-speech" and "aborted" are routine while dictating; the engine restarts below.
        if (code === "no-speech" || code === "aborted") return;
        fatal = true;
        wantRunning = false;
        onError(code);
      };
      rec.onend = () => {
        // Engines stop by themselves after silence; keep the session alive until the user stops it.
        if (wantRunning && !fatal) {
          try {
            launch();
            return;
          } catch {
            /* fall through to end */
          }
        }
        onInterim("");
        onEnd();
      };
      rec.start();
    };

    try {
      launch();
    } catch {
      queueMicrotask(() => {
        onError("unknown");
        onEnd();
      });
    }
    return {
      stop() {
        wantRunning = false;
        try {
          rec.stop();
        } catch {
          onEnd();
        }
      },
      abort() {
        wantRunning = false;
        try {
          rec.abort();
        } catch {
          onEnd();
        }
      },
    };
  },
};
