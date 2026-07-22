#!/usr/bin/env node
/**
 * Servidor MCP (stdio) para operar los carruseles del CRM desde Claude.
 *
 * Invierte la dirección de la llamada: en vez de que el CRM llame a la API de
 * Anthropic (créditos de Consola), es Claude quien llama al CRM. El consumo
 * queda en el plan de Claude y el CRM no necesita ANTHROPIC_API_KEY.
 *
 * Alcance deliberado: lee, crea, actualiza la spec y genera slides.
 * NO expone aprobar, publicar al blog ni eliminar — acciones irreversibles o de
 * cara al público que siguen siendo un click humano en el panel.
 *
 * Entorno:
 *   CRM_BASE_URL    URL del CRM desplegado (la generación necesita la función
 *                   Python de Vercel; contra localhost no renderiza).
 *   MCP_ADMIN_TOKEN Debe coincidir con el del entorno del CRM (≥32 caracteres).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = (process.env.CRM_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.MCP_ADMIN_TOKEN || "";

if (!BASE_URL || !TOKEN) {
  console.error("Faltan CRM_BASE_URL y/o MCP_ADMIN_TOKEN en el entorno del servidor MCP.");
  process.exit(1);
}

/** Llama a la API del CRM con el token de máquina. */
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const detail = data?.errors ? ` — ${JSON.stringify(data.errors)}` : "";
    throw new Error(`${res.status} ${data?.message || res.statusText}${detail}`);
  }
  return data;
}

const asText = (value) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

// --- Definición de tools (JSON Schema crudo: sin acoplarse a la versión de zod) ---

const SPEC_SCHEMA = {
  type: "object",
  description:
    'Spec del carrusel: { "title": string, "slides": [...] }. Cada slide lleva "type" ' +
    "(cover | narrative | map | directory | content | quote | highlight | cta) y sus campos. " +
    "Respetá las longitudes de la guía: el texto debe caber en 1080x1080 sin pisar el footer.",
  additionalProperties: true,
};

const TOOLS = [
  {
    name: "carousels_list",
    description:
      "Lista los carruseles del CRM (id, slug, título, estado, nº de slides). Usalo para " +
      "ubicar un carrusel antes de leerlo o modificarlo.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "GENERATED", "APPROVED", "PUBLISHED"],
          description: "Filtro opcional por estado.",
        },
      },
    },
  },
  {
    name: "carousel_get",
    description:
      "Devuelve un carrusel completo: spec, estado y sus slides con las notas de edición " +
      "y las marcas de 'listo' puestas por el revisor.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Id del carrusel." } },
      required: ["id"],
    },
  },
  {
    name: "carousel_create",
    description:
      "Crea un carrusel nuevo en estado DRAFT a partir de una spec. No genera las imágenes: " +
      "para eso llamá después a carousel_generate.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título interno del carrusel." },
        spec: SPEC_SCHEMA,
        authorId: {
          type: "string",
          description:
            "Id del ProfessionalProfile a acreditar como autor (opcional). Obtenelo con professionals_list.",
        },
        sourcePostId: {
          type: "string",
          description: "Id del artículo del blog del que sale el carrusel (opcional).",
        },
      },
      required: ["title", "spec"],
    },
  },
  {
    name: "carousel_update_spec",
    description:
      "Reemplaza la spec de un carrusel existente. El carrusel vuelve a DRAFT y las slides " +
      "previas quedan obsoletas hasta regenerar.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        spec: SPEC_SCHEMA,
      },
      required: ["id", "spec"],
    },
  },
  {
    name: "carousel_generate",
    description:
      "Renderiza las slides con la spec guardada (~5-15s). Requiere que CRM_BASE_URL apunte al " +
      "CRM desplegado. Después usá carousel_previews para VER el resultado y verificar que el " +
      "texto entra bien en cada filmina.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "carousel_previews",
    description:
      "Devuelve las slides renderizadas como imágenes para inspeccionarlas. Es el paso que cierra " +
      "el bucle: mirá si algún texto desborda, pisa el footer o queda desbalanceado, y corregí la " +
      "spec en consecuencia. Ojo: cada slide es una imagen de 1080x1080, pedí solo las que necesites.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        indexes: {
          type: "array",
          items: { type: "integer" },
          description: "Índices de slide (base 0) a devolver. Si se omite, devuelve todas.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "professionals_list",
    description: "Lista los profesionales aprobados del CRM, para acreditar autoría de un carrusel.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "source_posts_list",
    description: "Lista los artículos del blog disponibles como material fuente para un carrusel.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "source_post_get",
    description:
      "Devuelve el texto plano de un artículo del blog, para usarlo como fuente al redactar la spec.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Id del artículo." } },
      required: ["id"],
    },
  },
];

