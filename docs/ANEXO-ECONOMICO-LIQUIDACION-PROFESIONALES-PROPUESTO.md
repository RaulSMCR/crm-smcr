# Anexo [__] - Esquema económico, liquidación y pago de honorarios profesionales

> **Documento de trabajo.** Requiere revisión y aprobación de las partes, de la asesoría jurídica y de la asesoría contable. No sustituye un contrato principal ni constituye asesoría legal, tributaria o contable. Los campos entre corchetes **[__]** deben completarse antes de la firma.
>
> **Alineación técnica.** El cálculo descrito en este Anexo corresponde exactamente al plan implementado en el CRM bajo la versión `patient-retention-2026-07` (`src/lib/commission-plan.js`). Cualquier modificación de tasas o fórmulas debe hacerse en ambos lugares a la vez y con una nueva versión de plan.
>
> **Estado del contrato principal.** El contrato marco existe como plantilla en
> [`contratos/CONTRATO-SERVICIOS-PROFESIONALES-SaludMentalCR.docx`](./contratos/CONTRATO-SERVICIOS-PROFESIONALES-SaludMentalCR.docx), pero **está sin firmar y sin completar**: todos sus campos de partes, precio, plazo y notificaciones siguen en blanco, y su fecha de firma dice «dos mil veinticuatro (2024)». **No debe afirmarse que existe un contrato principal suscrito.** Este Anexo no puede firmarse antes que él, y la cláusula 1.1 describe cómo se articulan.

## 1. Partes, naturaleza y alcance

Entre **[NOMBRE DE LA SOCIEDAD — PENDIENTE]**, cédula jurídica **[__ — PENDIENTE]**, en adelante la **PLATAFORMA**, y **[NOMBRE DEL PROFESIONAL — PENDIENTE]**, cédula **[__ — PENDIENTE]**, en adelante el **PROFESIONAL**, se suscribe el presente Anexo, destinado a incorporarse al contrato de prestación de servicios profesionales que las partes celebren o hayan celebrado.

La PLATAFORMA presta servicios tecnológicos, administrativos y de intermediación operativa para facilitar la publicación de servicios, la captación y gestión de pacientes, la reserva de citas, el procesamiento de pagos, la comunicación operativa y la emisión de liquidaciones.

El presente Anexo regula exclusivamente el mecanismo económico aplicable a los servicios efectivamente prestados, cobrados, conciliados y no reversados mediante la PLATAFORMA. No crea relación laboral, salario, jornada, subordinación, exclusividad ni garantía de volumen mínimo.

### 1.1 Relación con el contrato principal y su Anexo A

El contrato marco (`CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES`) remite el precio a su **Anexo A**, que prevé un campo «Precio» de monto fijo por disciplina. **Ese campo es incompatible con un esquema de comisión variable por secuencia de consultas.** Para evitar dos reglas de precio simultáneas, al firmar debe hacerse una de estas dos cosas, y dejarlo dicho expresamente:

1. consignar en el campo «Precio» del Anexo A la remisión: *«Según el Anexo [__] — Esquema económico, liquidación y pago de honorarios profesionales»*; o
2. sustituir íntegramente ese campo por el presente Anexo.

En caso de contradicción entre el campo «Precio» del Anexo A y este Anexo, **prevalece este Anexo** en todo lo relativo a comisión, costo de procesamiento, liquidación y monto facturable.

Las siguientes cláusulas del contrato principal se dan por incorporadas y no se repiten aquí: naturaleza mercantil y ausencia de relación laboral (5.3), confidencialidad (5.4), protección de datos de los Usuarios conforme a la Ley 8968 (5.2), terminación y suspensión (5.1 a 5.3), cesión (5.7) y legislación aplicable (5.5).

> **Concordancia obligatoria.** El **plazo de pago** de la cláusula 8.2 de este Anexo y el de la cláusula 4.3 del contrato principal deben ser **el mismo número de días**. Hoy ambos están en blanco. Igual concordancia aplica al medio de pago: el contrato principal exige transferencia electrónica a la cuenta indicada en su Anexo A.

### 1.2 Costos por cuenta del PROFESIONAL

