import type { Metadata, Viewport } from 'next';
import { poppins, playfair, dbHeavent } from '@/lib/fonts';
import { ToastProvider } from '@/components/toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'GETGLOW Stock — ระบบจัดการคลังยาฉีด',
  description: 'ระบบจัดการสต๊อกยาฉีด (โบท็อกซ์และฟิลเลอร์) สำหรับ GETGLOW Clinic',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${poppins.variable} ${playfair.variable} ${dbHeavent.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
