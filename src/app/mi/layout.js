// src/app/mi/layout.js
// Shell "tipo app" de la PWA de pacientes (/mi/*).
// - Guard de sesión: solo pacientes (rol USER).
// - Sin el header/footer públicos del sitio (ver nota del <style> abajo).
// - Contenedor max-w-md, fondo --app-bg, nav inferior fija.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MiBottomNav from "@/components/mi/MiBottomNav";
import ServiceWorkerRegister from "@/components/mi/ServiceWorkerRegister";
import InstallPrompt from "@/components/mi/InstallPrompt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Mi espacio", template: "%s · SMCR" },
  applicationName: "SMCR — Mi espacio",
  // El manifest se enlaza SOLO para /mi/* (no toca el layout raíz).
  manifest: "/mi/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SMCR" },
  formatDetection: { telephone: false },
};

export const viewport = {
  // Teal de marca (--brand-600 = rgb(43 112 115)).
  themeColor: "#2B7073",
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover para respetar el safe-area en modo standalone (iOS).
  viewportFit: "cover",
};

export default async function MiLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi");
  if (session.role !== "USER") redirect("/panel");

  return (
    <>
      {/*
        El layout raíz (intocable) renderiza <Header/> y <Footer/> para TODAS las
        páginas. Como no podemos removerlos desde un layout anidado ni crear un
        segundo root layout, los ocultamos por CSS. El <style> se renderiza en el
        servidor (sin flash) y solo está en el DOM mientras se navega dentro de
        /mi; al salir, el layout se desmonta y el chrome del sitio reaparece.
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: "body > header,body > footer{display:none!important}",
        }}
      />
      <ServiceWorkerRegister />

      <div className="min-h-[100dvh] bg-[rgb(var(--app-bg))] text-neutral-900">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
          <main className="flex-1 px-4 pb-24 pt-5">
          <InstallPrompt />
          {children}
        </main>
        </div>
        <MiBottomNav />
      </div>
    </>
  );
}
