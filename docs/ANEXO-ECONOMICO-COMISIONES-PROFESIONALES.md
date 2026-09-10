# ANEXO [__]
## Esquema económico, liquidación y pago de honorarios profesionales

**Versión del plan económico:** `patient-retention-2026-07`
**Fecha de vigencia:** [__ — PENDIENTE]

> **Estado de este documento.** Es la versión definitiva en cuanto a su contenido:
> las tasas, el hecho generador, las fórmulas y el tratamiento del costo de
> procesamiento están cerrados y coinciden con lo que el CRM ejecuta. Lo que queda
> abierto son **datos**, no reglas, y está listado en la cláusula 19.
>
> **Sustituye** a `ANEXO-ECONOMICO-LIQUIDACION-PROFESIONALES.md` (escala por volumen
> mensual, nunca implementada), a `ANEXO-ECONOMICO-LIQUIDACION-PROFESIONALES-PROPUESTO.md`
> y a `ANEXO-CONTRACTUAL-COMISIONES-PROFESIONALES.md`, que se conservan únicamente
> como antecedente de la negociación.
>
> **Alineación técnica.** El cálculo corresponde exactamente al plan implementado en
> `src/lib/commission-plan.js` bajo la versión `patient-retention-2026-07`, y
> `tests/unit/anexo-economico.test.js` lo ancla cláusula por cláusula. Cualquier
> cambio de tasas o fórmulas se hace en los dos lugares a la vez y con una versión
> de plan nueva.
>
> **No es asesoría legal ni tributaria.** Requiere revisión de la asesoría jurídica
> y contable de las PARTES antes de la firma.

Entre **[RAZÓN SOCIAL — PENDIENTE]**, cédula jurídica número **[__ — PENDIENTE]**,
representada en este acto por **[NOMBRE DEL REPRESENTANTE]**, mayor,
[estado civil], [profesión u oficio], vecino/a de [__], portador/a de la cédula
número [__], en su condición de [__], en adelante la **PLATAFORMA** o
**SaludMentalCR**; y **[NOMBRE COMPLETO DEL PROFESIONAL]**, [tipo de
identificación] número **[__]**, [profesión], colegiado/a número **[__]** del
**[colegio profesional]**, vecino/a de **[__]**, en adelante el **PROFESIONAL**;
conjuntamente las **PARTES**, se acuerda el presente Anexo al Contrato de
Prestación de Servicios Profesionales celebrado el **[fecha del contrato
principal]**, conforme a las cláusulas siguientes.

---

## 1. Objeto, integración y prelación

1.1. Este Anexo forma parte integral del contrato principal y regula exclusivamente
el esquema económico aplicable a los servicios del PROFESIONAL, la liquidación de
los montos que le corresponden y la factura que emitirá a la PLATAFORMA.

1.2. La PLATAFORMA presta servicios tecnológicos, administrativos y de
intermediación operativa: publicación de servicios, captación y gestión de
pacientes, reserva de citas, procesamiento de pagos, comunicación operativa y
emisión de liquidaciones.

1.3. Este Anexo no crea relación laboral, salario, jornada, subordinación,
exclusividad ni garantía de volumen mínimo de pacientes o de ingresos.

1.4. **Prelación.** Prevalece el contrato principal en cuanto a la naturaleza de la
relación jurídica, confidencialidad, protección de datos, responsabilidad,
terminación y solución de controversias. Prevalece **este Anexo** en todo lo
relativo a comisión, costo de procesamiento, secuencia de consultas, liquidación,
monto facturable y pago. Frente a cualquier comunicación informal sobre comisiones,
prevalece este Anexo.

1.5. **El campo «Precio» del Anexo A del contrato principal.** Ese campo prevé un
monto fijo por disciplina, incompatible con una comisión variable por secuencia de
consultas. Al firmar debe consignarse allí la remisión: *«Según el Anexo [__] —
Esquema económico, liquidación y pago de honorarios profesionales, versión
`patient-retention-2026-07`»*, o sustituirse íntegramente ese campo por el presente
Anexo. En caso de contradicción, prevalece este Anexo.

1.6. **Costos por cuenta del PROFESIONAL.** La cláusula 4.2 del contrato principal
establece que todo gasto, costo, impuesto, carga o tasa aplicable a los Servicios
corre por cuenta exclusiva del PROFESIONAL y no aumenta el precio. Esa cláusula es
el fundamento contractual del traslado del Costo de procesamiento previsto en la
cláusula 8.

1.7. **Dirección de la facturación.** El PROFESIONAL factura **a la PLATAFORMA, no
al Paciente**. La relación de cobro con el Paciente la mantiene la PLATAFORMA, que
le factura el precio publicado.

