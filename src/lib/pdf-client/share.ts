"use client";

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type ShareResult = "opened" | "cancelled" | "downloaded";

/**
 * Web Share API with a real file where the platform supports it (checked with navigator.canShare).
 * Otherwise the PDF is downloaded so it can be sent manually via WhatsApp / Telegram / e-mail.
 * "opened" only means the system share sheet was shown — the app can never know whether it was sent.
 */
export async function sharePdf(blob: Blob, fileName: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "opened";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
