// src/app/pro/layout.js
// Shell "tipo app" de la PWA de profesionales (/pro/*). Calcado de /mi:
// - Guard de sesión: solo profesionales con perfil (el middleware ya exige el
//   rol y la aprobación; acá se resuelve el perfil).
// - Sin el header/footer públicos del sitio.
// - Contenedor max-w-md, nav inferior fija.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProBottomNav from "@/components/pro/ProBottomNav";
import ServiceWorkerRegister from "@/components/mi/ServiceWorkerRegister";
import InstallPrompt from "@/components/mi/InstallPrompt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Consultorio", template: "%s · Consultorio" },
  robots: { index: false, follow: false },
  applicationName: "SMCR — Consultorio",
  manifest: "/pro/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Consultorio" },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#2B7073",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function ProLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro");
  if (session.role !== "PROFESSIONAL") redirect("/panel");
  if (!session.professionalProfileId) redirect("/panel/profesional/perfil");

  return (
    <>
      {/* Mismo recurso que /mi: el layout raíz pinta header y footer en todas
          las páginas y no se pueden quitar desde un layout anidado. */}
      <style
        dangerouslySetInnerHTML={{
          __html: "body > header,body > footer{display:none!important}",
        }}
      />
      <ServiceWorkerRegister src="/pro-sw.js" scope="/pro" />

      <div className="min-h-[100dvh] bg-[rgb(var(--app-bg))] text-neutral-900">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
          <main className="flex-1 px-4 pb-24 pt-5">
            <InstallPrompt variant="pro" />
            {children}
          </main>
        </div>
        <ProBottomNav />
      </div>
    </>
  );
}
