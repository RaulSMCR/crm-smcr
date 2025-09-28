// src/app/layout.js
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'SMCR',
  description: 'Salud mental, coaching y recursos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[rgb(var(--app-bg))] text-neutral-900 antialiased">
        <Header />
        <main className="container py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
