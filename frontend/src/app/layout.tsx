import type { Metadata, Viewport } from 'next';
import '@fontsource/jua/400.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '말랑말랑 · 내 말소리를 눈으로',
  description: '들리지 않아도, 내 말소리를 눈으로 봐요. 자음·모음 발음 연습',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '말랑말랑', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F5F3FC' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
