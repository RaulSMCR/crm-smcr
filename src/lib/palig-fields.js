// Mapa verificado visualmente contra el PDF editable PALIG de Costa Rica:
// Costa_Rica_-_Formularios_-_Solicitud_de_Reclamo_-_2023.pdf (una página, 612 × 1008 pt).
// Los identificadores del proveedor son opacos: no se deducen por su orden.
export const PALIG_SOURCE_URL = "https://assets.ctfassets.net/em61esqt6ro0/5EClmVfvAcFljU8YIHPnZx/988e5b475a17b133c75c7d619c4932b1/Costa_Rica_-_Formularios_-_Solicitud_de_Reclamo_-_2023.pdf";

export const PALIG_FIELDS = Object.freeze({
  company: "Text1",
  policyNumber: "Text2",
  certificateNumber: "Text3",
  patientName: "Text4",
  birthDate: "Text5",
  symptomStartDate: "Text6",
  insuredPhone: "Text7",
  insuredEmail: "Text8",
  serviceDate: "Text9",
  reason: "Text10",
  diagnosis: "Text11",
  previousTreatment: "Text12",
  firstSymptoms: "Text13",
  studies: "Text14",
  treatment: "Text15",
  authorizationNumber: "Text16",
  professionalName: "Text17",
  specialty: "Text18",
  observations: "Text19",
  professionalLicense: "Text20",
  signatureDate: "Text21",
  professionalPhone: "Text22",
});

// Estos campos los completa el profesional en la plantilla. El sistema
// conserva su contenido; nunca inventa, deduce ni autocompleta diagnósticos.
export const PALIG_CLINICAL_FIELDS = Object.freeze([
  PALIG_FIELDS.reason, PALIG_FIELDS.diagnosis, PALIG_FIELDS.previousTreatment,
  PALIG_FIELDS.firstSymptoms, PALIG_FIELDS.studies, PALIG_FIELDS.treatment, PALIG_FIELDS.observations,
]);

// La fecha junto a la firma y las firmas quedan para quien firma el documento.
// Este formulario no tiene casilla de monto: el importe pertenece a la factura.
export const PALIG_AUTOMATIC_FIELDS = Object.freeze([
  PALIG_FIELDS.patientName, PALIG_FIELDS.serviceDate, PALIG_FIELDS.professionalName,
]);
