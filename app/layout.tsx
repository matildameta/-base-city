import "./globals.css";
import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

const miniAppEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/og.png`,
  button: {
    title: "🏙️ Open Base City",
    action: {
      type: "launch_frame",
      name: "Base City",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: "#0b0f1a",
    },
  },
};

export const metadata: Metadata = {
  title: "Base City",
  description: "کل Base یک شهر زنده است. هر آدرس یک ساختمان.",
  openGraph: {
    title: "Base City",
    description: "کل Base یک شهر زنده است. هر آدرس یک ساختمان.",
    images: [`${APP_URL}/og.png`],
  },
  other: {
    "fc:frame": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
