import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";

const disp = Fraunces({
  subsets: ["latin"],
  variable: "--font-disp",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const body = Karla({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "MunshiCloud — Shop ERP & Store",
  description: "Genuine mobile parts, honest prices. Shop ERP, invoicing & online store.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${disp.variable} ${body.variable}`}>
      <body>
        {children}
        <div id="printArea" style={{ display: "none" }} />
      </body>
    </html>
  );
}