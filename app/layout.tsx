import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yogomarcas | Portal de pedidos",
  description: "Escolha os produtos para sua operação e continue seu pedido com a Yogomarcas pelo WhatsApp.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
