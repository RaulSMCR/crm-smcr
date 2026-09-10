# ANEXO [NÚMERO]
## Esquema económico, liquidación y facturación de honorarios profesionales

**Versión del plan:** `patient-retention-2026-07`  
**Fecha de vigencia:** [día] de [mes] de [año]

> # ⛔ DOCUMENTO SUSTITUIDO — NO UTILIZAR
>
> Su contenido fue consolidado en
> [`ANEXO-ECONOMICO-COMISIONES-PROFESIONALES.md`](./ANEXO-ECONOMICO-COMISIONES-PROFESIONALES.md), que es la **versión definitiva** del anexo de comisiones.
> Este archivo se conserva únicamente como antecedente de la negociación: no debe
> firmarse, citarse ni negociarse.

> **Instrucción de completitud:** antes de firmar, deben completarse los campos entre corchetes y verificarse los datos por la asesoría jurídica y contable de las partes. Este documento está diseñado para incorporarse al contrato principal de prestación de servicios profesionales; no lo sustituye.

Entre **[RAZÓN SOCIAL DE LA PLATAFORMA]**, cédula jurídica número **[________]**, representada en este acto por **[NOMBRE DEL REPRESENTANTE]**, mayor, [estado civil], [profesión u oficio], vecino/a de [________], portador/a de la cédula número [________], en adelante la **PLATAFORMA**; y **[NOMBRE COMPLETO DEL PROFESIONAL]**, [tipo de identificación] número **[________]**, en adelante el **PROFESIONAL**; conjuntamente denominados las **PARTES**, se acuerda el presente Anexo al Contrato de Prestación de Servicios Profesionales celebrado el **[fecha del contrato principal]**, conforme a las siguientes cláusulas:

## 1. Objeto, integración y alcance

1.1. Este Anexo forma parte integral del contrato principal y regula exclusivamente el esquema económico aplicable a los servicios prestados por el PROFESIONAL, la liquidación de los montos correspondientes y la facturación que el PROFESIONAL emitirá a la PLATAFORMA.

1.2. La PLATAFORMA presta servicios tecnológicos, administrativos y de intermediación operativa para facilitar la publicación de servicios, la captación y gestión de pacientes, la reserva de citas, el procesamiento de pagos, la comunicación operativa y la emisión de liquidaciones.

1.3. El paciente paga a la PLATAFORMA el precio publicado. El PROFESIONAL actúa como proveedor independiente y emitirá a la PLATAFORMA la factura electrónica correspondiente al monto de sus honorarios determinado en la liquidación.

1.4. Este Anexo no crea relación laboral, salario, jornada, subordinación, exclusividad ni garantía de volumen mínimo de pacientes o de ingresos.

1.5. En caso de contradicción entre este Anexo y cualquier comunicación informal sobre comisiones, prevalecerá este Anexo para las materias económicas que regula. Toda modificación deberá constar por escrito y aplicará de forma prospectiva.

## 2. Definiciones

Para efectos de este Anexo:

