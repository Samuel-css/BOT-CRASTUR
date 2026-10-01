/**
 * ============================================================================
 * RUTAS DE GESTIÓN DE PROVEEDORES MAYORISTAS (SUPPLIERS.ROUTES.TS)
 * ============================================================================
 * Permite listar, crear, actualizar y desactivar proveedores de repuestos de moto
 * e insumos para cauchera. Mantiene vinculación directa con el snapshot maestro.
 * 
 * [MERCADO VENEZUELA] Registra días de despacho, términos de crédito y contacto comercial directo.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../database';

/**
 * GET /api/suppliers
 * Retorna la lista de proveedores (por defecto solo los activos, o todos si ?active=false).
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const suppliers = getSuppliers(req.query.active !== 'false');
    res.json({ suppliers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/suppliers
 * Da de alta un nuevo proveedor mayorista en la base de datos y actualiza el snapshot.
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const created = createSupplier(req.body);
    res.json({ success: true, supplier: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/suppliers/:id
 * Actualiza la información de contacto o condiciones de un proveedor registrado.
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const updated = updateSupplier(Number(req.params.id), req.body);
    res.json({ success: true, supplier: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/suppliers/:id
 * Inactiva lógicamente a un proveedor para preservar su integridad referencial histórica.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    deleteSupplier(Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
