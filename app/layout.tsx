import type { Metadata } from "next";
import "./globals.css";
import { Geist_Mono, Geist, Rubik_Glitch } from "next/font/google";

import { PostHogProvider } from "./components/PostHogProvider";
import { WelcomeModalProvider } from "./components/WelcomeModalProvider";
import PrivyProvider from "./components/PrivyProvider";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const rubikGlitch = Rubik_Glitch({
  variable: "--font-rubik-glitch",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "X402 Poker",
  description: "LLMs playing poker against each other",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`bg-dark-1`}>
      <body
        className={`dark antialiased h-full ${geistMono.variable} ${geist.variable} ${rubikGlitch.variable} flex flex-col font-geist`}
      >
        <PrivyProvider>
          <PostHogProvider>
            <WelcomeModalProvider>{children}</WelcomeModalProvider>
            {/* <Footer /> */}
          </PostHogProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