| Concepto | Definición |
|---|---|
| **Paciente** | Persona usuaria que reserva o recibe un servicio del PROFESIONAL mediante la PLATAFORMA. |
| **Relación paciente–profesional** | Vínculo individual entre un paciente y el PROFESIONAL. La secuencia de consultas se mantiene aunque cambie el servicio contratado o el período de liquidación. |
| **Consulta efectiva** | Servicio prestado, cobrado, conciliado y no sujeto a reembolso, reversión, contracargo o ajuste pendiente. |
| **Cobro liquidable** | Todo pago del paciente aprobado, conciliado y no reversado. Comprende las Consultas efectivas **y** los cargos por cancelación tardía o inasistencia. Es el hecho que genera Comisión de plataforma y hace avanzar la secuencia. |
| **Cargo por cancelación tardía** | Cargo del 50% del valor de la cita que la política publicada aplica al paciente que cancela con menos de 24 horas o no asiste. |
| **Monto bruto cobrado** | Total cobrado al paciente por la consulta, incluidos los impuestos indirectos que correspondan. |
| **Base sin impuesto** | Monto bruto cobrado menos el impuesto indirecto aplicable. Cuando la tasa aplicable sea 4%, se calcula como `monto bruto / 1,04`. |
| **Adelanto** | Pago parcial realizado por el paciente para reservar una primera consulta. |
| **Costo de procesamiento** | Cargo registrado por el procesador de pagos, incluidos porcentajes, cargos fijos, conversiones y demás conceptos que correspondan al medio de pago utilizado. |
| **Comisión de plataforma** | Retribución de la PLATAFORMA por sus servicios tecnológicos, administrativos, de captación, operación, soporte y servicios conexos. |
| **Liquidación** | Estado de cuenta que detalla las consultas, cobros, impuestos, comisiones, costos de procesamiento, ajustes y monto neto facturable por el PROFESIONAL. |
| **Costo de procesamiento trasladable** | Porción del Costo de procesamiento que, conforme a la cláusula 6, se deduce del monto del PROFESIONAL. No coincide con el Costo de procesamiento cuando opera la cláusula 6.6. |
| **Neto profesional antes de impuesto propio** | Base sin impuesto menos la Comisión de plataforma y menos el Costo de procesamiento trasladable. |
| **Factura profesional** | Comprobante electrónico que el PROFESIONAL emite a la PLATAFORMA por el monto exacto indicado en la Liquidación, más el impuesto que corresponda a dicha factura. |

## 3. Condiciones para generar comisión

3.1. La Comisión de plataforma se genera sobre los Cobros liquidables. **Lo que la devenga es el pago del paciente, no la prestación de la consulta**: todo cobro que el paciente pague por un enlace de pago del PROFESIONAL le genera a este su parte.

3.2. Un cobro reembolsado, reversado o con contracargo no devenga Comisión de plataforma. Los reembolsos, reversos, contracargos y ajustes se tratarán conforme a la cláusula 9.

3.3. La secuencia se calcula cronológicamente para cada relación paciente–profesional, con base en los Cobros liquidables. La secuencia no se reinicia al comenzar una nueva Liquidación, al cambiar de servicio ni al cambiar el precio.

3.4. Una posición de la secuencia se consume cuando el paciente pagó el cobro correspondiente y el pago fue aprobado y conciliado, aunque la consulta no se haya prestado. **Una cita que nadie pagó no consume posición**: su número queda disponible para la siguiente cita de la relación. Que el PROFESIONAL haya marcado la cita como realizada no basta por sí solo, porque en el flujo del CRM esa marca precede al cobro del saldo.

3.5. El adelanto y el saldo de una misma consulta comparten posición: son dos pagos de la misma consulta y no la hacen avanzar dos veces.

3.6. La PLATAFORMA conservará en el CRM el número de consulta utilizado, la tasa aplicada y la versión del plan económico correspondiente a cada registro de liquidación.

## 4. Escala de Comisión de plataforma

La Comisión se calcula sobre la Base sin impuesto de cada Cobro liquidable, conforme a la siguiente escala:

| Posición en la secuencia de la relación paciente–profesional | Comisión de plataforma |
|---:|---:|
| Primera consulta | 45% si se cobra en un solo pago. Si se cobra mediante adelanto y saldo, 50% sobre la base del adelanto y 40% sobre la base del saldo. |
| Segunda consulta | 35% |
| Tercera consulta | 30% |
| Cuarta consulta | 25% |
| Quinta a octava consulta | 20% |
| Novena a vigésima octava consulta | 15% |
| Vigésima novena consulta en adelante | 10% |

4.1. En la primera consulta, cuando el precio se cobra mediante un adelanto del 50% y un saldo del 50%, la fórmula es:

```text
Comisión de la primera consulta =
(Base del adelanto × 50%) + (Base del saldo × 40%)
```

4.2. Cuando el adelanto y el saldo sean iguales, la comisión efectiva sobre la Base sin impuesto total será equivalente al 45%.

