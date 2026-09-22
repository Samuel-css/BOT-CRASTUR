# 🛞🏍️ Crastur - Sistema de Ventas y Bot de WhatsApp

Sistema automatizado de atención y ventas para **Crastur**, tienda física en Caracas especializada en insumos para caucheras, repuestos y accesorios para moto, y productos de mantenimiento.

Incluye conversión en vivo a Bolívares con tasa oficial del **Banco Central de Venezuela (BCV)** a 2 decimales, cotizador de combos, financiamiento con **Cashea**, motor de **apartados por 24 horas**, seguimiento automático educado y panel administrativo web con control de pausas en vivo.

---

## 🚀 Cómo Iniciar el Sistema (1 Solo Clic)

### 🪟 En Windows:
Haz **doble clic en `Crastur.bat`**. ¡Eso es todo!

El sistema realiza automáticamente:
1. Verifica que Node.js esté instalado.
2. Comprueba las dependencias y la base de datos.
3. Inicia el servidor local y abre la aplicación en tu navegador (`http://localhost:3333`).

> [!TIP]
> **Si Windows 11 bloquea el archivo la primera vez:**  
> Clic derecho en **`Crastur.bat`** ➔ **Propiedades** ➔ Marca la casilla **☑ Desbloquear** abajo ➔ Clic en **Aceptar**.

---

### 🐧 En Linux / macOS:
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
chmod +x scripts/iniciar_crastur.sh
./scripts/iniciar_crastur.sh
```

---

### 💻 Desde la Terminal de Desarrollador (VS Code / Cursor):
```bash
# 1. Instalar dependencias
npm install

# 2. Compilar panel visual (si es la primera vez o hubo cambios)
npm run build

# 3. Iniciar el sistema
npm start
```
Luego ingresa en tu navegador a: **`http://localhost:3333`**.

---

## 📲 Cómo Vincular WhatsApp

1. Abre el panel administrativo en **`http://localhost:3333`**.
2. En el menú lateral izquierdo, haz clic en **Conexión WhatsApp**.
3. En tu teléfono celular, abre WhatsApp ➔ menú de 3 puntos (o Ajustes) ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
4. Apunta la cámara de tu celular y escanea el código **QR** que aparece en la pantalla.
5. Una vez conectado, el panel mostrará el estado en verde **Conectado** y el bot comenzará a responder automáticamente a los clientes.

---

## 🗂️ Las 4 Categorías Comerciales de Crastur

El bot y el inventario están organizados en 4 líneas comerciales maestras sin mezclar repuestos ajenos ni duplicar filtros:

| Categoría | Productos Principales |
| :--- | :--- |
| 🛞 **Insumos Cauchera** | Parches en frío/caliente, pega química azul, válvulas sin tripa TR-414, mechas para pinchazos, plomos de balanceo y terrajas. |
| 🏍️ **Repuestos Moto** | Kits de arrastre (cadena 428H, piñón, corona), pastillas y bandas de freno, bujías de encendido (NGK), repuestos de motor y tripas. |
| 🎽 **Accesorios Moto** | Puños para manubrio, mallas porta-casco (pulpos), retrovisores, luces exploradoras LED, fundas y spray para cadena. |
| 📦 **Otros Productos** | Aceites de motor 4T/2T, refrigerantes para radiador, limpiadores de inyectores, aditivos de combustible y bombillos. |

### 🧭 Menú Numérico de Bienvenida del Bot (1 al 6)
El bot responde tanto a preguntas en lenguaje natural como a selecciones numéricas directas desde el menú de inicio:
- **`1`** o *"cauchera"*: Despliega el catálogo de **Insumos Cauchera** con precios en $ y Bs BCV.
- **`2`** o *"repuestos moto"*: Despliega el catálogo de **Repuestos Moto** con kits de arrastre, bujías y frenos.
- **`3`** o *"accesorios moto"*: Brinda atención sobre **Accesorios Moto** y consulta en almacén.
- **`4`** o *"otros productos"*: Despliega **Otros Productos** (aceites 4T/2T, refrigerantes y aditivos).
- **`5`**: Información oficial sobre financiamiento con **Cashea** en tienda física.
- **`6`**: Pone en contacto directo con un **Asesor / Vendedor** humano en tienda.

