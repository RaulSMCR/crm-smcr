// src/app/verificar-email/page.js
import Link from "next/link";
import { verifyEmail } from "@/actions/auth-actions";
import ReenviarVerificacion from "./ReenviarVerificacion";

export const metadata = {
  title: "Verificar correo",
  // Se llega por enlace con token, nunca por búsqueda.
  robots: { index: false, follow: false },
};

export default async function VerificarEmailPage({ searchParams }) {
  // `await` obligatorio: en Next 16 `searchParams` es una Promise, y leerla en
  // forma síncrona devuelve `undefined` sin avisar. Sin este await, `token` era
  // siempre undefined y ESTA PÁGINA RECHAZABA TODOS LOS ENLACES, incluidos los
  // válidos: nadie podía verificar su correo.
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full border border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Te falta el enlace del correo</h1>
          <p className="mt-2 text-gray-600">
            Esta página confirma tu cuenta usando un enlace que te enviamos por correo. Si no te
            llegó o ya venció, pedí uno nuevo acá.
          </p>

          {/* Antes esto era un callejón sin salida: decía "utilice el enlace
              enviado por correo" y ofrecía solo "Volver al inicio". La única
              persona que llega sin token es justamente la que no recibió ese
              correo. */}
          <ReenviarVerificacion />

          <div className="mt-6 border-t border-gray-100 pt-4 text-sm">
            <Link href="/ingresar" className="text-blue-600 font-medium hover:underline">
              Ya verifiqué mi cuenta, quiero ingresar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const result = await verifyEmail(token);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-gray-100">
        {result.success ? (
          <>
            <div className="text-green-500 text-6xl mb-4">OK</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tu correo quedó confirmado. Comenzá tu camino.</h1>
            <p className="text-gray-600 mb-6">
              Gracias por confirmar su correo <strong>{result.email}</strong>.
              {result.role === "PROFESSIONAL"
                ? " Su postulación está en revisión. El coordinador del sitio le estará contactando para agendar una entrevista."
                : " Ya puede acceder a su cuenta y continuar con su proceso."}
            </p>
            <Link
              href="/ingresar"
              className="btn btn-accent block w-full py-3 text-center"
            >
              Ingresar
            </Link>
          </>
        ) : (
          <>
            <div className="text-red-500 text-6xl mb-4">X</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No fue posible completar la verificación</h1>
            <p className="text-gray-600 mb-6">
              {result.error ||
                "El enlace expiró o ya fue utilizado. Puede solicitar uno nuevo para continuar con seguridad."}
            </p>
            <Link href="/ingresar" className="text-blue-600 font-medium hover:underline">
              Reintentar
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