4.3. **Cargo por cancelación tardía o inasistencia.** El cargo se liquida como cualquier otro cobro: el PROFESIONAL percibe su parte, porque el horario reservado quedó apartado para ese paciente y no pudo ofrecerse a otro. La Comisión de plataforma se calcula con la tasa que correspondía a esa consulta según su posición en la secuencia —si la cita cancelada era la tercera de la relación, la tasa es 30%— y el cargo consume esa posición conforme a la cláusula 3.4.

Al cargo no se le aplican las tasas desdobladas de la primera consulta: es un cobro único, así que si se cancela tarde la primera cita la tasa es 45%, la misma del pago único. El cargo nunca excede el 50% del valor de la cita fijado por la política publicada.

4.4. La tasa aplicable a cada pago y a cada consulta se conservará como parte de la trazabilidad de la Liquidación. La versión vigente de este esquema es `patient-retention-2026-07`.

## 5. Fórmula de liquidación

Para cada Cobro liquidable se aplicarán las siguientes fórmulas, con redondeo a dos decimales de colón costarricense. El cálculo interno se efectúa en céntimos enteros para evitar arrastre de error:

```text
Base sin impuesto = Monto bruto cobrado / (1 + tasa de impuesto aplicable)

Comisión de plataforma = Base sin impuesto × tasa correspondiente

Neto profesional antes de impuesto propio =
Base sin impuesto
− Comisión de plataforma
− Costo de procesamiento trasladable

Monto de factura profesional =
Neto profesional antes de impuesto propio
+ impuesto aplicable a la factura del PROFESIONAL
```

El neto profesional antes de impuesto propio no podrá ser inferior a cero en una Liquidación.

### Ejemplo ilustrativo

Si el paciente paga **₡40.000**, con una tasa de impuesto del 4%:

```text
Base sin impuesto = ₡40.000 / 1,04 = ₡38.461,54
```

Sin considerar el Costo de procesamiento, el resultado sería:

| Consulta | Comisión | Comisión en colones | Neto antes de impuesto propio |
|---:|---:|---:|---:|
| Primera | 45% | ₡17.307,69 | ₡21.153,85 |
| Segunda | 35% | ₡13.461,54 | ₡25.000,00 |
| Tercera | 30% | ₡11.538,46 | ₡26.923,08 |
| Cuarta | 25% | ₡9.615,38 | ₡28.846,16 |
| Quinta a octava | 20% | ₡7.692,31 | ₡30.769,23 |
| Novena a vigésima octava | 15% | ₡5.769,23 | ₡32.692,31 |
| Vigésima novena en adelante | 10% | ₡3.846,15 | ₡34.615,39 |

## 6. Costo de procesamiento

6.1. El Costo de procesamiento es independiente de la Comisión de plataforma y se mostrará por separado en la Liquidación.

6.2. Se utilizará el costo registrado para la transacción por el procesador de pagos, incluyendo el porcentaje, los cargos fijos, el tipo de cambio y cualquier otro componente aplicable.

6.3. Las PARTES acuerdan expresamente que el Costo de procesamiento trasladable se deducirá del Neto profesional antes de impuesto propio. Este concepto no constituye una comisión adicional de la PLATAFORMA.

6.4. Cuando el procesador todavía no haya entregado el dato definitivo, el CRM podrá utilizar la estimación registrada para la transacción. Si posteriormente se determina una diferencia, esta podrá reflejarse como ajuste en una Liquidación posterior, con identificación de su causa y monto.

6.5. La referencia económica o estimación utilizada por el CRM no sustituye el costo efectivamente documentado por el procesador cuando este se encuentre disponible. La Liquidación indicará si el costo mostrado es el real del procesador o una estimación.

