import { redirect } from "next/navigation";
import { guardarCredencialesGoogle } from "@/actions/google-connect-actions";

export default async function GoogleCallbackPage({ searchParams }) {
  const code = searchParams?.code;
  const error = searchParams?.error;

  if (error || !code) {
    redirect("/panel/profesional/integraciones?error=google_denied");
  }

  const result = await guardarCredencialesGoogle(code);

  if (result?.error) {
    redirect(`/panel/profesional/integraciones?error=${encodeURIComponent(result.error)}`);
  }

  redirect("/panel/profesional/integraciones?success=google_connected");
}