1.8. **Terminología.** En el contrato principal el PROFESIONAL aparece como
«Proveedor» en el encabezado y como «Profesional» en el articulado. Al firmar debe
unificarse el término en ambos documentos. En este Anexo, PLATAFORMA y
SaludMentalCR designan a la misma parte, y PROFESIONAL y Proveedor a la otra.

---

## 2. Definiciones

| Término | Definición |
|---|---|
| **Paciente** | Persona usuaria que reserva o recibe un servicio del PROFESIONAL mediante la PLATAFORMA. |
| **Relación Paciente–PROFESIONAL** | Vínculo individual entre un Paciente y el PROFESIONAL. Cada relación mantiene su propia Secuencia de consultas. |
| **Consulta efectiva** | Consulta prestada, cobrada, conciliada y no objeto de reembolso, reversión, contracargo o ajuste pendiente. |
| **Cargo por cancelación tardía** | Cargo del 50% del valor de la cita que la política publicada aplica al Paciente que cancela o reprograma con menos de 24 horas, o no asiste. |
| **Cobro liquidable** | Todo pago del Paciente aprobado, conciliado y no reversado, realizado por un enlace de pago del PROFESIONAL. Comprende las Consultas efectivas **y** los Cargos por cancelación tardía. Es el hecho que genera Comisión de plataforma y hace avanzar la Secuencia. |
| **Secuencia de consultas** | Numeración cronológica y acumulativa de los Cobros liquidables de una misma Relación Paciente–PROFESIONAL. Determina la tasa aplicable. **No se reinicia** por cambio de servicio, cambio de precio ni cierre de período. |
| **Adelanto** | Pago del 50% del precio de la primera consulta, realizado para reservarla. Es un pago a cuenta: no se liquida por separado del saldo. |
| **Monto bruto cobrado** | Total cobrado al Paciente, incluidos los impuestos indirectos que correspondan. |
| **Base sin impuesto** | `Monto bruto cobrado / (1 + tasa de impuesto aplicable)`. Con tarifa del 4%: `Monto bruto / 1,04`. Es la base de cálculo de la Comisión de plataforma. |
| **Comisión de plataforma** | Retribución de la PLATAFORMA por tecnología, captación, operación, administración, soporte y servicios conexos, calculada sobre la Base sin impuesto según la Secuencia de consultas. |
| **Costo de procesamiento** | Cargo aplicado por el procesador de pagos por cada transacción: tarifa porcentual, cargos fijos, conversión de moneda y demás componentes del medio de pago utilizado. **No es Comisión de plataforma** y no puede presentarse ni denominarse como tal. |
| **Costo de procesamiento trasladable** | Porción del Costo de procesamiento que, conforme a la cláusula 8, se deduce del monto del PROFESIONAL. No coincide con el Costo de procesamiento cuando opera la cláusula 8.4. |
| **Neto profesional antes de impuesto propio** | Base sin impuesto − Comisión de plataforma − Costo de procesamiento trasladable. |
| **Monto de factura profesional** | Neto profesional antes de impuesto propio + el impuesto que corresponda a la factura del PROFESIONAL. Es el monto exacto que debe facturarse a la PLATAFORMA. |
| **Liquidación** | Estado de cuenta emitido por el CRM que detalla los cobros, impuestos, comisiones, costos de procesamiento, ajustes y monto facturable de un Período. |
| **Período de liquidación** | Del día 1 al 15 y del día 16 al último día natural de cada mes, hora de Costa Rica. |

---

## 3. Principios rectores

Dos principios gobiernan la interpretación de todo este Anexo y prevalecen sobre
cualquier cláusula que se les oponga.

3.1. **Justicia con el PROFESIONAL.** Todo cobro que el Paciente pague por un enlace
del PROFESIONAL le genera a este su parte. Ninguna deducción se le aplica sin estar
expresamente pactada aquí, y ningún defecto de implementación puede convertirse en
un ingreso para la PLATAFORMA a costa suya. Ante una duda de cálculo que este Anexo
no resuelva con claridad, se resuelve **a favor del PROFESIONAL**.

3.2. **Corrección ante la Administración Tributaria.** Cada cobro se declara por lo
que realmente es: con el código CABYS que corresponde a lo efectivamente prestado y
con la tarifa de impuesto que la ley le asigna. Ninguna conveniencia operativa
justifica declarar un servicio que no se prestó, aplicar una tarifa reducida donde
no procede, ni presentar un concepto bajo el nombre de otro.

3.3. Cuando ambos principios parezcan entrar en tensión, la corrección tributaria
fija **qué** se declara y **cómo**; la justicia con el PROFESIONAL fija **cuánto le
corresponde** de lo declarado. No son alternativos: se cumplen los dos.

3.4. **Reglas derivadas.**

1. La Comisión se calcula sobre la Base sin impuesto, nunca sobre el impuesto
   indirecto cobrado al Paciente.