---

## 🤖 Capacidades Inteligentes del Bot

### 1. 🇻🇪 Tasa Oficial BCV en Vivo (Estricta a 2 Decimales)
- Conexión directa al Banco Central de Venezuela. Todos los precios se muestran en dólares (`$ USD`) y en bolívares (`Bs.`) calculados con la tasa del día a dos decimales exactos (ej. *Bs. 852,42 / USD*).
- El bot resalta siempre el beneficio del **precio especial con descuento directo pagando en efectivo en divisas** en tienda física.

### 2. 🛒 Cotizador de Combos y Búsqueda Difusa (*Fuzzy Search*)
- Si el cliente escribe con faltas de ortografía o modismos caraqueños (*"epale bro tnen pastiyas y bujia pa sbr?"*), el motor identifica los repuestos exactos.
- Cuando el cliente consulta más de un producto, el bot desglosa los subtotales unitarios, calcula el **total combinado en USD y Bs**, aplica Cashea si aplica y estima la tarifa de motorizado.

### 3. ⏱️ Flujo de Apartado por 24 Horas sin Costo
- Los clientes pueden reservar repuestos para retirar en la tienda física de San Agustín Norte:
  1. **Nombre y Apellido:** Validación de persona real (rechaza apodos o nombres incompletos).
  2. **Cédula de Identidad:** Validación venezolana (`V-` o `E-`) tolerando formatos coloquiales (*"mi cédula es 28123456"*).
  3. **Teléfono de Contacto:** Normalización a formato nacional (`0412`, `0414`, `0424`, `0416`, `0426`).
  4. **Emisión de Comprobante:** Genera un ticket digital oficial con fecha y hora límite estricta de 24 horas continuas.
- **Sin bloqueos:** Si durante la reserva el cliente pregunta por métodos de pago, horario, delivery o envía una foto/audio, el bot responde su duda y le permite continuar sin reiniciar ni perder sus datos.
- **Cancelación inmediata:** Si el cliente escribe *"cancela"*, *"ya no quiero apartar"*, *"olvídalo"* o *"déjalo así"*, el bot cancela el proceso cortésmente y libera la sesión.

### 4. 💛 Financiamiento Cashea (Regla $25 USD Mínimo)
- Si el producto o combo supera los **$25 USD**, desglosa la cuota inicial y 3 cuotas quincenales a 0% de interés según el nivel del cliente (Nivel 1: 40%, Nivel 2: 30%, Nivel 3+: 20%).
- Si cuesta menos de $25 USD, explica claramente la política y sugiere agregar otro repuesto para alcanzar el monto y financiar en la tienda física.

### 5. 🛵 Delivery en Caracas y Envíos
- Reconoce sectores de la Gran Caracas (San Agustín, Centro, Chacao, Catia, El Valle, Baruta, Petare, etc.) e informa la tarifa estimada de motorizado el mismo día.
- Aclara amablemente que las compras fuera de Caracas se entregan a través de familiares o comisionistas en la capital.

### 6. 🛑 Botón de Pausa (Atención Humana / Asesor)
- **Pausa por Chat:** En la pestaña **Live Inbox**, el asesor puede hacer clic en **Pausar Bot** en cualquier conversación para atender manualmente sin que el bot interfiera.
- **Pausa Global:** En la barra superior hay un botón para silenciar o reanudar el bot en todos los chats cuando sea necesario.
- **Seguimiento inteligente sin spam:** El bot realiza un recordatorio educado pasados 15 minutos solo si el cliente no reservó ni dijo *"no gracias"*.

---

## 🛠️ Herramientas de Mantenimiento y Pruebas

El sistema incluye una suite de diagnóstico, mantenimiento preventivo y verificación de versiones de Node.js:

