// src/lib/contratos/contrato-profesional.js
//
// El machote del Contrato de Prestación de Servicios Profesionales, con los
// datos del profesional ya sustituidos.
//
// **La fuente legal sigue siendo el .docx** (`docs/contratos/
// CONTRATO-SERVICIOS-PROFESIONALES-SaludMentalCR.docx`). Lo de acá es una
// transcripción fiel de ese archivo, hecha para poder llenarla con los datos de
// quien se registra. Si el .docx se modifica —y `docs/contratos/
// CLAUSULAS-A-INCORPORAR-CONTRATO.md` dice que hay que modificarlo— esta
// transcripción hay que actualizarla con él.
//
// Se transcribe **tal cual está**, defectos incluidos: la numeración repetida
// (dos 5.2, dos 5.3, dos 5.4), la 2.2 sin 2.1 y el encabezado que llama
// "Proveedor" a quien el articulado llama "Profesional". Corregirlos por script
// sería reescribir un documento legal sin revisión humana, que es justamente lo
// que ya se decidió no hacer. Van señalados en `defectosConocidos` para que la
// pantalla los muestre antes de imprimir.
//
// Lo que el CRM no tiene, no lo inventa: cada dato ausente sale como una línea
// en blanco y queda listado en `pendientes`. Un contrato con un domicilio
// adivinado es peor que uno con un espacio por llenar.

import { disciplinaPorNombre } from "@/lib/disciplinas";
import { nombreConGrado } from "@/lib/grados-academicos";
import { cifraEnLetrasYNumero, numeroEnLetras } from "@/lib/contratos/numero-en-letras";
import { formatearIban } from "@/lib/iban";
import { COMMISSION_PLAN_VERSION } from "@/lib/commission-plan";

export const VERSION_MACHOTE = "contrato-servicios-profesionales-2026-08";

export const FUENTE_MACHOTE =
  "docs/contratos/CONTRATO-SERVICIOS-PROFESIONALES-SaludMentalCR.docx";

/** Lo que se imprime donde falta un dato. */
export const LINEA_EN_BLANCO = "________________________";

/**
 * Defectos de forma del machote, tomados de CLAUSULAS-A-INCORPORAR-CONTRATO.md.
 * No se corrigen acá: se muestran para que nadie firme sin saber que están.
 */
export const DEFECTOS_CONOCIDOS = Object.freeze([
  "La numeración de la cláusula QUINTA está repetida: hay dos 5.2, dos 5.3 y dos 5.4.",
  "Existe una cláusula 2.2 sin 2.1.",
  "El encabezado llama «Proveedor» a quien el articulado llama «Profesional».",
  "Faltan las cláusulas de secreto profesional y expediente clínico, y la de política de agendamiento y cancelación, que el Anexo económico y los Términos y Condiciones sí tienen (ver docs/contratos/CLAUSULAS-A-INCORPORAR-CONTRATO.md).",
]);

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Las cuatro casillas del Anexo A son áreas amplias y el catálogo de
 * disciplinas es más fino que ellas. Solo se marcan las correspondencias que no
 * admiten discusión; lo demás se deja sin marcar y se avisa, porque encasillar
 * una musicoterapeuta en «Medicina» sería una afirmación del sistema, no suya.
 */
const CASILLAS_ANEXO = Object.freeze([
  { etiqueta: "Medicina", disciplinas: ["psiquiatria"] },
  { etiqueta: "Psicología", disciplinas: ["psicologia-clinica"] },
  { etiqueta: "Nutrición", disciplinas: ["nutricion"] },
  { etiqueta: "Deporte", disciplinas: ["ciencias-del-deporte"] },
]);

function limpio(valor) {
  return String(valor ?? "").trim();
}

/** El valor, o la línea en blanco; anota el faltante para que la pantalla lo diga. */
function oEnBlanco(valor, campo, pendientes) {
  const texto = limpio(valor);
  if (texto) return texto;
  if (campo) pendientes.push(campo);
  return LINEA_EN_BLANCO;
}