2. El impuesto cobrado al Paciente no constituye ingreso propio de la PLATAFORMA.
3. El Costo de procesamiento se mantiene separado de la Comisión de plataforma en
   el cálculo, en la Liquidación y en la contabilidad.
4. La Secuencia se conserva entre períodos. El cierre quincenal no la reinicia.
5. Ninguna tasa de este Anexo se interpretará como renuncia a impuestos,
   retenciones, cargos del procesador o deberes formales exigibles por ley.

---

## 4. Hecho generador y Secuencia de consultas

4.1. **Lo que genera comisión es el pago, no la prestación.** Todo cobro que el
Paciente pague por un enlace de pago del PROFESIONAL genera Comisión de plataforma y
le genera al PROFESIONAL la parte que le corresponde.

4.2. **Lo que consume una posición.** Una posición de la Secuencia se consume cuando
el Paciente pagó el cobro correspondiente y el pago fue aprobado y conciliado,
aunque la consulta no se haya prestado.

4.3. **Una cita que nadie pagó no consume posición.** Su número queda disponible
para la siguiente cita de la relación. Que el PROFESIONAL haya marcado la cita como
realizada no basta por sí solo: en el flujo del CRM esa marca precede al envío del
enlace de cobro del saldo, de modo que toda consulta atraviesa un estado de
«realizada y sin pagar» que por sí mismo no devenga nada.

4.4. **El adelanto y el saldo comparten posición.** Son dos pagos de la misma
consulta y no la hacen avanzar dos veces. Si se numerara por transacción y no por
cita, el saldo pasaría a ser la consulta 2 y se cobraría 35% donde corresponde 40%.

4.5. **La numeración se fija al liquidar y no se recalcula hacia atrás.** Una
Liquidación cerrada nunca se renumera. Un pago que llegue después de cerrado el
Período toma la siguiente posición libre al momento de liquidarse, y la Liquidación
dejará constancia de esa circunstancia.

4.6. Un cobro reembolsado, reversado o con contracargo no devenga Comisión de
plataforma y se trata conforme a la cláusula 14.

4.7. La PLATAFORMA conservará por cada línea de Liquidación el número de consulta
utilizado, la tasa aplicada y la versión del plan económico con la que se calculó.

---

## 5. Escala de Comisión de plataforma

La Comisión se calcula sobre la Base sin impuesto de cada Cobro liquidable, según la
posición que ocupe en la Secuencia de la Relación Paciente–PROFESIONAL:

| Posición en la Secuencia | Comisión de plataforma |
|---:|---:|
| **Primera consulta** | Ver cláusula 5.1 — tasa efectiva **45%** |
| Segunda consulta | **35%** |
| Tercera consulta | **30%** |
| Cuarta consulta | **25%** |
| Quinta a octava consulta | **20%** |
| Novena a vigésima octava consulta | **15%** |
| **Vigésima novena consulta en adelante** | **10%** |

5.1. **Primera consulta: adelanto y saldo.** La primera consulta se cobra en dos
pagos y cada pago tiene su propia tasa, aplicada sobre la Base sin impuesto de ese
pago:

| Tipo de pago | Tasa sobre la base de ese pago |
|---|---:|
| Adelanto del 50% | **50%** |
| Saldo del 50% | **40%** |
| Pago único del 100% | **45%** |

```text
Comisión de la primera consulta = (Base del adelanto × 50%) + (Base del saldo × 40%)
```

Cuando el adelanto y el saldo son iguales, la comisión efectiva equivale al **45%**
de la Base sin impuesto de la consulta, idéntica a la del pago único.

5.2. Estas tres tasas aplican **únicamente a la primera consulta** de la relación. A
partir de la segunda rige la tasa de la Secuencia, con independencia de cómo se haya
fraccionado el cobro.

5.3. **La tasa del 10% no tiene fecha de término.** Constituye el nivel de fidelidad
y continuidad, y rige mientras el Paciente permanezca activo con ese PROFESIONAL. No
se reducirá a una tasa meramente equivalente a impuestos o procesamiento, pues la
PLATAFORMA continúa prestando servicios tecnológicos, administrativos y de soporte.

5.4. **Ejemplo.** Con un precio bruto de ₡40.000 e impuesto del 4%, la Base sin
impuesto es `₡40.000 / 1,04 = ₡38.461,54`. Sin considerar el Costo de procesamiento:

| Consulta | Tasa | Comisión | Neto antes de impuesto propio |
|---:|---:|---:|---:|
| Primera | 45% | ₡17.307,69 | ₡21.153,85 |
| Segunda | 35% | ₡13.461,54 | ₡25.000,00 |
| Tercera | 30% | ₡11.538,46 | ₡26.923,08 |
| Cuarta | 25% | ₡9.615,38 | ₡28.846,16 |
| Quinta a octava | 20% | ₡7.692,31 | ₡30.769,23 |
| Novena a vigésima octava | 15% | ₡5.769,23 | ₡32.692,31 |
| Vigésima novena en adelante | 10% | ₡3.846,15 | ₡34.615,39 |

