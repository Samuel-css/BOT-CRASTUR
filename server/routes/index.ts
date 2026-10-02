/**
 * ============================================================================
 * ENRUTADOR PRINCIPAL DE LA API REST (SERVER/ROUTES/INDEX.TS)
 * ============================================================================
 * Centraliza y monta todos los submódulos de la API bajo el prefijo `/api`.
 * Estructura desacoplada para salud, tasa BCV, inventario, vendedores,
 * apartados, WhatsApp Baileys, ajustes comerciales y respaldos del sistema.
 */

import { Router } from 'express';
const router = Router();

import healthRoutes from './health.routes';
import bcvRoutes from './bcv.routes';
import productsRoutes from './products.routes';
import sellersRoutes from './sellers.routes';
import reservationsRoutes from './reservations.routes';
import whatsappRoutes from './whatsapp.routes';
import settingsRoutes from './settings.routes';
import backupsRoutes from './backups.routes';

// Registro de endpoints agrupados por dominio comercial y operativo
router.use('/', healthRoutes);
router.use('/bcv', bcvRoutes);
router.use('/products', productsRoutes);
router.use('/sellers', sellersRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/', whatsappRoutes);
router.use('/settings', settingsRoutes);
router.use('/', backupsRoutes);

export default router;
