# El receptor en la factura electrónica 4.4

Lo que sigue está tomado del XSD oficial de `FacturaElectronica` v4.4
(`https://www.hacienda.go.cr/docs/FacturaElectronica_V4.4.xsd.xml`), leído el
18 de septiembre de 2026. No viene de documentación de terceros: cada afirmación
corresponde a una declaración del esquema y se cita textualmente donde importa.

Hasta esa lectura, el generador seguía un único comprobante real aceptado
(`tmp/referencia-178.xml`), que era de un receptor costarricense. El camino de
receptor extranjero nunca se había ejercido, y ahí estaban los dos errores que
este documento corrige.

## El receptor es obligatorio, y su identificación también

En la secuencia raíz de `FacturaElectronica`:

```xml
<xs:element name="Receptor" type="ReceptorType"/>
```

Y dentro de `ReceptorType`:

```xml
<xs:element name="Nombre" nillable="false"/>        <!-- minLength 3, maxLength 100 -->
<xs:element name="Identificacion" type="IdentificacionType"/>
<xs:element name="NombreComercial"        minOccurs="0"/>
<xs:element name="Ubicacion"              minOccurs="0" type="UbicacionType"/>
<xs:element name="OtrasSenasExtranjero"   minOccurs="0"/>  <!-- 5..300 -->
<xs:element name="Telefono"               minOccurs="0" type="TelefonoType"/>
<xs:element name="CorreoElectronico"      minOccurs="0"/>
```

Ni `Receptor` ni `Identificacion` llevan `minOccurs="0"`: **los dos son
obligatorios**. Una factura sin receptor identificado no es una factura con un
campo de menos, es otro tipo de comprobante — el Tiquete Electrónico.

Por eso `generateFeXml` **falla antes de firmar** cuando falta el nombre o la
identificación, en vez de emitir el nodo condicionalmente. Un rechazo de Hacienda
consume el consecutivo igual que una aceptación: es preferible una factura que no
sale a un número quemado en un documento inválido.

## No existe un campo de país para el receptor

La única mención de país en todo `ReceptorType` está dentro de `Telefono`:

```xml
<xs:complexType name="TelefonoType">
  <xs:element name="CodigoPais"/>   <!-- entero, 3 dígitos -->
  <xs:element name="NumTelefono"/>
</xs:complexType>
```

Y `Telefono` es opcional. Las guías que piden «verificar que el código de país
refleje la nación de residencia del cliente y no Costa Rica» se refieren a ese
campo.

**El generador no emite `Telefono` para el receptor, a propósito.** Emitirlo con
el 506 por defecto para alguien que vive fuera declararía una residencia que no
es la suya. Mientras no se le pida el teléfono al paciente, el nodo no va.

Si alguna vez hace falta la dirección del cliente extranjero, el campo existe:
`OtrasSenasExtranjero`, texto libre de 5 a 300 caracteres.

## Tipos de identificación

`IdentificacionType` enumera seis, y `Numero` admite hasta 20 caracteres:

| Código | Significado | Formato | ¿Se infiere? |
|---|---|---|---|
| 01 | Cédula física | 9 dígitos | sí |
| 02 | Cédula jurídica | 10 dígitos, empieza en 3 | sí |
| 03 | DIMEX | 11 o 12 dígitos | sí |
| 04 | NITE | 10 dígitos | **no** |
| 05 | Extranjero no domiciliado | documento del país, letras y números | **no** |
| 06 | No contribuyente | — | **no** |

### El NITE no se infiere y no se inventa

Un NITE lo **asigna Hacienda** a quien, sin residir en el país, realiza
actividad que le genera obligaciones tributarias acá. Si la persona no tiene uno,
no hay NITE que poner.

Hasta el 18 de septiembre de 2026, `inferirTipoIdentificacion` terminaba en
`return NITE`: cualquier documento que no calzara con los tres formatos
costarricenses se declaraba como NITE por descarte. Así se clasificó como NITE la
identificación de una paciente extranjera, que además resultó ser un relleno de
diez unos. Eso declara ante Tributación un número que no existe en su registro.

