import { permanentRedirect } from "next/navigation";

export default async function LegacyRaulThemePage({ params }) {
  const { tema } = await params;
  permanentRedirect(`/raul-olmedo-evans/${tema}`);
}
