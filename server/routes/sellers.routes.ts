/**
 * ============================================================================
 * RUTAS DE GESTIÓN DE ASESORES Y VENDEDORES (SELLERS.ROUTES.TS)
 * ============================================================================
 * Administra el equipo comercial de la tienda física para la derivación de clientes
 * desde el bot de WhatsApp cuando solicitan atención humana especializada.
 * 
 * [ANTI-BANEO META 2025] Facilita la transición fluida bot -> asesor humano.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import { db } from '../database';

/**
 * GET /api/sellers
 * Retorna la nómina completa de vendedores registrados en el sistema.
 */
router.get('/', (req: Request, res: Response) => {
  const sellers = db.prepare('SELECT * FROM sellers ORDER BY id ASC').all();
  res.json({ sellers });
});

/**
 * POST /api/sellers
 * Registra un nuevo asesor de ventas con su nombre, número de WhatsApp y departamento.
 */
router.post('/', (req: Request, res: Response) => {
  const { nombre, telefono, departamento } = req.body;
  if (!nombre || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
  }

  const result = db.prepare(`
    INSERT INTO sellers (nombre, telefono, departamento, activo)
    VALUES (?, ?, ?, 1)
  `).run(nombre.trim(), telefono.trim(), (departamento || 'Ventas').trim());

  res.json({ success: true, id: result.lastInsertRowid });
});

/**
 * PUT /api/sellers/:id
 * Modifica los datos o estado activo de un asesor existente.
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, telefono, departamento, activo } = req.body;

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

  res.json({ success: true });
});

/**
 * DELETE /api/sellers/:id
 * Elimina el registro de un asesor de ventas de la base de datos.
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sellers WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
