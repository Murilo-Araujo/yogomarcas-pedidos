import type { Metadata, Viewport } from "next";
import { PwaProvider } from '@/components/pwa/provider';
import { linkFontVariables } from './link-fonts';
import "./globals.css";
import "./catalog-management.css";
import "./pwa.css";

export const metadata: Metadata = {
  title: "Yogomarcas | Portal de pedidos",
  description: "Escolha os produtos para sua operação e continue seu pedido com a Yogomarcas pelo WhatsApp.",
  robots: { index: false, follow: false },
  applicationName: 'Yogomarcas',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Yogomarcas', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6656b4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`antialiased ${linkFontVariables}`}><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
