import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { DevClockPanel } from "@/components/dev-clock/dev-clock-panel";
import { th } from "@/messages/th";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: th.app.name,
  description: th.app.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
          {th.app.disclaimer}
        </footer>
        <DevClockPanel />
      </body>
    </html>
  );
}
