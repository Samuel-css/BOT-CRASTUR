const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const {
  db,
  getSettings,
  updateSetting,
  getEffectiveRate,
  recordMetric,
  toggleBotPause,
  isBotPaused,
  getMetricsSummary,
  exportCatalog,
  importCatalog,
  getReservations,
  createReservation,
  updateReservationStatus,
  deleteReservation,
  cleanExpiredReservations
} = require('./database');
const fs = require('fs');

const { fetchBCVRate, initBCVService } = require('./bcvService');
// checkPendingFollowUps lo maneja whatsappService.js (evitar doble intervalo)
const {
  startWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  getStatus,
  sendManualMessage,
  subscribeStatusChange,
  subscribeLiveMessages
} = require('./whatsappService');


const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// Broadcast a todos los clientes WebSocket conectados
function broadcast(type, data) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Suscribir eventos de WhatsApp al WebSocket
subscribeStatusChange((statusData) => {
  broadcast('whatsapp_status', statusData);
});

// Suscribir mensajes en vivo al WebSocket para el Live Inbox
subscribeLiveMessages((liveMsg) => {
  broadcast('live_chat_message', liveMsg);
});

wss.on('connection', (ws) => {
  // Enviar estado actual de WhatsApp nada más conectar
  ws.send(JSON.stringify({
    type: 'whatsapp_status',
    data: getStatus()
  }));
});

// ================= RUTAS DE LA API =================

// 1. Estado General
app.get('/api/status', (req, res) => {
  const settings = getSettings();
  const tasa = getEffectiveRate();
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE activo = 1').get()?.count || 0;
  const sellerCount = db.prepare('SELECT COUNT(*) as count FROM sellers WHERE activo = 1').get()?.count || 0;
  const apartadosCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE estado = 'activo'").get()?.count || 0;
  const waStatus = getStatus();

  res.json({
    whatsapp: waStatus,
    tasa,
    fecha_tasa: settings.fecha_tasa,
    tasa_manual_activa: settings.tasa_manual_activa === '1',
    tasa_personalizada: parseFloat(settings.tasa_personalizada) || tasa,
    total_productos: productCount,
    total_vendedores: sellerCount,
    total_apartados: apartadosCount
  });
});