---

## 6. Reserva, cancelación y reprogramación

6.1. **Reserva.** Para reservar la primera consulta, el Paciente abona un Adelanto
equivalente al 50% del precio publicado. El saldo se cobra conforme al flujo
operativo de la PLATAFORMA.

6.2. **Política aplicable.** Rigen las reglas de agendamiento y cancelación
publicadas en los Términos y Condiciones y aceptadas por el Paciente al registrarse,
que las PARTES declaran conocer. Sus reglas vigentes son:

| Supuesto | Consecuencia para el Paciente |
|---|---|
| Cancelar o reprogramar con **24 horas o más** de anticipación | Sin cargo. No requiere justificación. |
| Cancelar o reprogramar con **menos de 24 horas** | Se cobra el **50% del valor de la cita**. |
| **Inasistencia** sin aviso | Se cobra el **50% del valor de la cita**. |

Cuando el Paciente ya había pagado el Adelanto del 50%, ese monto cubre íntegramente
el cargo y no se le cobra nada adicional: el Cargo por cancelación tardía y el
Adelanto son la misma proporción del precio.

6.3. **Cancelación con al menos 24 horas.** Se devuelve el monto pagado, sujeto
únicamente a los costos de procesamiento efectivamente no recuperables y previamente
informados; no se devenga Comisión de plataforma; el impuesto indirecto se reversa o
ajusta conforme al comprobante aplicable; y la posición en la Secuencia no se
consume.

6.4. **Pausa de agenda.** En los supuestos de cancelación tardía e inasistencia, la
agenda del Paciente queda en pausa: no puede reservar ni mover citas por su cuenta
hasta que un administrador lo restablezca, después de contactarlo.

6.5. **Concordancia.** Estas reglas están implementadas en
`src/lib/rescheduling-policy.js` (`HORAS_MINIMAS_REAGENDA = 24`,
`PORCENTAJE_MULTA = 50`). Cualquier cambio debe hacerse simultáneamente en los
Términos y Condiciones, en este Anexo y en el código.

---

## 7. Tratamiento del Cargo por cancelación tardía

7.1. **El Cargo se liquida como cualquier otro cobro.** El PROFESIONAL percibe la
parte que le corresponde, porque el horario reservado quedó apartado para ese
Paciente y no pudo ofrecerse a otro.

7.2. En consecuencia:

1. el Cargo se incluye en la Liquidación del Período en que se cobró;
2. la Comisión se calcula con **la tasa que correspondía a esa consulta según su
   posición en la Secuencia** — si la cita cancelada era la tercera de la relación,
   la tasa es 30%;
3. la Base sin impuesto, el Costo de procesamiento trasladable y el Monto de factura
   profesional se determinan con las fórmulas de la cláusula 9; y
4. el Cargo **consume la posición** que ocupaba en la Secuencia, conforme a la
   cláusula 4.2.

7.3. **Al Cargo no se le aplican las tasas desdobladas de la primera consulta.** El
desdoble 50/40 existe porque el precio de la primera consulta se cobra en dos
tractos; el Cargo es un cobro único, así que si se cancela tarde la primera cita la
tasa es **45%**, la misma del pago único.

7.4. Si el Paciente **no paga** el Cargo, la posición no se consume y queda
disponible para la siguiente cita de la relación.

7.5. El Cargo nunca excede el 50% del valor de la cita fijado por la política
publicada.

7.6. **Tratamiento tributario.** El Cargo se factura como el cobro de la consulta
reservada: con el mismo código CABYS del servicio agendado y la misma tarifa de
impuesto, y se declara como un cobro percibido. El fundamento es que lo que el
Paciente contrató y la PLATAFORMA reservó fue la consulta, y el Cargo es la
contraprestación pactada por ese horario apartado. En la factura el concepto se
identifica con rótulo propio —«Cargo por cancelación tardía»—, porque el comprobante
debe decir qué se cobró de verdad; lo que no cambia es el CABYS ni la tarifa.

> **Revisión pendiente.** Se hizo notar que una penalización por incumplimiento
> podría, según criterio tributario, no ser hecho generador del impuesto o no
> corresponderle la tarifa reducida de servicios de salud. La decisión de tratarla
> como el cobro del servicio contratado fue tomada expresamente por la PLATAFORMA y
> **debe validarse con la asesoría contable antes del primer cobro real**, junto con
> el tipo de comprobante que corresponde emitir. Queda constando por transparencia y
> no altera lo dispuesto en la cláusula 7.6.

