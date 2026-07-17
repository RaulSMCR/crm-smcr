// src/lib/mi/frases.js
// Frase del día de la PWA de pacientes.
//
// ⚠️ REEMPLAZAR por frases definitivas con voz de marca. Estas son PLACEHOLDER:
// tono cálido y cuidado, español rioplatense neutro. El `autor` es opcional.
//
// La selección es determinista por día (misma frase para todo el mundo, sin
// fetch ni estado): ver getFraseDelDia().
import { DEFAULT_TZ } from "@/lib/timezone";

export const FRASES = [
  { texto: "Cuidar tu salud mental también es productividad." },
  { texto: "Pedir ayuda no es rendirse; es elegirte." },
  { texto: "Los días difíciles también son parte del camino." },
  { texto: "Tu ritmo es válido, aunque no se parezca al de nadie más." },
  { texto: "Un pequeño paso hoy vale más que un plan perfecto para mañana." },
  { texto: "Descansar no es un premio: es parte del trabajo de estar bien." },
  { texto: "Lo que sentís tiene sentido, aunque todavía no lo entiendas del todo." },
  { texto: "No tenés que poder con todo, ni todo el tiempo." },
  { texto: "Hablar de lo que duele es el primer gesto para aliviarlo." },
  { texto: "Tu bienestar se construye en lo cotidiano, no en lo perfecto." },
  { texto: "A veces el mayor acto de valentía es volver a intentarlo." },
  { texto: "Poner límites es una forma de cuidarte, no de alejar." },
  { texto: "Está bien no estar bien; no está bien quedarte solo con eso." },
  { texto: "Cada emoción trae información, aunque llegue incómoda." },
  { texto: "El progreso no siempre se ve; a veces solo se siente." },
  { texto: "Ser amable con vos mismo también se aprende." },
  { texto: "No estás atrasado en la vida; estás en tu propio tiempo." },
  { texto: "Respirar hondo es empezar de nuevo, cuantas veces haga falta." },
  { texto: "Tu historia no te define; lo que hacés con ella, sí." },
  { texto: "Acompañarte a vos mismo es una relación que dura toda la vida." },
  { texto: "Lo simple también sana: dormir, comer, moverse, conversar." },
  { texto: "No hace falta tener todas las respuestas para dar el próximo paso." },
  { texto: "El silencio compartido también es una forma de compañía." },
  { texto: "Soltar lo que no depende de vos es un alivio que se practica." },
  { texto: "Tus logros pequeños merecen ser nombrados." },
  { texto: "Ir a terapia es entrenar el músculo de conocerte." },
  { texto: "La calma también se cultiva, un día a la vez." },
  { texto: "Lo que hoy te pesa, mañana puede ser aprendizaje." },
  { texto: "Nadie sana en soledad total; buscar vínculos también es salud." },
  { texto: "Elegirte hoy es un buen lugar para empezar." },
];

/** Día del año (1..366) en la zona horaria de Costa Rica. */
function dayOfYearCR(now = new Date()) {
  // en-CA da "YYYY-MM-DD"; lo calculamos en DEFAULT_TZ para que el corte de día
  // sea el mismo para todos, independientemente del huso del servidor.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

/** Frase determinista del día: índice = día del año % total. */
export function getFraseDelDia(now = new Date()) {
  const index = dayOfYearCR(now) % FRASES.length;
  return FRASES[index];
}