La cláusula 4.2 del contrato principal establece que todo gasto, costo, impuesto, carga o tasa aplicable a los Servicios corre por cuenta exclusiva del PROFESIONAL y no aumenta el precio. Esa cláusula es el fundamento contractual del traslado del Costo de procesamiento previsto en la cláusula 6.2 de este Anexo.

### 1.3 Dirección de la facturación

**El PROFESIONAL factura a la PLATAFORMA, no al Paciente.** El PROFESIONAL actúa como proveedor independiente y emite su comprobante electrónico a nombre de la PLATAFORMA por el monto que resulte de cada Liquidación. La relación de cobro con el Paciente la mantiene la PLATAFORMA.

## 2. Definiciones

| Término | Definición |
|---|---|
| **Paciente** | Persona usuaria registrada o identificable en la PLATAFORMA que reserva o recibe un servicio profesional. |
| **Consulta efectiva** | Consulta prestada, cobrada, conciliada y no objeto de reembolso, reversión, contracargo o ajuste pendiente. |
| **Cobro liquidable** | Todo pago aprobado, conciliado, facturado y no reversado que el Paciente realice mediante un enlace de pago del PROFESIONAL. Comprende las Consultas efectivas **y** los cargos por cancelación tardía o inasistencia. Es el hecho que genera Comisión de plataforma y hace avanzar la Secuencia (cláusula 4.3.2). |
| **Primera consulta** | Primera Consulta efectiva dentro de una relación entre un Paciente y un PROFESIONAL. Cada relación Paciente–PROFESIONAL mantiene una secuencia independiente, que **no se reinicia** por cambio de servicio ni por Período de liquidación. |
| **Secuencia de consultas** | Numeración cronológica y acumulativa de los Cobros liquidables de una misma relación Paciente–PROFESIONAL. Determina la tasa de comisión aplicable. |
| **Monto bruto cobrado** | Total cobrado al Paciente por la consulta, incluidos los impuestos indirectos que correspondan. |
| **Base sin impuesto** | `Monto bruto cobrado / (1 + tasa de impuesto aplicable)`. Para una tasa del 4%: `Monto bruto / 1,04`. Es la base de cálculo de la Comisión de plataforma. |
| **Adelanto** | Pago del 50% del precio de la primera consulta realizado para reservarla. Es un pago a cuenta: no constituye por sí mismo una consulta realizada ni una comisión devengada, y no se liquida por separado del saldo. |
| **Costo de procesamiento** | Cargo efectivamente aplicado por el procesador de pagos (ONVO u otro) por cada transacción, conforme al medio de pago, la tarifa porcentual y los cargos fijos vigentes. **No es Comisión de plataforma** y no puede presentarse como tal. |
| **Costo de procesamiento trasladable** | Porción del Costo de procesamiento que, conforme a la cláusula 6, se deduce del monto del PROFESIONAL. |
| **Comisión de plataforma** | Retribución de la PLATAFORMA por tecnología, captación, operación, administración, soporte y servicios conexos, calculada sobre la Base sin impuesto según la Secuencia de consultas del Paciente. |
| **Neto profesional antes de impuesto propio** | Base sin impuesto − Comisión de plataforma − Costo de procesamiento trasladable. |
| **Monto de factura profesional** | Neto profesional antes de impuesto propio + el impuesto que corresponda a la factura del PROFESIONAL. Es el monto exacto que debe facturarse a la PLATAFORMA. |
| **Período de liquidación** | Del día 1 al 15 y del día 16 al último día natural de cada mes, hora de Costa Rica. |

En el contrato principal la PLATAFORMA se denomina **SaludMentalCR** y el PROFESIONAL aparece como **«Proveedor»** en el encabezado y como **«Profesional»** en el resto del articulado. Al firmar debe unificarse la terminología en ambos documentos; en este Anexo, PLATAFORMA y SaludMentalCR designan a la misma parte, y PROFESIONAL y Proveedor a la otra.

## 3. Principios económicos y contables

### 3.0 Principios rectores

Dos principios gobiernan la interpretación de todo este Anexo y prevalecen sobre cualquier cláusula que se les oponga:

1. **Justicia con el PROFESIONAL.** Todo cobro que el Paciente pague por un enlace del PROFESIONAL le genera a este su parte. Ninguna deducción se le aplica sin estar expresamente pactada aquí, y ningún defecto de implementación puede convertirse en un ingreso para la PLATAFORMA a costa suya. Ante una duda de cálculo que este Anexo no resuelva con claridad, se resuelve **a favor del PROFESIONAL**.