---

## 8. Costo de procesamiento

8.1. **Determinación.** El Costo de procesamiento se determina conforme al cargo del
procesador de pagos por cada transacción. Su estructura **no es un porcentaje
simple**: combina un porcentaje sobre el monto cobrado con un **cargo fijo por
transacción denominado en dólares**, que debe convertirse a colones con el tipo de
cambio aplicado. La Liquidación registrará el monto en dólares y el tipo de cambio
utilizado, de modo que la diferencia contra la liquidación del procesador sea
explicable.

> **Campo pendiente.** Las tarifas por medio de pago deben incorporarse expresamente
> antes de la firma. La vigente para tarjeta es **3,50% + US$0,35** por transacción.
> Quedan por confirmar con el procesador: `[porcentaje y fijo para SINPE]` y
> `[porcentaje y fijo para SINPE Móvil]`.

8.2. **Traslado al PROFESIONAL.** El Costo de procesamiento trasladable se deduce
del monto del PROFESIONAL. La deducción es expresa, se aplica en cada Liquidación y
se identifica por separado, con el monto y el medio de pago que lo originó. Su
fundamento es la cláusula 1.6.

8.3. **Prohibición de rotularlo como comisión.** La PLATAFORMA no podrá presentar
como Comisión de plataforma un costo que corresponda al procesador, ni denominar
«comisión» al Costo de procesamiento en liquidaciones, reportes o comprobantes.

8.4. **El cargo fijo no se traslada dos veces.** Cuando el adelanto y el saldo de la
primera consulta se procesan como dos transacciones independientes, el cargo fijo
por transacción se duplica. **Ese segundo cargo fijo lo asume la PLATAFORMA y no se
traslada al PROFESIONAL**: fraccionar el cobro es una medida de la PLATAFORMA para
asegurar la reserva y protegerlo frente a una cita que no se concreta, y quien no
tomó esa decisión no debe pagar su costo. La Liquidación identificará el cargo fijo
asumido por la PLATAFORMA cuando sea aplicable.

8.5. El **porcentaje** del procesador sí se traslada íntegro en ambos tramos, porque
es proporcional al dinero efectivamente movido y no se duplica: dos mitades generan
el mismo porcentaje que un cobro entero.

8.6. **Estimación y ajuste.** La Liquidación indicará si el Costo de procesamiento
mostrado es el cargo real del procesador o una estimación del CRM. Mientras no
exista conciliación automática con la liquidación del procesador, la cifra es una
**estimación** calculada con la tarifa vigente y el tipo de cambio del día. Si
después se determina una diferencia, se reflejará como ajuste en una Liquidación
posterior, con identificación de su causa y monto. La estimación no sustituye al
costo efectivamente documentado por el procesador cuando este esté disponible.

---

## 9. Fórmula de liquidación

Para cada Cobro liquidable:

```text
Base sin impuesto = Monto bruto cobrado / (1 + tasa de impuesto aplicable)

Comisión de plataforma = Base sin impuesto × tasa de la Secuencia

Neto profesional antes de impuesto propio =
    Base sin impuesto
  − Comisión de plataforma
  − Costo de procesamiento trasladable

Monto de factura profesional =
    Neto profesional antes de impuesto propio
  + impuesto que corresponda a la factura del PROFESIONAL
```

9.1. El redondeo se realiza a dos decimales de colón costarricense. El cálculo
interno se efectúa en céntimos enteros para evitar arrastre de error.

9.2. El Neto profesional antes de impuesto propio no podrá ser inferior a cero. Si
la Comisión y el Costo de procesamiento agotaran la Base sin impuesto de una línea,
la diferencia la absorbe la PLATAFORMA y nunca se traslada como saldo en contra del
PROFESIONAL, ni en esa Liquidación ni en las siguientes.

---

## 10. Períodos y contenido de la Liquidación

10.1. Los Períodos de liquidación son del día **1 al 15** y del día **16 al último
día natural** de cada mes, hora de Costa Rica. El CRM genera la Liquidación del
período cerrado el día 16 y el día 1 del mes siguiente, respectivamente.

10.2. La Liquidación se pone a disposición del PROFESIONAL en el CRM y muestra, como
mínimo:

1. período liquidado;
2. fecha de cada consulta;
3. identificador del Paciente o de la transacción permitido por la normativa de
   protección de datos;
4. número de consulta dentro de la Secuencia;
5. monto bruto cobrado;
6. impuesto indirecto cobrado al Paciente, por separado;
7. Base sin impuesto;
8. tasa y monto de la Comisión de plataforma;
9. Costo de procesamiento trasladable, indicando si es real o estimado y el medio de
   pago que lo originó;
