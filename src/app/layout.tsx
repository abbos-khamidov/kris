import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Hydrated } from "@/components/hydrated";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ANTI_FLASH } from "@/lib/theme";
import "./globals.css";

const manrope = localFont({
  variable: "--font-manrope",
  display: "swap",
  src: [
    { path: "../../public/fonts/Manrope_400Regular.ttf", weight: "400" },
    { path: "../../public/fonts/Manrope_500Medium.ttf", weight: "500" },
    { path: "../../public/fonts/Manrope_600SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/Manrope_700Bold.ttf", weight: "700" },
  ],
});

const prata = localFont({
  variable: "--font-prata",
  display: "swap",
  src: [{ path: "../../public/fonts/Prata_400Regular.ttf", weight: "400" }],
});

export const metadata: Metadata = {
  title: { default: "KRIS SKIN", template: "%s · KRIS SKIN" },
  description: "Рабочее пространство косметолога: карты пациентов, рекомендации, PDF.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  applicationName: "KRIS SKIN",
  appleWebApp: { capable: true, title: "KRIS SKIN", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#791F2B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${manrope.variable} ${prata.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" richColors />
        <Hydrated />
        <PwaRegister />
      </body>
    </html>
  );
}
