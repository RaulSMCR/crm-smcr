/**
 * Email para el PROFESIONAL cuando recibe una solicitud
 */
export const emailNuevaSolicitud = (nombreProfesional, nombrePaciente, fecha, hora, linkPanel) => {
  return `
    <div style="font-family: sans-serif; color: #333;">
      <h1>Estimado/a ${nombreProfesional}</h1>
      <p>Se registró una nueva solicitud de cita pendiente de aprobación.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Paciente:</strong> ${nombrePaciente}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Hora:</strong> ${hora}</p>
      </div>

      <a href="${linkPanel}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Gestionar solicitud
      </a>
    </div>
  `;
};

/**
 * Email para el PACIENTE cuando su cita es APROBADA
 */
export const emailCitaConfirmada = (nombrePaciente, nombreProfesional, fecha, hora, direccion = "Online / Consultorio") => {
  return `
    <div style="font-family: sans-serif; color: #333;">
      <h1 style="color: #16a34a;">Cita confirmada</h1>
      <p>Hola ${nombrePaciente}, el profesional confirmó tu cita.</p>
      
      <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Profesional:</strong> ${nombreProfesional}</p>
        <p><strong>Cuándo:</strong> ${fecha} a las ${hora}</p>
        <p><strong>Dónde:</strong> ${direccion}</p>
      </div>

      <p>Si necesitás cancelar, gestionálo desde tu panel con al menos 24 horas de anticipación.</p>
    </div>
  `;
};