/** 3101885661 → "3-101-885661". Deja intacto lo que no tenga esa forma. */
export function formatearCedulaJuridica(valor) {
  const digitos = limpio(valor).replace(/\D/g, "");
  if (digitos.length !== 10) return limpio(valor);
  return `${digitos.slice(0, 1)}-${digitos.slice(1, 4)}-${digitos.slice(4)}`;
}

/** "treinta de agosto del dos mil veintiséis (2026)". */
export function fechaEnLetras(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return LINEA_EN_BLANCO;
  const dia = numeroEnLetras(d.getDate());
  const anio = d.getFullYear();
  return `${dia} de ${MESES[d.getMonth()]} del ${numeroEnLetras(anio)} (${anio})`;
}

function casillasDisciplina(especialidad) {
  const disciplina = disciplinaPorNombre(especialidad);
  const marcadas = CASILLAS_ANEXO.map((casilla) => ({
    ...casilla,
    marcada: Boolean(disciplina && casilla.disciplinas.includes(disciplina.id)),
  }));
  return {
    linea: marcadas.map((c) => `[${c.marcada ? "X" : " "}] ${c.etiqueta}`).join("   "),
    alguna: marcadas.some((c) => c.marcada),
  };
}

/**
 * Contrato listo para imprimir.
 *
 * @param {object} args
 * @param {object} args.profesional  nombre, grado, identificacion, email, especialidad, domicilio
 * @param {object} args.empresa      nombre, cedulaJuridica, correo, representante{...}
 * @param {object} [args.firma]      fecha (Date) y lugar
 * @returns {{version:string, fuente:string, titulo:string, bloques:Array, pendientes:string[], defectosConocidos:string[]}}
 */
