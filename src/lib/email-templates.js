/**
 * Email para el PROFESIONAL cuando recibe una solicitud
 */
export const emailNuevaSolicitud = (nombreProfesional, nombrePaciente, fecha, hora, linkPanel) => {
  return `
    <div style="font-family: sans-serif; color: #333;">
      <h1>Hola, ${nombreProfesional} 👋</h1>
      <p>Tienes una nueva solicitud de cita pendiente de aprobación.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Paciente:</strong> ${nombrePaciente}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Hora:</strong> ${hora}</p>
      </div>

      <a href="${linkPanel}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Gestionar Solicitud
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
      <h1 style="color: #16a34a;">¡Cita Confirmada! ✅</h1>
      <p>Hola ${nombrePaciente}, tu cita ha sido aceptada por el profesional.</p>
      
      <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Profesional:</strong> ${nombreProfesional}</p>
        <p><strong>Cuándo:</strong> ${fecha} a las ${hora}</p>
        <p><strong>Dónde:</strong> ${direccion}</p>
      </div>

      <p>Si necesitas cancelar, por favor hazlo desde tu panel con al menos 24hs de antelación.</p>
    </div>
  `;
};