10. cargo fijo asumido por la PLATAFORMA, cuando aplique (cláusula 8.4);
11. reembolsos, contracargos, reversos y ajustes;
12. Neto profesional antes de impuesto propio;
13. Monto de factura profesional; y
14. la versión del plan económico aplicada a cada línea.

10.3. La Liquidación no constituye por sí misma una factura ni un anticipo. Solo
incluye Cobros liquidables conforme a la cláusula 4.

---

## 11. Facturación del PROFESIONAL a la PLATAFORMA

11.1. El PROFESIONAL emitirá a la PLATAFORMA una factura electrónica válida por el
**monto exacto** indicado en la Liquidación.

11.2. **Coincidencia exacta.** Cuando exista una Liquidación vinculada, el CRM
rechaza la presentación de una factura por un monto distinto. El PROFESIONAL no
podrá facturar de más ni de menos contra una Liquidación. Si considera que el monto
es incorrecto, debe objetarlo por el procedimiento de la cláusula 12 en lugar de
facturar una cifra diferente.

11.3. La factura incluirá el impuesto que corresponda conforme a la situación
tributaria del PROFESIONAL y a la normativa aplicable. La configuración vigente del
CRM aplica al desglose la misma tarifa con la que se calculó la Liquidación, que
para servicios de salud es del **4%**.

11.4. La factura debe presentarse con la información y documentación necesarias para
su validación, incluyendo cuando corresponda: número de identificación del emisor;
clave numérica de 50 dígitos; XML firmado; comprobante PDF de respaldo; y la
respuesta o comprobante de aceptación exigido por el sistema fiscal aplicable.

11.5. La clave, la identificación del emisor y el XML deben corresponder al
PROFESIONAL que presenta la factura. La PLATAFORMA podrá rechazar o devolver para
corrección una factura incompleta, inválida o que no coincida con la Liquidación. La
aceptación de una factura no implica renuncia a revisar errores, duplicidades o
pagos reversados detectados después.

---

## 12. Objeciones

12.1. El PROFESIONAL podrá objetar una Liquidación dentro de los **cinco (5) días
hábiles** siguientes a su puesta a disposición en el CRM.

12.2. La objeción se presenta **por el CRM, con acuse de recibo**, identificando las
transacciones cuestionadas y explicando el motivo.

12.3. La PLATAFORMA revisará la objeción dentro de un plazo razonable y comunicará
la decisión o el ajuste correspondiente.

12.4. La parte no controvertida de una Liquidación podrá facturarse y pagarse sin
esperar la resolución de la parte controvertida.

---

## 13. Pago

13.1. El pago se tramita una vez que concurran: Liquidación disponible; factura
electrónica válida y coincidente; validación administrativa, fiscal y documental; y
ausencia de reversos, contracargos o controversias pendientes sobre el monto
pagadero.

13.2. El plazo ordinario de pago es de **cinco (5) días hábiles** contados desde la
validación de la Liquidación y la recepción de la factura válida, sujeto a los
controles operativos, bancarios, antifraude y de conciliación aplicables.

> **Concordancia obligatoria.** Este plazo y el de la cláusula 4.3 del contrato
> principal deben ser **el mismo número de días**. Al firmar debe consignarse
> «cinco (5) días hábiles» también allí.

13.3. El pago se realiza mediante transferencia electrónica a la cuenta IBAN
registrada por el PROFESIONAL, que es la indicada en el Anexo A del contrato
principal. Cualquier cambio de cuenta debe comunicarse por el canal seguro que
determine la PLATAFORMA.

13.4. El registro del pago en el CRM constituye constancia operativa de la orden o
confirmación, sin perjuicio del comprobante bancario correspondiente.

---

## 14. Reembolsos, reversos y ajustes posteriores

14.1. Si un pago incluido en una Liquidación es reembolsado, desconocido, revertido,
objeto de contracargo o afectado por un error de conciliación, la PLATAFORMA podrá:

1. excluirlo de la Liquidación si aún no fue facturado;
2. compensarlo en la Liquidación siguiente; o
3. solicitar la nota de crédito, reintegro u otro comprobante que corresponda, si ya
   fue facturado o pagado.

14.2. Todo ajuste indicará causa, fecha, monto, transacción afectada e impacto en la
Comisión de plataforma, el Costo de procesamiento y los impuestos, y quedará
identificado como ajuste en el CRM.

14.3. **Las Liquidaciones cerradas no se modifican silenciosamente.** Cualquier
corrección posterior se registra como ajuste, nunca alterando la Liquidación
original.

---

## 15. Obligaciones tributarias y profesionales

15.1. El PROFESIONAL es responsable de su inscripción tributaria, obligaciones
profesionales, declaraciones, comprobantes electrónicos, cargas sociales, seguros,
permisos y demás obligaciones que le correspondan como proveedor independiente.

