/**
 * SpeechProvider: one interface for every speech-to-text engine (ADR-009).
 * MVP ships the browser Web Speech API. A local Whisper provider can implement the same
 * interface later without touching any UI code. Audio is never stored by the app.
 */
export type SpeechErrorCode =
  | "not-supported"
  | "permission-denied"
  | "no-microphone"
  | "network"
  | "no-speech"
  | "aborted"
  | "unknown";

export interface SpeechCallbacks {
  /** Text still being recognised (replaced on every update). */
  onInterim(text: string): void;
  /** A finished phrase; append it to the transcript. */
  onFinal(text: string): void;
  onError(code: SpeechErrorCode): void;
  /** Recording really ended (manual stop, error or engine shutdown). */
  onEnd(): void;
}

export interface SpeechSession {
  /** Graceful stop: delivers pending final results, then onEnd. */
  stop(): void;
  /** Hard stop, results discarded. */
  abort(): void;
}

export interface SpeechProvider {
  id: string;
  label: string;
  /** True if audio leaves the device (the UI must obtain consent first). */
  sendsAudioToThirdParty: boolean;
  isSupported(): boolean;
  start(opts: { lang: string } & SpeechCallbacks): SpeechSession;
}

export const ERROR_MESSAGE: Record<SpeechErrorCode, string> = {
  "not-supported": "Голосовой ввод не поддерживается в этом браузере. Используйте ручной ввод.",
  "permission-denied": "Нет доступа к микрофону. Разрешите его в настройках браузера или вводите текст вручную.",
  "no-microphone": "Микрофон не найден.",
  network: "Нет связи со службой распознавания речи. Проверьте интернет или вводите текст вручную.",
  "no-speech": "Речь не распознана. Попробуйте ещё раз.",
  aborted: "Запись прервана.",
  unknown: "Не удалось распознать речь. Можно продолжить ввод вручную.",
};