2. **Corrección ante la Administración Tributaria.** Cada cobro se declara por lo que realmente es: con el código CABYS que corresponde a lo efectivamente prestado y con la tarifa de impuesto que la ley le asigna. Ninguna conveniencia operativa justifica declarar un servicio que no se prestó, aplicar una tarifa reducida donde no procede, ni presentar un concepto bajo el nombre de otro.

Cuando ambos principios parezcan entrar en tensión, la corrección tributaria fija **qué** se declara y **cómo**; la justicia con el PROFESIONAL fija **cuánto le corresponde** de lo declarado. No son alternativos: se cumplen los dos.

### 3.1 Reglas derivadas

1. La Comisión de plataforma se calcula sobre la **Base sin impuesto**, nunca sobre el impuesto indirecto cobrado al Paciente.
2. El impuesto cobrado al Paciente **no constituye ingreso propio de la PLATAFORMA** y recibirá el tratamiento fiscal y contable que corresponda.
3. La Secuencia de consultas de cada relación Paciente–PROFESIONAL **se conserva entre períodos**. El cierre quincenal no la reinicia.
4. La comisión se devenga sobre **Cobros liquidables**: pagos aprobados, conciliados, facturados y no reversados, reembolsados ni sujetos a contracargo. Comprende las Consultas efectivas y los cargos por cancelación tardía o inasistencia (cláusula 4.3.1). Un cobro reversado, reembolsado o con contracargo no devenga comisión.
5. El Adelanto de la primera consulta mejora la previsibilidad de cobro y reduce el riesgo de reserva, pero no convierte una cita cancelada en servicio prestado. El Adelanto se liquida junto con el saldo de esa misma consulta, no antes.
6. El Costo de procesamiento se mantiene **separado** de la Comisión de plataforma en el cálculo, en la Liquidación y en la contabilidad.
7. El PROFESIONAL emitirá el comprobante fiscal que corresponda por el monto liquidado, conforme a su situación tributaria y a la normativa vigente.
8. Ninguna tasa o porcentaje de este Anexo se interpretará como renuncia a impuestos, retenciones, cargos del procesador o deberes formales exigibles por ley.

## 4. Adelanto y cancelación de la primera consulta

### 4.1 Reserva

Para reservar la primera consulta, el Paciente abonará un Adelanto equivalente al **50% del precio publicado**. El saldo del 50% se cobrará conforme al flujo operativo de la PLATAFORMA.

### 4.2 Cancelación con al menos 24 horas

El Paciente podrá cancelar la primera consulta con una anticipación mínima de **24 horas** respecto de la hora programada, en la zona horaria de Costa Rica. Cuando la cancelación se realice dentro de ese plazo:

1. se devolverá el monto pagado, sujeto únicamente a los costos de procesamiento efectivamente no recuperables y previamente informados;
2. no se devengará Comisión de plataforma por una consulta no realizada;
3. el impuesto indirecto deberá reversarse o ajustarse conforme al comprobante y tratamiento contable aplicable; y
4. el Paciente conservará, cuando corresponda, su condición de Paciente no atendido para efectos de la Secuencia de consultas.

### 4.3 Cancelación tardía e inasistencia

Rige la política de agendamiento y cancelación publicada en los Términos y Condiciones y aceptada por el Paciente al registrarse, que las partes declaran conocer. Sus reglas vigentes son:

| Supuesto | Consecuencia para el Paciente |
|---|---|
| Cancelar o reprogramar con **24 horas o más** de anticipación | Sin cargo. No requiere justificación. |
| Cancelar o reprogramar con **menos de 24 horas** | Se cobra el **50% del valor de la cita**. |
| **Inasistencia** sin aviso | Se cobra el **50% del valor de la cita**. |

Cuando el Paciente ya había pagado el Adelanto del 50%, **ese monto cubre íntegramente el cargo y no se le cobra nada adicional**: el cargo por cancelación tardía y el Adelanto son la misma proporción del precio.

