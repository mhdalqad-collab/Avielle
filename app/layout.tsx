import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Avielle — A wardrobe without limits",
  description:
    "Rent extraordinary fashion for everyday moments. An interactive marketplace and rental lifecycle simulator.",
  icons: { icon: "/favicon-a.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
