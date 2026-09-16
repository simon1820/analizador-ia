/**
 * Rutas HTTP. Reciben el estado compartido del proceso (identidad, cliente
 * de IA, interruptor del health check) y no saben nada de cómo se creó.
 */

import { Router } from "express";
import { config } from "./config.js";
import type { Identidad } from "./identidad.js";
import type { ClienteIa } from "./ia/cliente.js";
import { analizarTexto, traducirError } from "./ia/analisis.js";

export type Estado = {
  identidad: Identidad;
  cliente: ClienteIa;
  /** Interruptor manual para romper el health check a propósito (demo del balanceador). */
  saludable: boolean;
};

export function crearRutas(estado: Estado): Router {
  const rutas = Router();

  // El balanceador consulta esta ruta. Un 503 saca la instancia de rotación.
  rutas.get("/health", (_req, res) => {
    res.status(estado.saludable ? 200 : 503).json({ saludable: estado.saludable, ...estado.identidad });
  });

  rutas.get("/api/identidad", (_req, res) => {
    res.json({
      ...estado.identidad,
      saludable: estado.saludable,
      proveedor: config.proveedor,
      modelo: config.modelo,
      region: config.awsRegion,
      maxCaracteres: config.maxCaracteres,
      hora: new Date().toISOString(),
    });
  });

  // Sólo para la demo del balanceador. En una app real esto no existe.
  rutas.post("/api/salud", (req, res) => {
    const { activa } = req.body as { activa?: unknown };
    if (typeof activa !== "boolean") {
      res.status(400).json({ error: 'Envía { "activa": true } o { "activa": false }.' });
      return;
    }
    estado.saludable = activa;
    console.log(`Health check ahora responde ${activa ? "200" : "503"}.`);
    res.json({ saludable: activa });
  });

  rutas.post("/api/analizar", async (req, res) => {
    const { texto } = req.body as { texto?: unknown };
    if (typeof texto !== "string" || texto.trim().length === 0) {
      res.status(400).json({ error: "Escribe un texto para analizar." });
      return;
    }
    const limpio = texto.trim();
    if (limpio.length > config.maxCaracteres) {
      res.status(400).json({ error: `El texto supera los ${config.maxCaracteres} caracteres.` });
      return;
    }

    const inicio = Date.now();
    try {
      const { analisis, tokens } = await analizarTexto(estado.cliente, limpio);
      res.json({
        ...analisis,
        proveedor: config.proveedor,
        modelo: config.modelo,
        tokens,
        milisegundos: Date.now() - inicio,
        atendidoPor: estado.identidad.instanceId,
      });
    } catch (err) {
      const e = traducirError(err);
      console.error(`Análisis fallido (${e.status}):`, err instanceof Error ? err.message : err);
      res.status(e.status).json({ error: e.message, atendidoPor: estado.identidad.instanceId });
    }
  });

  return rutas;
}
