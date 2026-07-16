# Anexo [__] - Esquema economico, liquidacion y pago de honorarios profesionales

> Documento de trabajo para incorporacion al contrato de prestacion de servicios profesionales. Debe ser revisado y ajustado por el profesional en Derecho y la persona profesional en contaduria de LAS PARTES antes de su firma. Los campos entre corchetes son editables.

Entre **[NOMBRE DE LA SOCIEDAD]**, cedula juridica numero **[__]**, en adelante, la **"CONTRATANTE"**, y **[NOMBRE DEL PROFESIONAL]**, cedula numero **[__]**, en adelante, el **"PROFESIONAL"**, se acuerda el presente Anexo, que forma parte integral del Contrato de Prestacion de Servicios Profesionales suscrito entre LAS PARTES.

## 1. Objeto y alcance economico

El presente Anexo regula exclusivamente la forma de calculo, liquidacion, facturacion y pago de los honorarios que corresponden al PROFESIONAL por los servicios efectivamente prestados a pacientes que hayan sido cobrados y conciliados por medio de la plataforma tecnologica administrada por la CONTRATANTE (el **"CRM"**).

La CONTRATANTE factura al paciente el monto total de la consulta o servicio. El PROFESIONAL actua como proveedor independiente y factura a la CONTRATANTE los honorarios netos que resulten de cada liquidacion, en los terminos de este Anexo. Este Anexo no crea relacion laboral, salario, jornada, exclusividad, subordinacion ni garantia de volumen minimo de pacientes.

## 2. Definiciones

Para efectos de este Anexo:

| Termino | Significado |
|---|---|
| **Pago aprobado** | Pago electronico confirmado por el procesador de pagos y registrado en el CRM como aprobado. |
| **Periodo de liquidacion** | Del dia 1 al 15, o del dia 16 al ultimo dia natural de cada mes, hora de Costa Rica. |
| **Monto bruto cobrado** | Suma de los pagos aprobados de las consultas o servicios del PROFESIONAL en el Periodo de Liquidacion, incluido el impuesto aplicable al paciente. |
| **Base sin impuesto** | Monto bruto cobrado menos el impuesto aplicable, calculado conforme a la tarifa vigente configurada para el servicio. |
| **Comision de plataforma** | Retribucion de la CONTRATANTE por tecnologia, administracion, captacion, operacion, facturacion, soporte y servicios conexos, calculada de forma marginal segun la tabla de la clausula 3. |
| **Costo de procesamiento** | Cargo atribuible al medio de pago electronico utilizado, conforme a la tarifa aplicable del procesador o la configuracion vigente del CRM. |
| **Neto profesional** | Base sin impuesto menos Comision de Plataforma y menos Costo de Procesamiento, antes del impuesto que corresponda a la factura del PROFESIONAL. |
| **Liquidacion** | Estado de cuenta emitido por el CRM que detalla los pagos, deducciones y neto facturable del Periodo de Liquidacion. |

## 3. Comision de plataforma: escala marginal

La Comision de Plataforma se determina **por cada PROFESIONAL y por cada Periodo de Liquidacion**, sobre la Base sin Impuesto acumulada en dicho periodo. La escala es marginal: cada porcentaje se aplica solamente al tramo que corresponda, no sobre la totalidad de la Base sin Impuesto.

| Tramo acumulado de Base sin Impuesto por periodo | Porcentaje de Comision de Plataforma |
|---|---:|
| Desde CRC 0,00 hasta CRC 600.000,00 | 20% |
| Sobre el exceso de CRC 600.000,00 y hasta CRC 1.200.000,00 | 15% |
| Sobre el exceso de CRC 1.200.000,00 y hasta CRC 1.650.000,00 | 10% |
| Sobre el exceso de CRC 1.650.000,00 y hasta CRC 2.100.000,00 | 7% |
| Sobre el exceso de CRC 2.100.000,00 | 2% |

**Ejemplo ilustrativo.** Si la Base sin Impuesto acumulada en un Periodo de Liquidacion es de CRC 1.500.000,00, la Comision de Plataforma sera: CRC 600.000 x 20% + CRC 600.000 x 15% + CRC 300.000 x 10% = **CRC 240.000,00**. La tasa efectiva de ese ejemplo es 16%, pero no constituye una tasa fija aplicable a otros montos.

La escala se reinicia al inicio de cada nuevo Periodo de Liquidacion. Cualquier modificacion futura de los tramos, porcentajes o periodicidad requerira acuerdo escrito de LAS PARTES y aplicara exclusivamente en forma prospectiva.

## 4. Costos de procesamiento de pago electronico

Todos los pacientes cubiertos por este esquema pagaran mediante medios electronicos habilitados en la plataforma. El Costo de Procesamiento atribuible a cada pago aprobado se deducira de la Liquidacion del PROFESIONAL.

El costo se calculara conforme a la tarifa vigente del procesador de pagos, el medio utilizado y, cuando aplique, sus cargos fijos por transaccion. El CRM reflejara el costo atribuido en la Liquidacion. La CONTRATANTE no aplicara recargos distintos de los expresamente previstos en este Anexo sin comunicacion previa y acuerdo escrito cuando corresponda.

## 5. Formula de calculo

Para cada pago aprobado, el CRM aplicara la siguiente metodologia, con redondeo a dos decimales de colon costarricense:

