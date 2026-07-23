# Flujo de carruseles

## Flujo principal Modo A

```text
Artículo en CRM
  → exportación del paquete
  → trabajo manual en ChatGPT
  → carousel.json + assets
  → importación
  → validación y diferencias
  → confirmación
  → nueva versión
  → revisión slide por slide
  → renderizado determinista
  → aprobación manual
  → descarga o publicación manual
```

## Operaciones del CRM

El CRM puede leer artículos y carruseles, exportar paquetes, validar importaciones, mostrar diferencias, crear versiones y conservar assets. El CRM no redacta ni genera imágenes mediante una API de modelos.

## Importación

- Aceptar paquete completo o reemplazos parciales.
- Validar JSON y archivos asociados.
- Identificar la versión base.
- Mostrar slides nuevas, modificadas y eliminadas.
- Mostrar cambios de texto, orden, assets y aprobación.
- No escribir en la base de datos antes de confirmar.
- Crear una versión nueva después de confirmar.

## Revisión

- La revisión es por slide.
- Aprobar una slide no aprueba las demás.
- Editar texto no regenera el asset si este no cambió.
- Reemplazar un asset no altera las demás slides.
- Las versiones anteriores permanecen disponibles.

## Fuentes

- Rutas y componentes actuales del módulo de carruseles.
- Contrato de intercambio aprobado para Modo A.
- Decisiones explícitas del administrador.
