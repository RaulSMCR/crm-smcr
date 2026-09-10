import { redirect } from "next/navigation";
import { guardarCredencialesGoogle } from "@/actions/google-connect-actions";

export default async function GoogleCallbackPage({ searchParams }) {
  // En Next 16 `searchParams` es una Promise: leerla sin `await` devuelve
  // undefined y el callback siempre acababa en "google_denied", aunque Google
  // hubiera devuelto el code correctamente.
  const params = await searchParams;
  const code = params?.code;
  const error = params?.error;

  if (error || !code) {
    redirect("/panel/profesional/integraciones?error=google_denied");
  }

  const result = await guardarCredencialesGoogle(code);

  if (result?.error) {
    redirect(`/panel/profesional/integraciones?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/panel/profesional/integraciones?success=google_connected");
}