```text
Base sin impuesto = Monto bruto cobrado / (1 + tasa de impuesto aplicable)

Comision de plataforma = suma de la comision marginal de cada tramo aplicable

Neto profesional antes de impuesto =
Base sin impuesto - Comision de plataforma - Costo de procesamiento

Monto de factura profesional =
Neto profesional antes de impuesto + impuesto aplicable en la factura del PROFESIONAL
```

Cuando la normativa aplicable y la condicion tributaria del PROFESIONAL determinen una tarifa distinta, el tratamiento tributario debera ajustarse a la normativa vigente y a los comprobantes electronicos validamente emitidos.

## 6. Cierre, liquidacion y presentacion de factura

1. El CRM generara la Liquidacion correspondiente al periodo cerrado el dia 16 de cada mes para el periodo del 1 al 15, y el dia 1 del mes siguiente para el periodo del 16 al ultimo dia del mes.
2. La Liquidacion mostrara, como minimo, el monto bruto cobrado, la base sin impuesto, la comision, el costo de procesamiento, el neto profesional, el impuesto de la factura profesional y el monto total a facturar.
3. El PROFESIONAL debera revisar la Liquidacion y presentar a traves del CRM su factura electronica por el monto total exacto indicado en ella, junto con la documentacion requerida por la CONTRATANTE y la normativa aplicable, incluido el XML valido cuando corresponda.
4. La presentacion de una factura por un monto distinto al de la Liquidacion requerira nota explicativa y aprobacion expresa de la CONTRATANTE. El CRM podra rechazar automaticamente montos que no coincidan con el neto liquidado.
5. La factura quedara sujeta a validacion administrativa, fiscal y documental. La aceptacion de una factura no implica renuncia de la CONTRATANTE a revisar errores, duplicidades, pagos reversados o incumplimientos detectados posteriormente.

## 7. Pago de honorarios

Una vez presentada una factura valida, coincidente con la Liquidacion y aceptada por la CONTRATANTE, esta gestionara el pago al PROFESIONAL mediante transferencia bancaria a la cuenta IBAN previamente registrada.

El plazo de pago sera **[el mismo dia habil de la validacion / dentro de __ dias habiles de la validacion]**, sujeto a la disponibilidad operativa del sistema bancario, controles de prevencion de fraude, validacion tributaria y ausencia de controversias justificadas. El registro de pago en el CRM constituira constancia operativa de la orden o confirmacion del pago, sin perjuicio del comprobante bancario correspondiente.

La Liquidacion y el pago no constituyen anticipo de servicios futuros. Solo se liquidan servicios efectivamente cobrados, aprobados y no reversados.

## 8. Reversiones, reembolsos, contracargos y ajustes

Si un pago es anulado, reembolsado, desconocido, objeto de contracargo, fraude, error de conciliacion o cualquier otra reversa posterior a su inclusion en una Liquidacion, la CONTRATANTE podra:

1. excluirlo de la Liquidacion si esta aun no ha sido facturada;
2. compensar el monto correspondiente en la siguiente Liquidacion; o
3. solicitar la emision de la nota de credito o el reintegro que legalmente corresponda, cuando ya exista factura o pago.

Todo ajuste debera quedar identificado en el CRM, con su causa, fecha y monto. La CONTRATANTE procurara notificarlo al PROFESIONAL por los medios habilitados en la plataforma.

## 9. Obligaciones tributarias y documentales

El PROFESIONAL declara que es responsable de su propia inscripcion tributaria, obligaciones profesionales, declaraciones, comprobantes electronicos, cargas sociales, seguros, permisos y tributos que le correspondan como proveedor independiente.

El PROFESIONAL debera emitir comprobantes electronicos validos, con la clave, identificacion, XML y demas requisitos legales o administrativos que le sean solicitados razonablemente para respaldar el gasto, el credito fiscal y la trazabilidad de la operacion de la CONTRATANTE.

La CONTRATANTE podra retener, compensar o reportar los montos que resulte obligada a aplicar por ley, resolucion administrativa o requerimiento de autoridad competente. Cualquier tratamiento de IVA, renta, retencion o credito fiscal se entendera sujeto a la legislacion costarricense vigente y a la revision del profesional en contaduria de LAS PARTES.

## 10. Transparencia, consulta y objeciones

El PROFESIONAL tendra acceso, a traves del CRM, al detalle de sus Liquidaciones y facturas. Cualquier objecion debera presentarse por escrito mediante **[canal de soporte]** dentro de los **[__] dias habiles** siguientes a la publicacion de la Liquidacion, identificando las transacciones cuestionadas y el motivo.

La CONTRATANTE revisara la objecion dentro de un plazo razonable. La parte no controvertida de la Liquidacion podra facturarse y pagarse sin esperar la resolucion de la parte controvertida.

## 11. Vigencia, prelacion y modificaciones

Este Anexo rige a partir del **[fecha]** y se mantendra vigente mientras permanezca vigente el Contrato principal, salvo modificacion escrita suscrita por LAS PARTES.

En caso de contradiccion, prevalecera el Contrato principal respecto de la naturaleza de la relacion juridica, confidencialidad, proteccion de datos, responsabilidad, terminacion y solucion de controversias; y prevalecera este Anexo respecto del mecanismo economico de liquidacion, salvo que LAS PARTES pacten expresamente lo contrario.

Firmado en **[lugar]**, el **[fecha]**, en dos ejemplares de igual tenor.

| Por la CONTRATANTE | Por el PROFESIONAL |
|---|---|
| Nombre: [__] | Nombre: [__] |
| Cargo: [__] | Cedula: [__] |
| Firma: [__] | Firma: [__] |

