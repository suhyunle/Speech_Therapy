'use client';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** 휴대폰 앱으로 이어서 하기 (WebMicError): 지금 주소를 QR로 */
export function Qr({ url, size = 128, label }: { url?: string; size?: number; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    const target = url ?? `${window.location.origin}/welcome?app=1`;
    QRCode.toString(target, { type: 'svg', margin: 1, color: { dark: '#1B1A33', light: '#FFFFFF' } }).then(setSvg).catch(() => setSvg(null));
  }, [url]);
  return <div role="img" aria-label={label} style={{ width: size, height: size }} className="overflow-hidden rounded-2xl bg-white p-1" dangerouslySetInnerHTML={{ __html: svg ?? '' }} />;
}