Ahora la inferencia devuelve `null` y la emisión falla pidiendo el dato. El tipo
04, el 05 y el 06 hay que **declararlos**: no son deducibles de la forma del
número.

### Qué corresponde a un extranjero

- Residente con **DIMEX** → **03**.
- Tiene **NITE** asignado por Hacienda → **04**.
- Sin domicilio fiscal en Costa Rica, sin DIMEX ni NITE → **05**, con el
  documento de su país. **Pero el 05 no se admite en una Factura Electrónica**
  (ver Salvedades): a esa persona no se le puede emitir una factura de tipo 01.
- No lo da o no se sabe → **no se puede facturar**: hay que pedirlo.

El número del 05 conserva letras. `limpiarIdentificacion` las borraba, así que un
pasaporte `AB123456` viajaba como `123456`, que es otro documento. Para eso está
`normalizarIdentificacion(tipo, valor)`, que además **no trunca**: un
identificador fiscal recortado es otro número, y el largo lo rechaza la
validación con un mensaje, no el normalizador en silencio.

## Salvedades

- ~~El propio esquema documenta `Numero` como «el contribuyente debe estar
  inscrito ante la Administración Tributaria». Un extranjero no domiciliado, por
  definición, no lo está. […] si el 05 fuera rechazado en una factura ordinaria
  por servicios prestados en el país, el mensaje de rechazo lo dirá.~~

  **Lo dijo.** El 19 de octubre de 2026 la factura 0204, con receptor tipo 05,
  volvió rechazada con **-409 «Tipo de Identificación del Receptor no permitido
  para este documento»**, y el consecutivo se perdió. El 05 no se admite en una
  Factura Electrónica (01).

  **Desde el 20 de octubre de 2026 el CRM lo emite como Tiquete Electrónico
  (04)**, que es el comprobante que admite al receptor tipo 05 sin la
  restricción de la factura. La regla está en un solo lugar:
  `tipoComprobanteDe` en `src/lib/fe/config.js` decide el tipo de comprobante y
  `serieDeVentaSegunReceptor` en `src/lib/fiscal-identity.js` decide la serie.

  - **Serie propia, `TE/0001`, `TE/0002`…** Hacienda exige el consecutivo
    continuo por sucursal, terminal y **tipo de comprobante**; si los tiquetes
    tomaran números de la serie de facturas, las dos quedarían con huecos.
  - **`Invoice.invoiceType` sigue siendo `CUSTOMER_INVOICE`.** Es la misma
    venta con el mismo IVA, y los informes de ingresos, IVA y cuentas por cobrar
    filtran por ese campo. `TIQUETE_ELECTRONICO` existe en el enum solo como
    `InvoiceSequence.sequenceType`.
  - **El correo lo nombra como tiquete**, no como factura.

  Pendiente de verificar con el primer envío real: que la estructura que arma
  `generateFeXml` sea válida contra el XSD del **tiquete** 4.4. Hoy solo se
  comprueba la raíz, el namespace y el consecutivo; el esquema no está en el
  repositorio. Un rechazo quemaría `TE/0001`, pero en su propia serie.

  El **06** (no contribuyente) sigue permitido: no hay evidencia de que se
  rechace, y prohibirlo por sospecha bloquearía facturas quizá válidas.
- `CodigoActividadReceptor` existe como campo opcional de 6 caracteres, «en caso
  de ser requerido para un crédito o un gasto deducible». No se emite.

## Pendiente

**El XSD no está en el repositorio.** Hacienda responde 403 a la descarga
automatizada —igual que con el PDF de la política de firma—, así que hay que
guardarlo a mano desde un navegador en `docs/esquemas/FacturaElectronica_V4.4.xsd`.

Con el esquema versionado se puede validar el XML generado contra él en las
pruebas, antes de firmarlo y enviarlo. Hoy no se hace: cada rechazo de Hacienda
se ha descubierto enviando, y esa es la razón por la que los dos errores de
arriba sobrevivieron hasta que hubo que facturarle a una extranjera.
