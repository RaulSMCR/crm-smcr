export const supplierId = "310123456";
export const supplierConsecutive = "00100001010000000001";
export const supplierClave = `506150726000${supplierId}${supplierConsecutive}112345678`;
export const supplierXml = `<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">
  <Clave>${supplierClave}</Clave><NumeroConsecutivo>${supplierConsecutive}</NumeroConsecutivo>
  <CodigoActividadEmisor>869001</CodigoActividadEmisor><FechaEmision>2026-07-15T23:30:00-06:00</FechaEmision>
  <Emisor><Nombre>Profesional de prueba &amp; asociados</Nombre><Identificacion><Tipo>01</Tipo><Numero>${supplierId}</Numero></Identificacion></Emisor>
  <DetalleServicio><LineaDetalle><NumeroLinea>1</NumeroLinea><CodigoCABYS>9999999999999</CodigoCABYS>
    <Cantidad>1.000</Cantidad><Detalle>Honorarios de prueba</Detalle><PrecioUnitario>10000.00000</PrecioUnitario>
    <MontoTotal>10000.00000</MontoTotal><SubTotal>10000.00000</SubTotal>
    <Impuesto><Codigo>01</Codigo><Tarifa>4.00</Tarifa><Monto>400.00000</Monto></Impuesto>
    <ImpuestoNeto>400.00000</ImpuestoNeto><MontoTotalLinea>10400.00000</MontoTotalLinea>
  </LineaDetalle></DetalleServicio>
  <ResumenFactura><CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1</TipoCambio></CodigoTipoMoneda>
    <TotalVenta>10000.00000</TotalVenta><TotalDescuentos>0</TotalDescuentos><TotalVentaNeta>10000.00000</TotalVentaNeta>
    <TotalImpuesto>400.00000</TotalImpuesto><TotalComprobante>10400.00000</TotalComprobante>
  </ResumenFactura>
</FacturaElectronica>`;