6.6. **El cargo fijo por transacción no se traslada dos veces.** Cuando el adelanto y el saldo de la primera consulta se procesan como dos transacciones independientes, el cargo fijo por transacción del procesador se duplica. Ese segundo cargo fijo lo asume la PLATAFORMA y no se traslada al PROFESIONAL: fraccionar el cobro es una medida de la PLATAFORMA para asegurar la reserva, y quien no tomó esa decisión no debe pagar su costo. El porcentaje del procesador sí se traslada íntegro en ambos tramos, porque es proporcional al dinero efectivamente movido y no se duplica. La Liquidación identificará el cargo fijo asumido por la PLATAFORMA cuando sea aplicable.

6.7. La PLATAFORMA no podrá presentar como Comisión de plataforma un costo que corresponda al procesador, ni denominar «comisión» al Costo de procesamiento en liquidaciones, reportes o comprobantes.

## 7. Períodos y contenido de la Liquidación

7.1. Los períodos de Liquidación serán:

- del día 1 al día 15 de cada mes; y
- del día 16 al último día natural de cada mes.

7.2. La Liquidación se pondrá a disposición del PROFESIONAL en el CRM y deberá mostrar, como mínimo:

1. período liquidado;
2. fecha de cada consulta;
3. identificador permitido del paciente o de la transacción;
4. número de consulta dentro de la relación paciente–profesional;
5. monto bruto cobrado;
6. impuesto indirecto cobrado al paciente;
7. Base sin impuesto;
8. tasa y monto de la Comisión de plataforma;
9. Costo de procesamiento trasladable, indicando si es real o estimado;
10. reembolsos, contracargos, reversos y ajustes;
11. Neto profesional antes de impuesto propio;
12. monto exacto de la Factura profesional; y
13. la versión del plan económico con la que se calculó cada línea.

7.3. La Liquidación no constituye por sí misma una factura ni un anticipo. Solo incluye servicios que cumplan las condiciones de la cláusula 3.

## 8. Facturación del PROFESIONAL a la PLATAFORMA

8.1. El PROFESIONAL deberá emitir a la PLATAFORMA una factura electrónica válida por el monto exacto indicado en la Liquidación, salvo que exista una objeción documentada y aceptada por la PLATAFORMA.

8.2. La factura profesional incluirá el impuesto que corresponda conforme a la situación tributaria del PROFESIONAL y la normativa aplicable. Para la configuración vigente del CRM, la tasa de referencia utilizada es del 4%, salvo que una disposición aplicable o una modificación documentada establezca otra tasa.

8.3. La factura deberá presentarse con la información y documentación necesarias para su validación, incluyendo, cuando corresponda:

- número de identificación del emisor;
- clave numérica de 50 dígitos;
- XML firmado;
- comprobante PDF, si se utiliza como copia de respaldo; y
- cualquier respuesta o comprobante de aceptación exigido por el sistema fiscal aplicable.

8.4. La clave, la identificación del emisor y el XML deberán corresponder al PROFESIONAL que presenta la factura. La PLATAFORMA podrá rechazar o devolver para corrección una factura incompleta, inválida o que no coincida con la Liquidación.

8.5. La presentación de una factura por un monto diferente al liquidado requerirá explicación documentada y aprobación expresa de la PLATAFORMA. La diferencia no se considerará aceptada por el solo hecho de haber sido recibida.

## 9. Reembolsos, reversos y ajustes posteriores

9.1. Si un pago incluido en una Liquidación es reembolsado, desconocido, revertido, objeto de contracargo o afectado por un error de conciliación:

1. se excluirá de la Liquidación si aún no fue facturado;
2. se compensará en la siguiente Liquidación; o
3. si ya fue facturado o pagado, se solicitará la nota de crédito, reintegro u otro comprobante que corresponda.

9.2. Todo ajuste deberá indicar la causa, fecha, monto, transacción afectada, impacto en la Comisión de plataforma, Costo de procesamiento e impuestos.

9.3. La parte no controvertida de una Liquidación podrá facturarse y pagarse sin esperar la resolución de la parte controvertida.

## 10. Presentación de objeciones

