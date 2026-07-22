# Servidor MCP — carruseles del CRM

Permite operar los carruseles del CRM desde Claude, sin copiar y pegar el JSON de la spec.

**Invierte la dirección de la llamada.** El endpoint de redacción del CRM
(`/api/admin/carousels/draft`) llama a la API de Anthropic y consume **créditos de
Consola**. Acá es Claude quien llama al CRM: el consumo queda en el **plan de Claude** y
el CRM no necesita `ANTHROPIC_API_KEY` para nada.

## Qué habilita

El bucle se cierra: Claude escribe la spec, dispara el render y **ve las slides
generadas**. Puede detectar que un texto desborda o pisa el footer, acortarlo y
regenerar. Hasta ahora las longitudes de la guía eran una heurística a ciegas.

## Tools

| Tool | Qué hace |
|---|---|
| `carousels_list` | Lista carruseles (filtro opcional por estado) |
| `carousel_get` | Spec, estado y slides con sus notas de edición |
| `carousel_create` | Crea un carrusel en DRAFT desde una spec |
| `carousel_update_spec` | Reemplaza la spec (vuelve a DRAFT) |
| `carousel_generate` | Renderiza las slides (~5-15s) |
| `carousel_previews` | **Devuelve las slides como imágenes** para inspeccionarlas |
| `professionals_list` | Profesionales, para acreditar autoría |
| `source_posts_list` / `source_post_get` | Artículos del blog como material fuente |

**Fuera del alcance a propósito:** aprobar, publicar al blog y eliminar. Son
irreversibles o de cara al público; siguen siendo un click humano en el panel.

## Puesta en marcha

### 1. Generar el token

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Debe tener al menos 32 caracteres: el CRM rechaza tokens más cortos para que no se
habilite acceso admin por accidente con un valor trivial.

### 2. Configurar el CRM (Vercel)

Variables de entorno, **secretas**, en todos los entornos:

| Variable | Valor |
|---|---|
| `MCP_ADMIN_TOKEN` | El token generado |
| `MCP_ADMIN_EMAIL` | `raul.olmedo@gmail.com` — usuario admin al que se atribuye lo creado |

Si se omite `MCP_ADMIN_EMAIL`, se usa el primer usuario con rol `ADMIN`.

Redesplegar para que tomen efecto.

### 3. Configurar tu máquina

El repo trae [`.mcp.json`](../.mcp.json), que ya apunta a este servidor. **No contiene el
token**: lo lee de tu entorno. En PowerShell:

```powershell
$env:MCP_ADMIN_TOKEN = "el-token-generado"
$env:CRM_BASE_URL = "https://saludmentalcostarica.com"
```

Para que persista entre sesiones, agregalo a tus variables de entorno de usuario de
Windows.

> **`CRM_BASE_URL` debe apuntar al CRM desplegado**, no a `localhost:3000`. El render
> corre en la función Python de Vercel, que no existe en `npm run dev`.

### 4. Usarlo

En Claude Code, dentro de este repo, el servidor se levanta solo. Verificá con `/mcp`.

Para usarlo desde **claude.ai o el móvil** hace falta la variante remota (HTTP), que es
el paso siguiente: el mismo handler expuesto como route de Next, conectado como conector
personalizado.

## Flujo típico

1. "Listá los artículos del blog" → `source_posts_list`
2. "Tomá el de duelo y armá un carrusel" → `source_post_get` + redacción con el skill
3. "Crealo y generá las slides" → `carousel_create` + `carousel_generate`
4. "Mostrámelas" → `carousel_previews` → Claude verifica el encuadre del texto
5. Corrige y regenera si hace falta → `carousel_update_spec` + `carousel_generate`
6. **Vos** aprobás y publicás desde el panel

## Seguridad

- El token da **acceso admin** a los carruseles. Tratalo como una contraseña.
- Nunca en el repo: `.mcp.json` lo referencia por `${MCP_ADMIN_TOKEN}`, no lo contiene.
- La comparación del token es en tiempo constante (`crypto.timingSafeEqual`).
- Si se filtra: cambiá `MCP_ADMIN_TOKEN` en Vercel y redesplegá. Queda invalidado.
