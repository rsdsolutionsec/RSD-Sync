import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RSD Sync — Control Plane',
  description: 'Panel interno de diagnóstico operativo e infraestructura de RSD Solutions',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-[#07070c] text-zinc-100 antialiased selection:bg-fuchsia-500/30 selection:text-fuchsia-100">
        {children}
      </body>
    </html>
  );
}
