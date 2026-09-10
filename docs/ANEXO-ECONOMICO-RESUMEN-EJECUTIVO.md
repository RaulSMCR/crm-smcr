# Resumen ejecutivo
## Anexo económico, liquidación y pago de honorarios profesionales

Versión `patient-retention-2026-07` · Documento completo: 19 cláusulas, 15 páginas · Estado: pendiente de firma

**Qué regula.** Cuánto retiene la plataforma por cada cobro que un paciente paga, qué se le deduce al profesional, cuándo se liquida y en qué plazo se le paga. No crea relación laboral, jornada, exclusividad ni garantía de volumen.

### La escala de comisión

| 1.ª consulta | 2.ª | 3.ª | 4.ª | 5.ª a 8.ª | 9.ª a 28.ª | 29.ª en adelante |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **45%** | **35%** | **30%** | **25%** | **20%** | **15%** | **10%** |

Cada relación paciente–profesional tiene **su propia secuencia**, que no se reinicia al cambiar de servicio, de precio ni de quincena: la comisión baja conforme el paciente continúa, y el 10% no tiene fecha de término. La primera consulta se cobra en dos tractos —50% de adelanto y 50% de saldo, con comisión del 50% y del 40%—, lo que da el mismo 45% efectivo que el pago único.

### Cómo se calcula cada línea

```text
Base sin impuesto  = bruto cobrado / 1,04        Comisión = base × tasa de la secuencia
Neto profesional   = base − comisión − costo de pasarela        Factura = neto + su impuesto
```

La comisión se calcula siempre sobre la base sin impuesto, **nunca sobre el IVA cobrado al paciente**. El neto del profesional nunca baja de cero.

### Cuándo se devenga

- **Lo que genera comisión es el pago, no la prestación.** Todo cobro que el paciente pague por un enlace del profesional le genera a este su parte y avanza la secuencia.
- El **cargo por cancelación tardía o inasistencia** —50% del valor de la cita— se liquida como cualquier otro cobro, a la tasa de la posición que ocupaba esa consulta, y consume esa posición.
- Una cita que **nadie pagó no consume posición**. El adelanto y el saldo de una misma consulta comparten la suya.

### Qué se le deduce al profesional

- El **costo de la pasarela**, separado de la comisión, identificado por medio de pago y nunca rotulado como «comisión».
- Cuando la primera consulta se cobra en dos transacciones, el **segundo cargo fijo lo asume la plataforma**: fraccionar el cobro es decisión suya, no del profesional.

### El ciclo

Quincenas del **1 al 15** y del **16 a fin de mes**, hora de Costa Rica → liquidación publicada en el CRM → el profesional factura a la plataforma **el monto exacto liquidado** → puede objetar dentro de **5 días hábiles** → pago por transferencia a **5 días hábiles** de validada la factura.

### Lo que falta antes de firmar

**Datos:** razón social, cédula jurídica y representante legal; datos del profesional y su colegiatura; número de anexo; fechas de vigencia y firma; tarifas de SINPE y SINPE Móvil. El plazo de pago de 5 días hábiles debe consignarse también en la cláusula 4.3 del contrato principal y completarse la cuenta IBAN del Anexo A.

**Desarrollo en el CRM:** el canal de objeción por CRM con acuse; la ingesta del costo real de la pasarela —hoy toda cifra es estimación—; el registro del medio de pago y del cargo fijo absorbido; el desglose completo en la vista del profesional; y el tratamiento de reembolsos y contracargos, que no está implementado.

**Validación contable:** confirmar el tratamiento tributario del cargo por cancelación tardía —hoy se factura con el CABYS y la tarifa del servicio agendado— **antes del primer cobro real**.