10.1. El PROFESIONAL podrá objetar una Liquidación dentro de los **[__] días hábiles** siguientes a su publicación en el CRM.

10.2. La objeción deberá presentarse mediante **[canal de soporte o mecanismo del CRM]**, identificar las transacciones cuestionadas y explicar el motivo de la objeción.

10.3. La PLATAFORMA revisará la objeción dentro de un plazo razonable y comunicará la decisión o el ajuste correspondiente.

## 11. Pago y datos bancarios

11.1. El pago al PROFESIONAL se tramitará después de que concurran las siguientes condiciones:

1. Liquidación disponible;
2. factura electrónica válida y coincidente con la Liquidación;
3. validación administrativa, fiscal y documental; y
4. ausencia de reversos, contracargos o controversias pendientes sobre el monto pagadero.

11.2. El pago se realizará mediante transferencia a la cuenta IBAN registrada por el PROFESIONAL. El PROFESIONAL deberá comunicar cualquier cambio de cuenta mediante el canal seguro que determine la PLATAFORMA.

11.3. El plazo ordinario de pago será de **[__] días hábiles** contados desde la validación de la Liquidación y la recepción de la factura válida, sujeto a los controles operativos, bancarios y de conciliación aplicables.

## 12. Obligaciones tributarias y profesionales

12.1. El PROFESIONAL es responsable de su inscripción tributaria, obligaciones profesionales, declaraciones, comprobantes electrónicos, cargas sociales, seguros, permisos y demás obligaciones que le correspondan como proveedor independiente.

12.2. La PLATAFORMA podrá solicitar razonablemente la información y documentación necesaria para validar el gasto, la trazabilidad de la operación y el tratamiento fiscal de la factura profesional.

12.3. El tratamiento de impuestos, retenciones y cualquier obligación fiscal se aplicará conforme a la legislación vigente y deberá ser revisado por la asesoría contable de las PARTES cuando corresponda.

## 13. Información, confidencialidad y registros

13.1. La PLATAFORMA conservará los registros operativos necesarios para verificar citas, pagos, impuestos, comisiones, costos de procesamiento, liquidaciones, facturas y ajustes.

13.2. Las PARTES tratarán la información personal, financiera y fiscal de acuerdo con la normativa aplicable y utilizarán los canales habilitados para el intercambio de documentos sensibles.

13.3. La información de pacientes se utilizará únicamente para la prestación, administración, seguridad, facturación, soporte y cumplimiento de obligaciones relacionadas con los servicios.

## 14. Vigencia, versión y modificaciones

14.1. Este Anexo regirá a partir del **[fecha de vigencia]** y se aplicará a las Consultas efectivas comprendidas en períodos posteriores a dicha fecha, salvo que las PARTES acuerden expresamente otra regla de transición.

14.2. La versión económica de referencia es **`patient-retention-2026-07`**. La PLATAFORMA mantendrá la parametrización del CRM conforme a las tasas, fórmulas y condiciones de este Anexo.

14.3. Ninguna modificación de tasas, secuencias, períodos, tratamiento del Costo de procesamiento o fórmula de liquidación será aplicable sin documentarse por escrito y comunicarse al PROFESIONAL con anterioridad a su entrada en vigor.

14.4. Las liquidaciones ya cerradas no se modificarán silenciosamente. Cualquier corrección posterior deberá quedar identificada como ajuste, con su causa, fecha y monto.

## 15. Firma de las PARTES

En señal de aceptación, las PARTES firman este Anexo en dos ejemplares de igual valor, en **[lugar]**, a los **[__] días del mes de [________] de [____]**.

| Por la PLATAFORMA | Por el PROFESIONAL |
|---|---|
| Nombre: [____________________________] | Nombre: [____________________________] |
| Identificación: [____________________] | Identificación: [____________________] |
| Cargo: [_____________________________] | Colegio/matrícula: [_________________] |
| Firma: _______________________________ | Firma: _______________________________ |
| Fecha: [_____________________________] | Fecha: [_____________________________] |