En los dos últimos supuestos, la agenda del Paciente queda en pausa: no puede reservar ni mover citas por su cuenta hasta que un administrador lo restablezca, después de contactarlo. La política también puede exigirle releer y volver a aceptar el acuerdo de atención antes de reservar de nuevo.

Estas reglas están implementadas en `src/lib/rescheduling-policy.js` (`HORAS_MINIMAS_REAGENDA = 24`, `PORCENTAJE_MULTA = 50`). **Cualquier cambio en ellas debe hacerse simultáneamente en los Términos y Condiciones, en este Anexo y en el código**, para que los tres digan lo mismo.

#### 4.3.1 Tratamiento económico del cargo por cancelación tardía

**El cargo por cancelación tardía o inasistencia se liquida como cualquier otro cobro.** El PROFESIONAL percibe su parte, porque el horario reservado quedó apartado para ese Paciente y no pudo ofrecerse a otro.

En consecuencia:

1. el cargo **se incluye en la Liquidación** del Período en que se cobró;
2. la Comisión de plataforma se calcula con **la misma tasa que correspondía a esa consulta según la Secuencia** — si la cita cancelada era la tercera de la relación, la tasa es 30%;
3. la Base sin impuesto, el Costo de procesamiento trasladable y el Monto de factura profesional se determinan con las mismas fórmulas de la cláusula 7; y
4. el cargo **consume el número que ocupaba en la Secuencia de consultas**, conforme a la cláusula 4.3.2.

En ningún caso el cargo excede el 50% del valor de la cita fijado por la política publicada.

#### 4.3.1.1 Tratamiento tributario del cargo — **PENDIENTE DE CRITERIO CONTABLE**

> **Advertencia.** Un cargo por cancelación tardía **no retribuye un servicio de salud prestado**: retribuye un horario reservado que no pudo aprovecharse. Por el principio rector de corrección tributaria (cláusula 3.0), **no puede declararse con el código CABYS del servicio profesional ni con su tarifa reducida** solo porque sea lo más cómodo de emitir.
>
> Antes del primer cobro real debe definirse, con criterio contable expreso:
>
> 1. si el cargo es **hecho generador de IVA** o queda fuera del ámbito por tratarse de una indemnización por incumplimiento;
> 2. de estar sujeto, **qué tarifa** le corresponde —la reducida de servicios de salud no es aplicable de oficio a una penalización—;
> 3. **qué código CABYS** lo identifica; y
> 4. **qué tipo de comprobante** se emite.
>
> **Estado actual del CRM:** la transacción de multa se crea sin tasa propia y hereda el 4% por defecto, y la factura toma el CABYS y el impuesto del servicio agendado. Es decir, hoy se declararía como si la consulta se hubiera prestado. **Debe corregirse antes de procesar el primer cobro.**

#### 4.3.2 Hecho generador y avance de la Secuencia

**Lo que genera comisión y hace avanzar la Secuencia es el pago, no la realización de la consulta.** Una posición de la Secuencia se consume cuando concurren las dos condiciones siguientes:

1. el Paciente **pagó** el enlace de pago correspondiente y el pago fue aprobado y conciliado; y
2. se **emitió la factura** que respalda ese cobro.

Cumplidas ambas, la posición queda consumida aunque la consulta no se haya prestado. Si el Paciente **no paga** el cargo por cancelación tardía, esa posición **no se consume** y queda disponible para la siguiente cita de la relación.

> **Riesgo operativo que debe vigilarse.** Como el avance depende del pago y no de la fecha de la cita, un cargo pagado con retraso podría pretender ocupar una posición ya asignada a una consulta posterior que se liquidó antes. La numeración se fija al liquidar y **no se recalcula hacia atrás**: una Liquidación cerrada nunca cambia. Un pago que llegue después de cerrado el Período toma la posición siguiente disponible al momento de liquidarse, y la Liquidación deberá dejar constancia de esa circunstancia.

## 5. Escala de Comisión de plataforma

La escala se aplica por relación Paciente–PROFESIONAL, en orden cronológico, sobre la Base sin impuesto de cada Cobro liquidable:

| Posición en la Secuencia del Paciente | Comisión de plataforma |
|---:|---:|
| **Primera consulta** | Ver cláusula 5.1 — tasa efectiva **45%** cuando adelanto y saldo son iguales |
| Segunda consulta | 35% |
| Tercera consulta | 30% |
| Cuarta consulta | 25% |
| Consultas quinta a octava | 20% |
| Consultas novena a vigésima octava | 15% |
| **Consulta vigésima novena en adelante** | **10%** |

