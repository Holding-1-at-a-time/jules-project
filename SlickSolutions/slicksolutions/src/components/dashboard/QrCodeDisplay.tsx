'use client';

import Image from 'next/image';

interface QrCodeDisplayProps {
  qrCodeUrl: string | null | undefined;
}

export default function QrCodeDisplay({ qrCodeUrl }: QrCodeDisplayProps) {
  if (!qrCodeUrl) {
    return (
      <div>
        <p>No QR code generated yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium">Your QR Code</h3>
      <p className="text-sm text-gray-500">
        Clients can scan this code to start their self-assessment.
      </p>
      <div className="mt-4">
        <Image src={qrCodeUrl} alt="QR Code" width={200} height={200} />
      </div>
    </div>
  );
}