15.2. La PLATAFORMA podrá solicitar razonablemente la información y documentación
necesaria para validar el gasto, la trazabilidad de la operación y el tratamiento
fiscal de la factura profesional.

15.3. La PLATAFORMA podrá retener, compensar o reportar los montos que resulte
obligada a aplicar por ley, resolución administrativa o requerimiento de autoridad
competente. Todo tratamiento de impuestos, retenciones y créditos fiscales se sujeta
a la legislación costarricense vigente y a la revisión de la asesoría contable de
las PARTES.

---

## 16. Información, auditoría y protección de datos

16.1. La PLATAFORMA conservará los registros operativos necesarios para verificar
citas, pagos, impuestos, comisiones, costos de procesamiento, secuencias,
liquidaciones, facturas y ajustes.

16.2. Las PARTES tratarán la información personal, financiera y fiscal conforme a la
normativa aplicable, y utilizarán los canales habilitados para el intercambio de
documentos sensibles. La información de Pacientes se utilizará únicamente para la
prestación, administración, seguridad, facturación, soporte y cumplimiento de
obligaciones relacionadas con los servicios.

### 16.3 Expediente clínico: pertenencia y custodia

**El expediente clínico pertenece al Paciente y al PROFESIONAL tratante. La
PLATAFORMA no lo tiene, no lo lee y no lo guarda.**

El secreto profesional y la custodia del expediente son obligación **exclusiva del
PROFESIONAL**, conforme al Código de Ética y demás normativa de su colegio
profesional. La PLATAFORMA no asume esa custodia, no la comparte y no puede
responder por ella. Nada en este Anexo, en el contrato principal ni en la operación
del CRM debe interpretarse como que la PLATAFORMA custodia, accede o conserva
contenido clínico.

El Paciente puede solicitar copia de su expediente en cualquier momento conforme a
la Ley N.º 8239; esa solicitud se dirige al PROFESIONAL, que es quien puede
atenderla.

### 16.4 Registro administrativo del proceso

Lo que sí administra la PLATAFORMA es un **registro operativo sin contenido
clínico**, limitado a: la apertura del proceso y su fecha; el cierre y su fecha; la
categoría del cierre —alta o baja, con su tipo—; el destino de la derivación cuando
corresponda, sin las indicaciones; y las atestaciones del PROFESIONAL de que informó
a la persona y dejó constancia en su expediente.

**Ese registro no forma parte del expediente clínico ni lo sustituye.** No contiene
lo tratado en consulta.

La apertura, el alta y la baja se trabajan en equipo con fines de supervisión, y el
cierre del registro es visado por la Dirección Clínica antes de quedar firme. Es un
control interno de calidad documental que protege a ambas partes: **no es una
revisión del tratamiento y no otorga acceso al expediente clínico.**

La conservación de ese registro administrativo por diez (10) años es una decisión de
la PLATAFORMA para respaldo contable y de auditoría, y **no equivale ni sustituye**
al plazo de conservación del expediente clínico que corresponde al PROFESIONAL.

> **Concordancia.** Esta cláusula debe decir lo mismo que la sección «Tu expediente
> es tuyo y de tu profesional» de los Términos y Condiciones
> (`src/app/terminos/page.js`), que la cláusula de secreto profesional del contrato
> principal y que el modelo `Caso` del CRM. Si una cambia, cambian las cuatro.

---

## 17. Vigencia, versión y modificaciones

17.1. Este Anexo rige a partir del **[fecha de vigencia — PENDIENTE]** y se aplica a
los Cobros liquidables comprendidos en Períodos posteriores a esa fecha, salvo que
las PARTES acuerden expresamente otra regla de transición.

17.2. La versión económica de referencia es **`patient-retention-2026-07`**. Cada
línea de Liquidación conserva la versión con la que fue calculada, de modo que una
Liquidación pasada siempre pueda recalcularse con las reglas vigentes cuando se
emitió.

17.3. Ninguna modificación de tasas, secuencias, períodos, tratamiento del Costo de
procesamiento, reglas de cancelación o fórmula de liquidación será aplicable sin
documentarse por escrito y comunicarse al PROFESIONAL **con anterioridad a su
entrada en vigor**. Toda modificación aplica de forma **prospectiva**.

17.4. Queda sin efecto para nuevas contrataciones y liquidaciones el esquema de
comisión progresiva por volumen mensual descrito en
`ANEXO-ECONOMICO-LIQUIDACION-PROFESIONALES.md`, que se conserva únicamente como
antecedente histórico.

---

## 18. Firma de las PARTES

En señal de aceptación, las PARTES firman este Anexo en dos ejemplares de igual
valor, en **[lugar]**, a los **[__] días del mes de [__] de [____]**.