La tasa del 10% constituye el nivel de fidelidad y continuidad, y no tiene fecha de término: rige mientras el Paciente permanezca activo con ese PROFESIONAL. No se reducirá a una tasa meramente equivalente a impuestos o procesamiento, pues la PLATAFORMA continúa prestando servicios tecnológicos, administrativos y de soporte.

### 5.1 Primera consulta: adelanto y saldo

La primera consulta se cobra en dos pagos y **cada pago tiene su propia tasa**, aplicada sobre la Base sin impuesto de ese pago:

| Tipo de pago | Tasa sobre la base de ese pago |
|---|---:|
| Adelanto del 50% (`DEPOSIT_50`) | **50%** |
| Saldo del 50% (`BALANCE_50`) | **40%** |
| Pago único del 100% (`FULL_100`) | **45%** |

```text
Comisión primera consulta = (Base del adelanto × 50%) + (Base del saldo × 40%)
```

Cuando el adelanto y el saldo son iguales, la comisión efectiva total equivale al **45%** de la Base sin impuesto de la consulta, idéntica a la del pago único.

Estas tres tasas aplican **únicamente a la primera consulta** de la relación. A partir de la segunda, rige la tasa de la Secuencia de consultas con independencia de cómo se haya fraccionado el cobro.

### 5.2 Ejemplo por consulta

Con un precio bruto de CRC 40.000 e impuesto del 4%:

```text
Base sin impuesto = CRC 40.000 / 1,04 = CRC 38.461,54
```

| Consulta | Tasa | Comisión aproximada |
|---:|---:|---:|
| Primera (tasa efectiva) | 45% | CRC 17.307,69 |
| Segunda | 35% | CRC 13.461,54 |
| Tercera | 30% | CRC 11.538,46 |
| Cuarta | 25% | CRC 9.615,38 |
| Quinta a octava | 20% | CRC 7.692,31 |
| Novena a vigésima octava | 15% | CRC 5.769,23 |
| Vigésima novena en adelante | 10% | CRC 3.846,15 |

La comisión de la primera consulta solo se devenga cuando la consulta se realiza, cobra y concilia. El Adelanto no modifica esa condición.

## 6. Costo de procesamiento

### 6.1 Determinación

El Costo de procesamiento se determina conforme al **cargo real del procesador** cuando este consta registrado en la transacción. Cuando un registro antiguo no tenga el costo real guardado, el CRM conserva su mecanismo de estimación, identificando el resultado como estimado.

La estructura de cargos del procesador **no es un porcentaje simple**: combina un porcentaje sobre el monto cobrado con un **cargo fijo por transacción denominado en dólares**, que debe convertirse a colones con el tipo de cambio aplicado. La Liquidación registrará el monto en dólares y el tipo de cambio utilizado, de modo que la diferencia contra la liquidación del procesador sea explicable.

> **Campo pendiente.** Las tarifas concretas por medio de pago **deben incorporarse expresamente antes de la firma**: `[porcentaje y fijo para tarjeta]`, `[porcentaje y fijo para SINPE]`, `[porcentaje y fijo para SINPE Móvil]`. La configuración vigente del CRM es parametrizable por variables de entorno; las tarifas de SINPE no están confirmadas por el procesador.

### 6.2 Traslado al PROFESIONAL

**El Costo de procesamiento trasladable se deduce del monto del PROFESIONAL.** Esta deducción es expresa y se aplica en cada Liquidación, con identificación separada del monto y del medio de pago que lo originó. Su fundamento es la cláusula 4.2 del contrato principal, conforme a la cláusula 1.2 de este Anexo.

La PLATAFORMA **no podrá presentar como Comisión de plataforma** un costo que corresponda al procesador, ni denominar "comisión" al Costo de procesamiento en liquidaciones, reportes o comprobantes.

Si el adelanto y el saldo se procesan como dos transacciones independientes, **los cargos fijos del procesador se duplican**. La Liquidación deberá identificar este efecto cuando sea aplicable.

## 7. Fórmula de liquidación

Para cada Cobro liquidable:

```text
Base sin impuesto = Monto bruto cobrado / (1 + tasa de impuesto aplicable)

Comisión de plataforma = Base sin impuesto × tasa de la Secuencia de consultas

Neto profesional antes de impuesto propio =
    Base sin impuesto
  - Comisión de plataforma
  - Costo de procesamiento trasladable

Monto de factura profesional =
    Neto profesional antes de impuesto propio
  + impuesto que corresponda a la factura del PROFESIONAL
```

El redondeo se realiza a dos decimales de colón costarricense. El cálculo interno se efectúa en céntimos enteros para evitar arrastre de error.

## 8. Liquidación, conciliación y pago

La PLATAFORMA emitirá una Liquidación por cada Período de liquidación. Como mínimo deberá mostrar:

1. Paciente o identificador de transacción permitido por la normativa de protección de datos;
2. fecha de la consulta;
3. número de consulta dentro de la Secuencia del Paciente;
4. monto bruto cobrado;
5. impuesto indirecto separado;
6. Base sin impuesto;
7. tasa y monto de Comisión de plataforma;
8. Costo de procesamiento, indicando si es real o estimado;
9. ajustes, reembolsos, contracargos o reversiones;
10. Neto profesional antes de impuesto propio;
11. Monto de factura profesional; y
12. la versión del plan de comisiones aplicada a cada línea.

### 8.1 Coincidencia exacta entre factura y Liquidación

**El Monto de factura profesional debe coincidir exactamente con el monto de la Liquidación vinculada.** Cuando exista una Liquidación vinculada, el CRM rechaza la presentación de una factura por un monto distinto. El PROFESIONAL no podrá facturar de más ni de menos contra una Liquidación.

Si el PROFESIONAL considera que el monto liquidado es incorrecto, debe objetar la Liquidación por el procedimiento de la cláusula 8.2 en lugar de facturar un monto diferente.

### 8.2 Objeción y pago — **PENDIENTE DE DEFINIR**

> **Campos pendientes.** Deben completarse antes de la firma:
>
> - **Plazo para objetar** una Liquidación: **[__] días hábiles** desde su puesta a disposición.
> - **Canal formal de objeción**: **[__ — correo, CRM u otro medio con acuse]**.
> - **Plazo de pago**: **[__] días hábiles** desde la validación de la Liquidación y la recepción de la factura válida.

La Liquidación se pondrá a disposición del PROFESIONAL en el CRM. El pago queda sujeto a controles antifraude, conciliación bancaria, ausencia de reversos y cumplimiento documental.

## 9. Reversiones, reembolsos y ajustes posteriores

Si un pago incluido en una Liquidación es reembolsado, desconocido, objeto de contracargo, revertido o afectado por un error de conciliación:

1. se excluirá de la Liquidación si aún no fue facturado;
2. se compensará en la siguiente Liquidación; o
3. se solicitará el comprobante de ajuste que corresponda si ya fue facturado o pagado.

El ajuste identificará causa, fecha, monto, transacción afectada y tratamiento de impuesto, procesamiento y comisión.

## 10. Información, auditoría y protección de datos

La PLATAFORMA conservará registros operativos suficientes para verificar la Secuencia de consultas, pagos, reembolsos, tasas y liquidaciones. El PROFESIONAL podrá solicitar el detalle de una Liquidación conforme al procedimiento de objeciones.

Las partes tratarán los datos personales conforme a la normativa aplicable. La información de Pacientes se utilizará únicamente para la prestación, administración, seguridad, facturación, soporte y cumplimiento de obligaciones relacionadas con el servicio.

### 10.1 Expediente clínico: pertenencia y custodia

**El expediente clínico pertenece al Paciente y al PROFESIONAL tratante. La PLATAFORMA no lo tiene, no lo lee y no lo guarda.**

El secreto profesional y la custodia del expediente son obligación **exclusiva del PROFESIONAL**, conforme al Código de Ética y demás normativa de su colegio profesional. La PLATAFORMA no asume esa custodia, no la comparte y no puede responder por ella. Nada en este Anexo, en el contrato principal ni en la operación del CRM debe interpretarse como que la PLATAFORMA custodia, accede o conserva contenido clínico.

