/**
 * ============================================================================
 * RUTAS DE APARTADOS Y RESERVAS (24 HORAS) (RESERVATIONS.ROUTES.TS)
 * ============================================================================
 * Administra el ciclo de vida de los tickets de apartado emitidos a clientes:
 * creación manual desde el panel, consulta de activos/históricos, cambios de estado y cancelaciones.
 * 
 * [APARTADOS Y RESERVAS 24H]
 * - Control atómico de stock: decrementar al apartar y reintegrar al catálogo al vencer/cancelar.
 * [MERCADO VENEZUELA]
 * - Emite eventos WebSocket (`reservations_updated`, `products_updated`) para refrescar inventario en vivo.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import {
  getReservations,
  createReservation,
  updateReservationStatus,
  deleteReservation
} from '../database';
import { broadcast } from '../websocket';

/**
 * GET /api/reservations
 * Retorna los apartados registrados. Por defecto solo activos (?active=true), o todos si ?active=false.
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const onlyActive = req.query.active !== 'false';
    const list = getReservations(onlyActive);
    res.json({ success: true, reservations: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reservations
 * Registra un apartado manualmente desde el panel administrativo, reservando stock físico.
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs, jid } = req.body;
    if (!nombre || !cedula || !telefono || !producto_nombre) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios para el apartado' });
    }

    const reservation = createReservation({
      jid: jid || '',
      nombre,
      cedula,
      telefono,
      producto_id,
      producto_nombre,
      precio_usd,
      precio_bs
    });

    broadcast('reservations_updated', { action: 'created', reservation });
    broadcast('products_updated', { action: 'stock_changed' });
    res.json({ success: true, reservation });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/reservations/:id/status
 * Transita el estado de un apartado (activo, entregado, cancelado, vencido).
 * Ajusta automáticamente el stock del producto reservado.
 */
router.put('/:id/status', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { estado } = req.body;
    updateReservationStatus(id, estado);
    broadcast('reservations_updated', { action: 'status_changed', id, estado });
    broadcast('products_updated', { action: 'stock_changed' });
    res.json({ success: true });
  } catch (err: any) {
    // Errores de validación (estado inválido o apartado inexistente) → 400
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/reservations/:id
 * Elimina un apartado y repone el stock si se encontraba en estado activo.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    deleteReservation(id);
    broadcast('reservations_updated', { action: 'deleted', id });
    broadcast('products_updated', { action: 'stock_changed' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