export function construirContratoProfesional({ profesional = {}, empresa = {}, firma = {} } = {}) {
  const pendientes = [];

  const proNombre = oEnBlanco(
    nombreConGrado(profesional.nombre, profesional.grado),
    "El nombre del profesional.",
    pendientes
  );
  const proCedula = oEnBlanco(
    profesional.identificacion,
    "La cédula del profesional. Se le pide en el registro; si está vacía, pídasela antes de firmar.",
    pendientes
  );
  const proDomicilio = oEnBlanco(
    profesional.domicilio,
    "El domicilio del profesional. Se le pide en su perfil; si está vacío, pídaselo antes de firmar.",
    pendientes
  );
  const proCorreo = oEnBlanco(profesional.email, "El correo del profesional.", pendientes);
  const proIban = oEnBlanco(
    profesional.iban ? formatearIban(profesional.iban) : "",
    "La cuenta IBAN del profesional, a la que se le transfieren los honorarios (cláusula 4.3). Se le pide en su perfil.",
    pendientes
  );

  const empresaNombre = oEnBlanco(
    empresa.nombre,
    "La razón social de la empresa (FE_EMISOR_NOMBRE).",
    pendientes
  );
  const empresaCedula = oEnBlanco(
    formatearCedulaJuridica(empresa.cedulaJuridica),
    "La cédula jurídica de la empresa (FE_EMISOR_IDENTIFICACION).",
    pendientes
  );
  const empresaCorreo = oEnBlanco(
    empresa.correo,
    "El correo de notificaciones de la empresa (FE_EMISOR_CORREO).",
    pendientes
  );
  const repNombre = oEnBlanco(
    empresa.representante?.nombre,
    "El nombre del representante legal (EMPRESA_REPRESENTANTE_NOMBRE).",
    pendientes
  );
  const repCedula = oEnBlanco(
    empresa.representante?.identificacion,
    "La cédula del representante legal (EMPRESA_REPRESENTANTE_CEDULA).",
    pendientes
  );
  const repCondicion = oEnBlanco(
    empresa.representante?.condicion,
    "La condición con la que firma el representante legal (EMPRESA_REPRESENTANTE_CONDICION).",
    pendientes
  );

  const fechaFirma = firma.fecha ? fechaEnLetras(firma.fecha) : LINEA_EN_BLANCO;
  const lugarFirma = limpio(firma.lugar) || "San José";

  const casillas = casillasDisciplina(profesional.especialidad);
  if (!casillas.alguna) {
    pendientes.push(
      `La casilla de disciplina del Anexo A: «${limpio(profesional.especialidad) || "sin especialidad"}» no corresponde a ninguna de las cuatro áreas preimpresas. Márquela a mano o amplíe el Anexo.`
    );
  }

  // El plazo de pago de la cláusula 4.3 tiene que ser el mismo de la cláusula
  // 8.2 del Anexo económico, y esa todavía dice "[__ días hábiles]". Mientras la
  // decisión no exista, acá va en blanco: dos plazos distintos en dos documentos
  // dejan que cada parte invoque el que le convenga.
  pendientes.push(
    "El plazo de pago de la cláusula 4.3. Debe ser el mismo de la cláusula 8.2 del Anexo económico, que sigue sin definirse."
  );
  pendientes.push("La fecha de finalización del Plazo de Vigencia (Anexo A, punto 3).");

  const bloques = [
    { tipo: "titulo", texto: "CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES" },

    {
      tipo: "parrafo",
      texto:
        `Entre nosotros, por una parte (i) ${empresaNombre}, una compañía incorporada bajo las ` +
        `leyes de la República de Costa Rica, con cédula de persona jurídica número ${empresaCedula}, ` +
        `representada en este acto por el señor ${repNombre}, mayor de edad, portador de la cédula ` +
        `de identidad número ${repCedula}, en su condición de ${repCondicion} con facultades ` +
        `suficientes para este acto, en adelante referido como “SaludMentalCR”, y por otra parte ` +
        `(ii) la persona física o jurídica que se identifica en el Anexo A, quien en lo sucesivo se ` +
        `denominará el “Proveedor”, y en adelante ambas denominadas colectivamente como las ` +
        `“Partes” e individualmente como la “Parte”, hemos acordado celebrar el presente CONTRATO ` +
        `DE PRESTACIÓN DE SERVICIOS PROFESIONALES (en adelante el “Contrato”), según se indica a ` +
        `continuación:`,
    },

    { tipo: "seccion", texto: "CONSIDERANDOS" },
    {
      tipo: "parrafo",
      texto:
        "POR CUANTO, SaludMentalCR es propietaria de una plataforma electrónica que permite a los " +
        "usuarios (en adelante los “Usuarios”) contratar de forma electrónica servicios de " +
        "psicología y/o afines (los “Servicios”), brindados por profesionales en psicología y/o " +
        "afines (el/los “Profesional”/“Profesionales”).",
    },
    {
      tipo: "parrafo",
      texto:
        "POR CUANTO, el Profesional es una persona física o jurídica independiente debidamente " +
        "capacitada y habilitada para brindar servicios de psicología y/o afines.",
    },
    {
      tipo: "parrafo",
      texto:
        "POR CUANTO, SaludMentalCR desea contratar los servicios del Profesional y éste desea " +
        "brindar sus servicios a SaludMentalCR bajo las especificaciones y condiciones que se " +
        "establecen en el presente Contrato.",
    },
    {
      tipo: "parrafo",
      texto:
        "POR LO TANTO, de conformidad con las premisas y pactos recíprocos aquí establecidos, las " +
        "Partes hemos convenido en celebrar el presente Contrato, el cual se regirá por las " +
        "siguientes cláusulas y estipulaciones específicas:",
    },

    { tipo: "seccion", texto: "CLÁUSULAS" },

    { tipo: "clausula", texto: "PRIMERA: DEL OBJETO." },
    {
      tipo: "parrafo",
      texto:
        "El objeto del presente Contrato es la prestación de servicios profesionales por parte del " +
        "Profesional a favor de SaludMentalCR. La descripción de los servicios se encuentra en el " +
        "Anexo A del presente Contrato, en adelante los “Servicios”.",
    },

    { tipo: "clausula", texto: "SEGUNDA: VIGENCIA DEL CONTRATO." },
    {
      tipo: "parrafo",
      texto:
        "2.2. El plazo de vigencia del presente Contrato se encuentra definido en el Anexo A (en " +
        "adelante el “Plazo”).",
    },

    { tipo: "clausula", texto: "TERCERA: OBLIGACIONES DEL PROFESIONAL." },
    {
      tipo: "parrafo",
      texto:
        "Además de las obligaciones específicas indicadas en el Anexo A del presente Contrato, el " +
        "Profesional tendrá las siguientes obligaciones:",
    },
    {
      tipo: "parrafo",
      texto:
        "3.1. El Profesional garantiza que se encuentra calificado y tiene la experiencia en " +
        "realizar servicios similares a los aquí ofrecidos y cuenta con todas las licencias y/o " +
        "permisos necesarios para realizar en Costa Rica los servicios contemplados en este Contrato.",
    },
    {
      tipo: "parrafo",
      texto:
        "3.2. El Profesional garantiza que conoce y se compromete a respetar todas las leyes, " +
        "códigos, normas, reglas, regulaciones, restricciones y requerimientos de todas las " +
        "autoridades gubernamentales y entidades que tengan jurisdicción sobre los Servicios. " +
        "Asimismo, el Profesional garantiza que cuenta con las respetivas Pólizas requeridas para " +
        "llevar a cabo los Servicios aquí contratados.",
    },

    { tipo: "clausula", texto: "CUARTA: PRECIO Y PAGO." },
    {
      tipo: "parrafo",
      texto:
        "4.1. SaludMentalCR cancelará al Profesional por los Servicios prestados la suma indicada " +
        "en el Anexo A.",
    },
    {
      tipo: "parrafo",
      texto:
        "4.2. El Profesional se tendrá por satisfecho completamente en cuanto a los Servicios " +
        "contra el pago del monto indicado en la cláusula 4.1., y en caso de cualquier gasto, " +
        "costo, impuesto, carga o tasa existente en esta fecha o que llegare a existir y que " +
        "pudiera ser aplicable a los Servicios, será por cuenta única y exclusiva del Profesional y " +
        "no representará un aumento en el precio establecido.",
    },
    {
      tipo: "parrafo",
      texto:
        "4.3. El Profesional deberá enviar de previo al pago la factura que cumpla con los " +
        "requerimientos de la Dirección General de Tributación Directa a SaludMentalCR, quien " +
        `pagará al Profesional dentro de los siguientes ${LINEA_EN_BLANCO} días después de recibida ` +
        "la factura por parte de SaludMentalCR. Dichos pagos se realizarán mediante transferencia " +
        "electrónica a la cuenta indicada en el Anexo A.",
    },

    { tipo: "clausula", texto: "QUINTA: MISCELÁNEOS." },
    {
      tipo: "parrafo",
      texto:
        "5.1. Terminación: SaludMentalCR podrá dar por terminado el presente Contrato " +
        `unilateralmente y sin razón causa justa dando un aviso previo de ${cifraEnLetrasYNumero(30)} ` +
        "días al Profesional. En este caso, SaludMentalCR pagará al Profesional todos los Servicios " +
        "realizados y recibidos de forma satisfactoria hasta la fecha de terminación efectiva del " +
        "Contrato. SaludMentalCR no tendrá ninguna otra responsabilidad con el Profesional por " +
        "dicha terminación, incluyendo otras compensaciones, gastos, honorarios y no deberá pagar " +
        "ningún monto por ganancias o beneficios esperados o trabajos no realizados.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.2. Terminación por incumplimiento: SaludMentalCR podrá dar por terminado el Contrato, " +
        "sin responsabilidad de su parte y sin necesidad de un aviso previo, ante la ocurrencia de " +
        "cualquiera de los siguientes eventos:",
    },
    {
      tipo: "lista",
      items: [
        "a) Si el Profesional incumple con la óptima realización y prestación de los Servicios a los que se encuentra obligado realizar de conformidad con (a) los términos, condiciones o convenios de este Contrato.",
        "b) Si el Profesional demuestra insatisfactorios estándares de calidad en los Servicios prestados.",
      ],
    },
    {
      tipo: "parrafo",
      texto:
        "En caso de terminación del Contrato por cualquiera de los supuestos anteriormente " +
        "indicados, el Profesional será responsable de indemnizar a SaludMentalCR por los daños y " +
        "perjuicios que surjan a consecuencia de dicho incumplimiento.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.3. Suspensión de los Servicios. SaludMentalCR tendrá el derecho de suspender todo o " +
        "parte de los Servicios en cualquier momento. En este caso, SaludMentalCR deberá pagar al " +
        "Profesional únicamente la porción de los Servicios que hayan sido realizados y recibidos " +
        "satisfactoriamente de previo a la fecha en que SaludMentalCR le comunique la suspensión de " +
        "los Servicios. SaludMentalCR no tendrá ninguna otra responsabilidad con el Profesional por " +
        "dicha suspensión, incluyendo otras compensaciones, gastos, honorarios y no deberá pagar " +
        "ningún monto por ganancias o beneficios esperados o trabajos no realizados.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.2. Protección de Datos Personales de los Usuarios: El Profesional acepta y reconoce que " +
        "en la ejecución del presente Contrato podría tener acceso a algunos datos personales de " +
        "los Usuarios, los cuales serán utilizados únicamente para fines internos y domésticos para " +
        "la ejecución del presente Contrato, no serán transferidos, tratados ni compartidos con " +
        "terceros, su tratamiento se dará de conformidad con la Ley de Protección de la Persona " +
        "frente al Tratamiento de sus Datos Personales, Ley Nº 8968, su reglamento y demás normas " +
        "que regulen la protección de datos personales en Costa Rica.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.3. Relación mercantil: El presente Contrato es de naturaleza estricta y esencialmente " +
        "mercantil y consecuentemente no existe ni existirá en el futuro, relación laboral alguna " +
        "entre SaludMentalCR y Profesional, ni entre aquella y los empleados de éste, por lo que " +
        "ninguno de los dos en ningún caso y en ninguna circunstancia asumirá responsabilidad de " +
        "patrón sustituto, por lo que el Profesional asume total responsabilidad en todo lo " +
        "relacionado al pago de las cuotas obrero patronales, seguros de enfermedad, invalidez, " +
        "vejez y muerte, riesgos profesionales, y cualquier otra prestación de índole laboral " +
        "eximiendo de toda responsabilidad a SaludMentalCR por dichos pagos.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.4. Confidencialidad. El Profesional se obliga a no revelar y a mantener en la más " +
        "estricta confidencialidad los términos del presente Contrato, en forma personal o por " +
        "cualquier medio respecto de la información a la que tenga acceso, referidas a los " +
        "Servicios para los que se ha contratado, así como la información referente a clientes, " +
        "organización, y en general a cualquier información técnica, estratégica, o comercial que " +
        "no sea de conocimiento general y que llegue a tener acceso con ocasión de este Contrato. " +
        "El Profesional debe adoptar todas las medidas razonables y proporcionales para mantener la " +
        "información confidencial protegida. Este mismo compromiso de confidencialidad deberá ser " +
        "observado por sus respectivos representantes, consultores, empleados, asesores legales u " +
        "otros profesionales consultados. Esta obligación se mantendrá durante la vigencia de toda " +
        `este Contrato y por el plazo de ${cifraEnLetrasYNumero(5)} años contados a partir de la ` +
        "terminación del Contrato, y deberán procurar las acciones necesarias para que se extienda " +
        "a sus representantes, directores, empleados, consultores y asesores. La totalidad de la " +
        "información proporcionada con motivo de este Contrato se considerará información " +
        "confidencial, sujeto a las consecuencias establecidas en la Ley de Información No " +
        "Divulgada, Nº 7975 de 22 de diciembre de 1999, Publicada en La Gaceta No. 12 de 18 de " +
        "enero de 2000.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.4. Acuerdo Total y Modificaciones. Cualquier acuerdo de modificación, cambio o reforma " +
        "al presente Contrato, será válido en el tanto el mismo sea documentado por escrito y " +
        "suscrito por ambas Partes.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.5. Legislación Aplicable. Este Contrato será interpretado, ejecutado y resuelto de " +
        "conformidad con la legislación vigente y aplicable de la República de Costa Rica.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.6. Responsabilidad. En la máxima medida permitida por la ley, el Profesional deberá " +
        "defender, indemnizar y mantener indemne a SaludMentalCR ante cualquier y todos los " +
        "reclamos, acciones, daños, responsabilidad, pérdidas, costos y gastos, incluyendo " +
        "honorarios de abogados, que surjan de cualquier acto realizado con dolo o culpa por el " +
        "Profesional, sea por negligencia, impericia o imprudencia negligentes, tanto del " +
        "Profesional como de sus respectivos empleados, ayudante, consejeros y agentes, u otros de " +
        "los que el Profesional es responsable.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.7. Cesión. Es entendido y aceptado por el Profesional que no podrá ceder a terceros los " +
        "derechos y obligaciones derivados del presente Contrato, por lo que en todo momento el " +
        "Profesional será el único responsable del cumplimiento de sus obligaciones del Convenio.",
    },
    {
      tipo: "parrafo",
      texto:
        "5.8. Notificaciones. Cualquier comunicación relativa al Convenio deberá hacerse por " +
        "escrito y dirigirse a las direcciones que se indican en el Anexo A.",
    },
    {
      tipo: "parrafo",
      texto:
        "En fe de lo anterior, firmamos en dos originales, en la fecha y lugar indicados en el Anexo A.",
    },

    { tipo: "firma", izquierda: "P/ SALUDMENTALCR", derecha: "P/ PROFESIONAL" },

    { tipo: "seccion", texto: "ANEXO A" },

    {
      tipo: "anexoFila",
      encabezado: "De las Partes:",
      lineas: [
        "Las Partes contratantes del presente Acuerdo se identifican e individualizan de la siguiente manera:",
        `SaludMentalCR: ${empresaNombre}, cédula jurídica ${empresaCedula}, representada en este acto por el señor ${repNombre}, mayor de edad, portador de la cédula de identidad número ${repCedula}, con facultades suficientes para este acto.`,
        `El Profesional: ${proNombre}, portador de la cédula de identidad ${proCedula}, domiciliado en ${proDomicilio}.`,
      ],
    },
    {
      tipo: "anexoFila",
      encabezado: "Descripción de los Servicios:\nObligaciones específicas del Profesional:\nPrecio:",
      lineas: [
        casillas.linea,
        limpio(profesional.especialidad)
          ? `Disciplina declarada por el Profesional: ${limpio(profesional.especialidad)}.`
          : LINEA_EN_BLANCO,
        LINEA_EN_BLANCO,
        `Precio: Según el Anexo — Esquema económico, liquidación y pago de honorarios profesionales, versión ${COMMISSION_PLAN_VERSION}, que forma parte integral de este Contrato y prevalece en todo lo relativo a comisión, costo de procesamiento, liquidación y monto facturable.`,
      ],
    },
    {
      tipo: "anexoFila",
      encabezado: "3. Plazo de Vigencia del CONTRATO:",
      lineas: [
        `Fecha de inicio: ${fechaFirma}`,
        `Fecha de finalización: ${LINEA_EN_BLANCO}`,
      ],
    },
    {
      tipo: "anexoFila",
      encabezado: "4. Medios para Notificaciones:",
      lineas: [
        `SaludMentalCR: Correo electrónico ${empresaCorreo}`,
        `El Profesional: Correo electrónico ${proCorreo}`,
      ],
    },
    {
      tipo: "anexoFila",
      encabezado: "5. Fecha y lugar de firma del Convenio:",
      lineas: [`Fecha: ${fechaFirma}.`, `Lugar: ${lugarFirma}, Costa Rica.`],
    },
    {
      tipo: "anexoFila",
      encabezado: "6. Cuenta para el pago de honorarios:",
      lineas: [`Cuenta IBAN del Profesional: ${proIban}`],
    },
  ];

  return {
    version: VERSION_MACHOTE,
    fuente: FUENTE_MACHOTE,
    titulo: "CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES",
    bloques,
    pendientes,
    defectosConocidos: [...DEFECTOS_CONOCIDOS],
  };
}
