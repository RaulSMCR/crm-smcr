// src/app/registro/usuario/page.js
//
// El formulario es cliente y sigue siéndolo; esta capa existe para una sola
// cosa: cuando alguien llega acá desde una agenda, decirle con quién y cuándo
// iba a ser la cita que dejó a medio hacer, y qué falta para tenerla.

import { resolverIntencionDeAgenda } from "@/lib/intencion-de-agenda-servidor";
import RegistroUsuarioForm from "./RegistroUsuarioForm";

export default async function RegistroUsuarioPage({ searchParams }) {
  const resueltos = await searchParams;
  const next = typeof resueltos?.next === "string" ? resueltos.next : "";
  const intencion = await resolverIntencionDeAgenda(next);

  return <RegistroUsuarioForm intencion={intencion} />;
}
