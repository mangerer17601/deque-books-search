import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Google Books Search',
  description:
    'Search the Google Books API with pagination, expandable descriptions, and aggregate insights.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