| Por la PLATAFORMA | Por el PROFESIONAL |
|---|---|
| Nombre: [____________________________] | Nombre: [____________________________] |
| Identificación: [____________________] | Identificación: [____________________] |
| Cargo: [_____________________________] | Colegio/matrícula: [_________________] |
| Firma: _______________________________ | Firma: _______________________________ |
| Fecha: [_____________________________] | Fecha: [_____________________________] |

---

## 19. Campos que deben completarse antes de la firma

| # | Campo | Dónde |
|---|---|---|
| 1 | Número de este Anexo | encabezado y cláusula 1.5 |
| 2 | Razón social, cédula jurídica y datos del representante legal | comparecencia |
| 3 | Datos completos del PROFESIONAL, incluido colegio y número de colegiado | comparecencia |
| 4 | Fecha del contrato principal | comparecencia |
| 5 | Fecha de vigencia | cláusula 17.1 |
| 6 | Tarifas de SINPE y SINPE Móvil del procesador | cláusula 8.1 |
| 7 | Lugar y fecha de firma | cláusula 18 |

**Además, fuera de este documento:** consignar «cinco (5) días hábiles» en la
cláusula 4.3 del contrato principal (cláusula 13.2), completar la cuenta IBAN del
Anexo A (cláusula 13.3) y validar con la asesoría contable el tratamiento tributario
del Cargo por cancelación tardía (cláusula 7.6).

---

## Anexo técnico — trazabilidad con la implementación

*Esta sección no forma parte del texto contractual. Sirve para auditar que documento
y código dicen lo mismo.*

| Regla | Implementación |
|---|---|
| Base sin impuesto (cl. 9) | `baseCentsFromGross()` en `src/lib/commission-plan.js` |
| Tasas de primera consulta (cl. 5.1) | `FIRST_APPOINTMENT_PAYMENT_RATES` |
| Escala por secuencia (cl. 5) | `COMMISSION_SEQUENCE_TIERS` |
| Tasa del Cargo por cancelación (cl. 7.2 y 7.3) | `commissionRateForPayment()`, rama `PENALTY_50` |
| Secuencia que no se reinicia (cl. 4) | `buildConsultationNumberMap()` |
| Solo un cobro consume posición (cl. 4.2 y 4.3) | consulta `chargedAppointments` en `src/actions/settlement-actions.js` |
| Adelanto y saldo comparten posición (cl. 4.4) | numeración por cita en `buildConsultationNumberMap()` |
| Liquidación cerrada no se renumera (cl. 4.5) | `numerosAsignados` en `generateSettlementPeriod()` |
| Fórmula completa de la línea (cl. 9) | `calculateProfessionalSettlementItem()` |
| Neto nunca negativo (cl. 9.2) | `Math.max(0, …)` en `calculateProfessionalSettlementItem()` |
| Fijo no trasladado dos veces (cl. 8.4) | `transactionProcessingFeeCents()` |
| Período quincenal (cl. 10.1) | `previousClosedSettlementPeriod()` en `src/lib/settlement-period.js` |
| Factura igual a la Liquidación (cl. 11.2) | `submitProfessionalInvoice()` en `src/actions/professional-billing-actions.js` |
| Versión guardada por línea (cl. 17.2) | `SettlementItem.commissionPlanVersion` |
| Rótulo propio del Cargo, mismo CABYS (cl. 7.6) | `detalleLineaFactura()` en `src/lib/detalle-consulta.js` |

### Lo que este Anexo promete y el CRM todavía no cumple

Debe construirse antes de firmar con el primer profesional, o el documento describe
algo que no existe:

| Cláusula | Falta |
|---|---|
| 8.2 y 10.2.9 | El medio de pago no se guarda en `PaymentTransaction`, así que no puede identificarse en la Liquidación; `transactionProcessingFeeCents()` asume tarjeta. |
| 8.6 y 10.2.9 | Hoy **todo** Costo de procesamiento es estimación: no hay ingesta de la liquidación real del procesador, y la Liquidación no distingue real de estimado. |
| 8.4 y 10.2.10 | El cargo fijo asumido por la PLATAFORMA no se persiste, así que la Liquidación no puede mostrarlo. |
| 10.2 | La vista del profesional no muestra impuesto separado, base sin impuesto, costo por línea, neto antes de impuesto propio ni versión del plan, aunque la página ya recibe esos datos. |
| 12.2 | El canal de objeción por CRM con acuse no existe todavía. |
| 14.1 | No hay implementación de reembolsos ni contracargos: nada escribe `PaymentTransactionStatus.REFUNDED` y no existe vía de compensación. |

**Campo legado.** `ProfessionalProfile.commission` (valor por defecto `10`) **no
participa del cálculo**. Es un residuo del esquema anterior de comisión fija por
profesional. Ninguna liquidación lo lee. No debe usarse como referencia contractual
ni interpretarse como una comisión pactada del 10%.
