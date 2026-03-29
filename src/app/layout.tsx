import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import { TelegramProvider } from "@/components/TelegramProvider";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ['400', '600', '700', '900']
});

export const metadata: Metadata = {
  title: "Cric-Pulse Strategy Hub",
  description: "Advanced Predictive Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
         <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className={`${interTight.variable} font-sans antialiased text-white bg-obsidian`}>
        <TelegramProvider>
           {children}
        </TelegramProvider>
      </body>
    </html>
  );
}