// --- Implementación ---

async function callTool(name, args) {
  switch (name) {
    case "carousels_list": {
      const rows = await api("/api/admin/carousels");
      const filtered = args.status ? rows.filter((r) => r.status === args.status) : rows;
      if (!filtered.length) return asText("No hay carruseles que coincidan.");
      return asText(
        filtered.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          status: r.status,
          slides: r.assetCount,
          updatedAt: r.updatedAt,
        }))
      );
    }

    case "carousel_get": {
      const c = await api(`/api/admin/carousels/${encodeURIComponent(args.id)}`);
      return asText({
        id: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
        spec: c.spec,
        slides: (c.assets || []).map((a) => ({
          index: a.index,
          filename: a.filename,
          ready: a.ready,
          note: a.note || null,
        })),
      });
    }

    case "carousel_create": {
      const created = await api("/api/admin/carousels", {
        method: "POST",
        body: {
          title: args.title,
          spec: args.spec,
          ...(args.authorId ? { authorId: args.authorId } : {}),
          ...(args.sourcePostId ? { sourcePostId: args.sourcePostId } : {}),
        },
      });
      return asText(
        `Carrusel creado en DRAFT.\nid: ${created.id}\nslug: ${created.slug}\n\n` +
          "Siguiente paso: carousel_generate para renderizar las slides."
      );
    }

    case "carousel_update_spec": {
      await api(`/api/admin/carousels/${encodeURIComponent(args.id)}`, {
        method: "PATCH",
        body: { spec: args.spec },
      });
      return asText("Spec actualizada. El carrusel volvió a DRAFT; regenerá para ver los cambios.");
    }

    case "carousel_generate": {
      const out = await api(`/api/admin/carousels/${encodeURIComponent(args.id)}/generate`, {
        method: "POST",
      });
      return asText(
        `Generadas ${out.count} slides (estado: ${out.status}).\n\n` +
          "Verificá el resultado con carousel_previews antes de darlo por bueno."
      );
    }

    case "carousel_previews": {
      const c = await api(`/api/admin/carousels/${encodeURIComponent(args.id)}`);
      let assets = (c.assets || []).filter((a) => a.url);
      if (Array.isArray(args.indexes) && args.indexes.length) {
        const want = new Set(args.indexes);
        assets = assets.filter((a) => want.has(a.index));
      }
      if (!assets.length) {
        return asText("No hay slides renderizadas. Ejecutá carousel_generate primero.");
      }

      const content = [
        { type: "text", text: `${c.title} — ${assets.length} slide(s), estado ${c.status}:` },
      ];
      for (const a of assets) {
        const res = await fetch(a.url);
        if (!res.ok) {
          content.push({ type: "text", text: `Slide ${a.index + 1}: no se pudo descargar.` });
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        content.push({ type: "text", text: `Slide ${a.index + 1} (${a.filename}):` });
        content.push({ type: "image", data: buf.toString("base64"), mimeType: "image/png" });
      }
      return { content };
    }

    case "professionals_list": {
      const data = await api("/api/admin/professionals");
      const list = Array.isArray(data) ? data : data.professionals || [];
      return asText(
        list.map((p) => ({ authorId: p.id, name: p.user?.name || p.name || "(sin nombre)" }))
      );
    }

    case "source_posts_list": {
      const data = await api("/api/admin/carousels/source-posts");
      return asText(data.posts || []);
    }

    case "source_post_get": {
      const post = await api(
        `/api/admin/carousels/source-posts?id=${encodeURIComponent(args.id)}`
      );
      return asText({ id: post.id, title: post.title, text: post.text });
    }

    default:
      throw new Error(`Tool desconocida: ${name}`);
  }
}

const server = new Server(
  { name: "crm-smcr-carruseles", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await callTool(req.params.name, req.params.arguments || {});
  } catch (err) {
    // Error de vuelta al modelo (isError) en vez de tumbar el servidor.
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