// 2. WhatsApp Controls
app.post('/api/whatsapp/start', async (req, res) => {
  try {
    startWhatsApp();
    res.json({ success: true, message: 'Iniciando servicio de WhatsApp...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await logoutWhatsApp();
    res.json({ success: true, message: 'Sesión de WhatsApp cerrada exitosamente' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/reset', async (req, res) => {
  try {
    const result = await resetWhatsApp();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Tasa BCV
app.get('/api/bcv', (req, res) => {
  const settings = getSettings();
  res.json({
    tasa_bcv: parseFloat(settings.tasa_bcv) || 849.56,
    fecha_tasa: settings.fecha_tasa,
    tasa_manual_activa: settings.tasa_manual_activa === '1',
    tasa_personalizada: parseFloat(settings.tasa_personalizada) || 849.56,
    tasa_efectiva: getEffectiveRate()
  });
});

app.post('/api/bcv/refresh', async (req, res) => {
  try {
    const result = await fetchBCVRate();
    broadcast('bcv_updated', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bcv/override', (req, res) => {
  const { activa, tasa } = req.body;
  if (activa !== undefined) {
    updateSetting('tasa_manual_activa', activa ? '1' : '0');
  }
  if (tasa !== undefined) {
    updateSetting('tasa_personalizada', String(tasa));
  }
  const nuevaTasaEfectiva = getEffectiveRate();
  broadcast('bcv_updated', { tasa_efectiva: nuevaTasaEfectiva });
  res.json({ success: true, tasa_efectiva: nuevaTasaEfectiva });
});

// 4. Productos (CRUD)
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  const tasa = getEffectiveRate();
  const settings = getSettings();
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;

  const enriched = products.map(p => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = cuotasCashea > 0 ? (precioUsd - inicialUsd) / cuotasCashea : 0;

    return {
      ...p,
      precio_bs: precioBs,
      cashea_inicial_usd: inicialUsd,
      cashea_inicial_bs: inicialUsd * tasa,
      cashea_cuota_usd: cuotaUsd,
      cashea_cuota_bs: cuotaUsd * tasa
    };
  });

  res.json({ products: enriched });
});

app.post('/api/products', (req, res) => {
  const { marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock } = req.body;

  if (!marca || !modelo || !categoria || precio_usd === undefined) {
    return res.status(400).json({ error: 'Marca, modelo, categoría y precio en USD son obligatorios' });
  }

  const parsedPrice = parseFloat(precio_usd);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'El precio en USD debe ser un número válido mayor a 0' });
  }

  const parsedStock = stock !== undefined ? parseInt(stock, 10) : 1;
  if (isNaN(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'El stock debe ser un número entero mayor o igual a 0' });
  }

  if (imagen_url && typeof imagen_url === 'string' && imagen_url.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'La imagen excede el límite permitido de 5 MB' });
  }

  const result = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    marca.trim(),
    modelo.trim(),
    categoria.trim(),
    parsedPrice,
    (descripcion || '').trim(),
    (imagen_url || '').trim(),
    parsedStock
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo } = req.body;

  let parsedPrice = null;
  if (precio_usd !== undefined) {
    parsedPrice = parseFloat(precio_usd);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'El precio en USD debe ser un número válido mayor a 0' });
    }
  }

  let parsedStock = null;
  if (stock !== undefined) {
    parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'El stock debe ser un número entero mayor o igual a 0' });
    }
  }

  if (imagen_url && typeof imagen_url === 'string' && imagen_url.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'La imagen excede el límite permitido de 5 MB' });
  }

  db.prepare(`
    UPDATE products
    SET marca = COALESCE(?, marca),
        modelo = COALESCE(?, modelo),
        categoria = COALESCE(?, categoria),
        precio_usd = COALESCE(?, precio_usd),
        descripcion = COALESCE(?, descripcion),
        imagen_url = COALESCE(?, imagen_url),
        stock = COALESCE(?, stock),
        activo = COALESCE(?, activo)
    WHERE id = ?
  `).run(
    marca ? marca.trim() : null,
    modelo ? modelo.trim() : null,
    categoria ? categoria.trim() : null,
    parsedPrice,
    descripcion !== undefined ? (descripcion || '').trim() : null,
    imagen_url !== undefined ? (imagen_url || '').trim() : null,
    parsedStock,
    activo !== undefined ? (activo ? 1 : 0) : null,
    id
  );

  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ success: true });
});

// 5. Vendedores (CRUD)
app.get('/api/sellers', (req, res) => {
  const sellers = db.prepare('SELECT * FROM sellers ORDER BY id ASC').all();
  res.json({ sellers });
});

app.post('/api/sellers', (req, res) => {
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

app.put('/api/sellers/:id', (req, res) => {
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

app.delete('/api/sellers/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sellers WHERE id = ?').run(id);
  res.json({ success: true });
});

// 6. Configuración General (Ajustes)
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  for (const [key, val] of Object.entries(newSettings)) {
    updateSetting(key, val);
  }
  res.json({ success: true, settings: getSettings() });
});

