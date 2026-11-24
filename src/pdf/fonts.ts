import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Registers the embedded fonts (Prata + Manrope, SIL OFL, full Cyrillic + ₽).
 * `base` is a URL prefix in the browser ("/fonts") or a directory path in Node.
 */
export function registerPdfFonts(base: string) {
  if (registered) return;
  registered = true;
  const f = (file: string) => `${base.replace(/\/$/, "")}/${file}`;
  Font.register({ family: "Prata", src: f("Prata_400Regular.ttf") });
  Font.register({
    family: "Manrope",
    fonts: [
      { src: f("Manrope_400Regular.ttf"), fontWeight: 400 },
      { src: f("Manrope_500Medium.ttf"), fontWeight: 500 },
      { src: f("Manrope_600SemiBold.ttf"), fontWeight: 600 },
      { src: f("Manrope_700Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Never insert hyphens: Russian words are wrapped at spaces only.
  Font.registerHyphenationCallback((word) => [word]);
}