```bash
# 🔍 Asistente interactivo de mantenimiento (menú visual 0-9)
npm run maintenance

# O ejecutar tareas de mantenimiento específicas directamente:
npm run maintenance -- --diag            # Diagnóstico de salud, puertos y base de datos
npm run maintenance -- --node-check      # Verificar versión de Node.js y compatibilidad LTS
npm run maintenance -- --rebuild-deps    # Re-vincular dependencias tras actualizar Node.js
npm run maintenance -- --clean           # Limpiar mensajes y métricas a 0 operacional
npm run maintenance -- --vacuum          # Desfragmentar y compactar SQLite
npm run maintenance -- --prune-backups   # Depurar respaldos antiguos (> 7 días)
npm run maintenance -- --reset-wa        # Reiniciar sesión WhatsApp para nuevo QR
npm run maintenance -- --build           # Recompilar el panel visual web
npm run maintenance -- --all             # Mantenimiento completo automatizado

# 🧪 Ejecutar suite de pruebas de estrés y validación extrema (200 reqs concurrentes)
npm test
```

---

## 📂 Estructura Limpia del Proyecto

```text
crastur/
├── Crastur.bat                 # Lanzador de 1 clic para Windows
├── launcher.js                 # Verificador inteligente de arranque y auto-respaldo
├── crastur.ico                 # Icono oficial del sistema
├── package.json                # Scripts de inicio, mantenimiento y pruebas
├── scripts/
│   ├── iniciar_crastur.sh      # Lanzador para entornos Linux / macOS
│   ├── maintenance.js          # Script integral de mantenimiento y diagnóstico
│   ├── clean_data.js           # Limpieza operacional a cero
│   └── run_stress_and_edge_tests.js # Batería de estrés y 16 perfiles de clientes
│
├── client/                     # Panel web administrativo (React + Vite)
│   ├── src/                    # Código fuente de vistas responsivas y modales
│   └── dist/                   # Bundle de producción optimizado
│
├── server/                     # Backend modular en Node.js
│   ├── bot/                    # MOTOR MODULAR DEL BOT DE WHATSAPP
│   │   ├── index.js            # Enrutador principal de mensajes y menú 1..6
│   │   ├── apartado/           # Flujo y validaciones de reserva por 24h
│   │   ├── followUp/           # Seguimiento inteligente sin spam
│   │   ├── handlers/           # Manejadores de intención (categorías, cashea, info, etc.)
│   │   ├── services/           # Búsqueda difusa y reglas comerciales
│   │   └── utils/              # Formateadores BCV, delivery de Caracas y anti-spam
│   ├── database.js             # Base de datos SQLite local (sql.js) con auto-respaldos
│   ├── whatsappService.js      # Conexión WhatsApp (Baileys) con reconexión automática
│   ├── bcvService.js           # Sincronización oficial con el BCV
│   └── server.js               # Servidor Express y WebSockets
│
└── data/                       # Datos locales persistentes (NO BORRAR)
    ├── crastur.db              # Base de datos local
    ├── backups/                # Copias de seguridad automáticas diarias
    └── auth_info_baileys/      # Sesión guardada de WhatsApp
```

---

## ❓ Preguntas Frecuentes y Solución de Problemas

### 1. ¿Cómo cambio la tasa del dólar manualmente si no hay internet?
En el panel web, ve a **Configuración** ➔ activa la opción **Tasa Manual Personalizada** ➔ escribe el valor en Bolívares y haz clic en **Guardar Configuración**. El bot comenzará a calcular con ese valor inmediatamente.

### 2. ¿Cómo desvinculo o cambio el número de WhatsApp?
En el panel web, ve a **Conexión WhatsApp** y haz clic en el botón rojo **Desconectar / Reiniciar Sesión** (o ejecuta `npm run maintenance -- --reset-wa`). El sistema borrará las credenciales anteriores y te generará un nuevo código QR limpio para escanear con otra línea.

### 3. ¿Qué hago si actualizo la versión de Node.js en mi computadora?
El sistema Crastur incluye auto-detección y soporte para versiones modernas de Node.js (Node 20, 22 o superior). Si actualizaste Node.js, ejecuta:
```bash
npm run maintenance -- --node-check
npm run maintenance -- --rebuild-deps
```
El script re-vinculará automáticamente las librerías binarias y de WebAssembly para garantizar máxima compatibilidad y estabilidad.

### 4. ¿Dónde están los datos de mis productos y clientes?
Todo se almacena de forma 100% local en tu propia computadora dentro de la carpeta `data/crastur.db`. El sistema crea además copias de seguridad diarias en `data/backups/`, garantizando máxima privacidad sin mensualidades ni dependencias en la nube.