El Paciente puede solicitar copia de su expediente en cualquier momento conforme a la Ley N.º 8239; esa solicitud se dirige al PROFESIONAL, que es quien puede atenderla.

### 10.2 Registro administrativo del proceso

Lo que sí administra la PLATAFORMA es un **registro operativo sin contenido clínico**, que comprende únicamente:

1. la **apertura** del proceso y su fecha;
2. el **cierre** y su fecha;
3. la **categoría del cierre** —alta o baja, con su tipo—;
4. cuando el cierre es una derivación, el destino de la derivación, sin las indicaciones; y
5. las atestaciones del PROFESIONAL de que informó a la persona y de que dejó constancia en su expediente.

**Ese registro no forma parte del expediente clínico** ni lo sustituye. No contiene lo tratado en consulta.

La apertura, el alta y la baja se trabajan **en equipo con fines de supervisión**, y el cierre del registro es visado por la Dirección Clínica antes de quedar firme. Es un control interno de calidad documental que protege a ambas partes: **no es una revisión del tratamiento y no otorga acceso al expediente clínico.**

La conservación de ese registro administrativo por diez años es una decisión de la PLATAFORMA para respaldo contable y de auditoría, y **no equivale ni sustituye** al plazo de conservación del expediente clínico que corresponde al PROFESIONAL conforme a su colegio.

> **Concordancia.** Esta cláusula debe decir lo mismo que la sección «Tu expediente es tuyo y de tu profesional» de los Términos y Condiciones (`src/app/terminos/page.js`) y que el modelo `Caso` del CRM. Si alguna de las tres cambia, las tres cambian.

## 11. Vigencia y modificaciones

> **Campo pendiente.** Fecha de vigencia: **[__ — PENDIENTE]**.

Toda modificación de tasas, secuencias, impuestos de referencia, costos de procesamiento, periodicidad o reglas de cancelación deberá comunicarse y documentarse por escrito, con aplicación **prospectiva** y sin alterar Liquidaciones ya cerradas.

**Versión del plan de comisiones aplicable: `patient-retention-2026-07`.**

Cada línea de Liquidación conserva la versión del plan con la que fue calculada, de modo que una Liquidación pasada siempre pueda recalcularse con las reglas que estaban vigentes cuando se emitió.

Queda **sin efecto** para nuevas contrataciones y liquidaciones el esquema de comisión progresiva por volumen mensual descrito en `ANEXO-ECONOMICO-LIQUIDACION-PROFESIONALES.md`, que se conserva únicamente como antecedente histórico.

## 12. Firmas — **PENDIENTES**

| Por la PLATAFORMA | Por el PROFESIONAL |
|---|---|
| Nombre: [__] | Nombre: [__] |
| Cargo: [__] | Identificación: [__] |
| Firma: [__] | Firma: [__] |
| Fecha: [__] | Fecha: [__] |

---

## Anexo técnico — trazabilidad con la implementación

Esta sección no forma parte del texto contractual. Sirve para auditar que documento y código coinciden.

| Regla del Anexo | Implementación |
|---|---|
| Base sin impuesto | `baseCentsFromGross()` en `src/lib/commission-plan.js` |
| Tasas de primera consulta | `FIRST_APPOINTMENT_PAYMENT_RATES` |
| Escala por secuencia | `COMMISSION_SEQUENCE_TIERS` |
| Secuencia que no se reinicia | `buildConsultationNumberMap()` |
| Fórmula completa de la línea | `calculateProfessionalSettlementItem()` |
| Costo real con estimación de respaldo | `transactionProcessingFeeCents()` en `src/actions/settlement-actions.js` |
| Versión guardada por línea | `SettlementItem.commissionPlanVersion` |
| Período quincenal 1-15 / 16-fin | `previousClosedSettlementPeriod()` en `src/lib/settlement-period.js` |
| Factura igual a la Liquidación | `submitProfessionalInvoice()` en `src/actions/professional-billing-actions.js` |

**Campo legado.** `ProfessionalProfile.commission` (valor por defecto `10`) **no participa del cálculo** y no lo altera. Es un residuo del esquema anterior de comisión fija por profesional. Ninguna liquidación lo lee. No debe usarse como referencia contractual ni interpretarse como una comisión pactada del 10%. Su eventual eliminación requiere una migración aprobada por separado.
