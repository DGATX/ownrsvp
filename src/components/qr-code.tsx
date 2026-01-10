'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 200 }: QRCodeProps) {
  return (
    <div className="flex items-center justify-center p-4 bg-white rounded-lg border">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={true}
      />
    </div>
  );
}

