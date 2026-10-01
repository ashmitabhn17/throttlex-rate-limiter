import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThrottleX — API Protection Platform',
  description: 'API key management, route-level rate limits, and traffic analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
