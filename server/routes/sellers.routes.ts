/**
 * ============================================================================
 * RUTAS DE GESTIÓN DE ASESORES Y VENDEDORES (SELLERS.ROUTES.TS)
 * ============================================================================
 * Administra el equipo comercial de la tienda física para la derivación de clientes
 * desde el bot de WhatsApp cuando solicitan atención humana especializada.
 *
 * [ANTI-BANEO META 2025] Facilita la transición fluida bot -> asesor humano.
 * [VALIDACIÓN] Todos los campos se coercen a texto y se validan antes de tocar la base;
 * así un número JSON no provoca un TypeError de `.trim()`.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import { db, saveMasterSnapshotToDisk } from '../database';

/** Envuelve un handler para responder 500 en JSON sin tumbar el proceso. */
const safe = (handler: (req: Request, res: Response) => any) => (req: Request, res: Response) => {
  try {
    return handler(req, res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Error interno del servidor' });
    }
  }
};

/** Convierte un valor a texto recortado; devuelve '' para null/undefined/objetos. */
function toText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

/**
 * GET /api/sellers
 * Retorna la nómina completa de vendedores registrados en el sistema.
 */
router.get('/', safe((req: Request, res: Response) => {
  const sellers = db.prepare('SELECT * FROM sellers ORDER BY id ASC').all();
  res.json({ sellers });
}));

/**
 * POST /api/sellers
 * Registra un nuevo asesor de ventas con su nombre, número de WhatsApp y departamento.
 */
router.post('/', safe((req: Request, res: Response) => {
  const nombre = toText(req.body?.nombre);
  const telefono = toText(req.body?.telefono);
  const departamento = toText(req.body?.departamento) || 'Ventas';

  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  }
  if (telefono.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'El teléfono debe contener al menos 7 dígitos' });
  }

  const result = db.prepare(`
    INSERT INTO sellers (nombre, telefono, departamento, activo)
    VALUES (?, ?, ?, 1)
  `).run(nombre, telefono, departamento);

  saveMasterSnapshotToDisk();
  res.json({ success: true, id: result.lastInsertRowid });
}));

/**
 * PUT /api/sellers/:id
 * Modifica los datos o estado activo de un asesor existente.
 */
router.put('/:id', safe((req: Request, res: Response) => {
  const { id } = req.params;
  const existente = db.prepare('SELECT id FROM sellers WHERE id = ?').get(id);
  if (!existente) {
    return res.status(404).json({ success: false, error: 'No existe un asesor con ese ID' });
  }

  const nombre = req.body?.nombre !== undefined ? toText(req.body.nombre) : null;
  const telefono = req.body?.telefono !== undefined ? toText(req.body.telefono) : null;
  const departamento = req.body?.departamento !== undefined ? toText(req.body.departamento) : null;
  const activo = req.body?.activo;

  if (nombre !== null && !nombre) {
    return res.status(400).json({ success: false, error: 'El nombre no puede quedar vacío' });
  }
  if (telefono !== null && telefono.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ success: false, error: 'El teléfono debe contener al menos 7 dígitos' });
  }

  db.prepare(`
    UPDATE sellers
    SET nombre = COALESCE(?, nombre),
        telefono = COALESCE(?, telefono),
        departamento = COALESCE(?, departamento),
        activo = COALESCE(?, activo)
    WHERE id = ?
  `).run(
    nombre,
    telefono,
    departamento,
    activo !== undefined ? (activo ? 1 : 0) : null,
    id
  );

  saveMasterSnapshotToDisk();
  res.json({ success: true });
}));

/**
 * DELETE /api/sellers/:id
 * Elimina el registro de un asesor de ventas de la base de datos.
 */
router.delete('/:id', safe((req: Request, res: Response) => {
  const { id } = req.params;
  const existente = db.prepare('SELECT id FROM sellers WHERE id = ?').get(id);
  if (!existente) {
    return res.status(404).json({ success: false, error: 'No existe un asesor con ese ID' });
  }
  db.prepare('DELETE FROM sellers WHERE id = ?').run(id);
  saveMasterSnapshotToDisk();
  res.json({ success: true });
}));

export default router;
