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
      {/* 1. flex flex-col: Permite organizar header-main-footer verticalmente.
         2. min-h-screen: Asegura que el cuerpo ocupe al menos toda la altura de la ventana.
      */}
      <body className="min-h-screen flex flex-col bg-slate-50 text-neutral-900 antialiased">
        
        <Header />
        
        {/* flex-grow: Empuja el footer hacia abajo si el contenido es corto.
           Quitamos 'container': Ahora cada página (page.js) decide sus márgenes.
        */}
        <main className="flex-grow">
          {children}
        </main>
        
        <Footer />
      </body>
    </html>
  );
}