// ================= 7. RUTAS DE APARTADOS (LÍMITE 24 HORAS) =================
app.get('/api/reservations', (req, res) => {
  try {
    const onlyActive = req.query.active !== 'false';
    const list = getReservations(onlyActive);
    res.json({ success: true, reservations: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reservations', (req, res) => {
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
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/reservations/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    updateReservationStatus(id, estado);
    broadcast('reservations_updated', { action: 'status_changed', id, estado });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/reservations/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteReservation(id);
    broadcast('reservations_updated', { action: 'deleted', id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/chat/logs', (req, res) => {
  const messages = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50').all();
  const sessions = db.prepare('SELECT * FROM chat_sessions ORDER BY ultimo_mensaje_at DESC LIMIT 20').all();
  res.json({ messages: messages.reverse(), sessions });
});

// 8. Métricas para el Dashboard
app.get('/api/metrics', (req, res) => {
  res.json(getMetricsSummary());
});

// 9. Live Inbox (Bandeja en Vivo de Chats)
app.get('/api/inbox', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, 
      (SELECT contenido FROM chat_messages WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as ultimo_mensaje_texto,
      (SELECT remitente FROM chat_messages WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as ultimo_remitente
    FROM chat_sessions s
    ORDER BY s.ultimo_mensaje_at DESC
    LIMIT 50
  `).all();
  res.json(sessions);
});

app.get('/api/inbox/:jid', (req, res) => {
  const { jid } = req.params;
  const messages = db.prepare('SELECT * FROM chat_messages WHERE jid = ? ORDER BY id ASC').all(jid);
  const session = db.prepare('SELECT * FROM chat_sessions WHERE jid = ?').get(jid);
  res.json({ session, messages });
});

// Pausar o reanudar bot en un chat específico (Human Takeover)
app.post('/api/chat/pause', (req, res) => {
  const { jid, pausado } = req.body;
  if (!jid) return res.status(400).json({ error: 'JID es requerido' });

  toggleBotPause(jid, !!pausado);
  broadcast('chat_pause_changed', { jid, pausado: !!pausado });
  res.json({ success: true, jid, pausado: !!pausado });
});

// Enviar mensaje manual desde el panel
app.post('/api/chat/send-manual', async (req, res) => {
  const { jid, text } = req.body;
  if (!jid || !text) return res.status(400).json({ error: 'JID y texto son requeridos' });

  try {
    await sendManualMessage(jid, text);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 10. Exportar e Importar Catálogo (Respaldo en 1 Clic para el Dueño)
app.get('/api/catalog/export', (req, res) => {
  const data = exportCatalog();
  const filename = `crastur_catalogo_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/catalog/import', (req, res) => {
  try {
    const { productos } = req.body;
    if (!productos || !Array.isArray(productos)) {
      return res.status(400).json({ error: 'Formato inválido. Se esperaba una lista de productos.' });
    }
    const result = importCatalog(productos);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir frontend compilado en producción (con fallback amigable si no está compilado)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    // Fallback amigable si el frontend aún no ha sido compilado
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Crastur - Compilación Requerida</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0f19;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }
          .card {
            background: #141e33;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 36px;
            max-width: 560px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
            text-align: center;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #ffffff; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
          .step-box {
            background: #0b1120;
            border: 1px solid #22324f;
            border-radius: 10px;
            padding: 16px;
            text-align: left;
            margin-bottom: 16px;
          }
          .step-title { color: #38bdf8; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
          .step-desc { color: #94a3b8; font-size: 13px; }
          code {
            display: block;
            background: #020617;
            padding: 10px 14px;
            border-radius: 6px;
            color: #4ade80;
            font-family: Consolas, monospace;
            font-size: 13px;
            margin-top: 8px;
          }
          .btn-reload {
            display: inline-block;
            margin-top: 10px;
            padding: 10px 22px;
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            border: none;
          }
          .btn-reload:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">⚙️ Interfaz Visual No Compilada</div>
          <h1>El servidor Crastur está activo</h1>
          <p>El backend y el servicio de WhatsApp están listos, pero la interfaz visual web (React/Vite) aún no ha sido construida.</p>
          
          <div class="step-box">
            <div class="step-title">Opción recomendada:</div>
            <div class="step-desc">Ejecuta el archivo de arranque en Windows:</div>
            <code>Crastur.bat</code>
          </div>

          <div class="step-box">
            <div class="step-title">Si estás usando la terminal o editor:</div>
            <div class="step-desc">Abre la terminal en la raíz del proyecto y ejecuta:</div>
            <code>npm run build</code>
          </div>

          <button class="btn-reload" onclick="location.reload()">Recargar Página</button>
        </div>
      </body>
      </html>
    `);
  }
  next();
});

// Manejo Global de Errores para que el servidor NUNCA se cierre inesperadamente
process.on('uncaughtException', (err) => {
  console.error('[Protección Anti-Fallos] Error no capturado recuperado:', err.message);
  try {
    const errorLogPath = path.join(__dirname, '..', 'data', 'app_error.log');
    fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
  } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Protección Anti-Fallos] Promesa rechazada recuperada:', reason);
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`[Servidor Crastur] Escuchando en http://localhost:${PORT}`);
  // Iniciar servicio BCV en segundo plano
  initBCVService();
  // Iniciar automáticamente WhatsApp y reconectar sesión existente
  // El seguimiento y limpieza de apartados lo maneja whatsappService.js
  startWhatsApp();
});

module.exports = { app, server };

