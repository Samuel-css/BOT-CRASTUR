# 🛞🏍️ Crastur - Sistema de Ventas y Bot de WhatsApp

Sistema automatizado de atención al cliente, cotización y ventas para **Crastur**, tienda física en Caracas especializada en insumos para caucheras, repuestos y accesorios para moto, lubricantes y productos de mantenimiento.

Incluye conversión en tiempo real a Bolívares con tasa oficial del **Banco Central de Venezuela (BCV)** a 2 decimales, **Calculadora Cashea con Constructor de Combos ($25 USD mínimo)**, control de **horarios de semana y domingos (cierre temprano)**, motor de **apartados por 24 horas**, seguimiento automático educado, gestión de asesores humanos y panel administrativo web con simulador de WhatsApp en vivo.

---

## 🚀 Cómo Iniciar y Apagar el Sistema (1 Solo Clic)

El sistema está diseñado para que cualquier persona en la tienda, sin conocimientos técnicos, pueda encenderlo y apagarlo de forma rápida, limpia y segura:

### 🟢 CÓMO ABRIR CRASTUR:

#### 🪟 En Windows:
1. **Primera vez (Instalación):**  
   Haz doble clic en **`Crastur.bat`**. Comprobará el sistema, verificará la base de datos y **creará automáticamente 1 único acceso directo oficial en el Escritorio de Windows**:
   - 🛞 **`Crastur`** (con el icono oficial naranja de la tienda).
2. **Día a día del cliente:**  
   ¡Listo! El cliente **solo hace doble clic en el acceso directo `Crastur` de su Escritorio**.  
   - **Si está apagado:** Inicia el bot y el servidor silenciosamente en segundo plano sin dejar ventanas negras de consola abiertas, y abre de inmediato el navegador en `http://localhost:3333`.
   - **Si ya estaba encendido (ej. cerraron la pestaña por descuido):** Detecta la sesión activa y **simplemente reabre la pestaña en el navegador**, sin dar errores de puerto ocupado.

> [!TIP]
> **Si Windows 11 o SmartScreen bloquea el archivo la primera vez:**  
> Clic derecho en el archivo (`Crastur.bat`) ➔ **Propiedades** ➔ Marca la casilla **☑ Desbloquear** abajo ➔ Clic en **Aceptar**.

#### 🐧 En Linux / macOS:
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
./crastur.sh
# O alternativamente:
npm start
```
Luego el navegador se abrirá en **`http://localhost:3333`**.

---

### 🛑 CÓMO APAGAR CRASTUR:

Al apagar el sistema se guarda la base de datos de inmediato (`persistDB()`), se desconecta la sesión de WhatsApp de forma limpia y se libera el puerto `3333`.

1. **🔴 Desde la propia Interfaz Web (Oficial y más cómoda):**  
   En la barra superior del panel (esquina superior derecha, al lado del botón de WhatsApp), haz clic en el botón rojo **"Apagar"**.  
   Aparecerá un mensaje de confirmación de seguridad. Al confirmar:
   - Se guarda la base de datos y se detiene el servidor.
   - La pantalla muestra una confirmación de apagado y **puedes cerrar la pestaña con total tranquilidad sin afectar tus demás pestañas del navegador**.
2. **🛠️ Herramientas de Apagado de Emergencia (Para técnicos):**  
   - **Windows:** Ejecutar `scripts/apagar_servidor.bat`.  
   - **Linux / macOS:** Ejecutar `scripts/apagar_servidor.sh`.  
   - **Terminal:** Ejecutar `npm run stop`.

---

### 💻 Desde la Terminal de Desarrollador (VS Code / Cursor):
```bash
# 1. Instalar dependencias
npm install

# 2. Compilar panel visual (Vite)
npm run build

# 3. Iniciar el sistema
npm start
```

---

## 📲 Cómo Vincular WhatsApp

1. Abre el panel administrativo en **`http://localhost:3333`**.
2. En el menú lateral izquierdo, haz clic en **Conexión WhatsApp**.
3. En tu teléfono celular, abre WhatsApp ➔ menú de 3 puntos (o Ajustes) ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
4. Apunta la cámara de tu celular y escanea el código **QR** que aparece en pantalla.
5. Una vez conectado, el panel mostrará el estado en verde **Conectado** y el bot comenzará a responder automáticamente a los clientes.

---

## 🗂️ Las 4 Categorías Comerciales de Crastur

El bot y el inventario están organizados en 4 líneas comerciales maestras sin mezclar repuestos ajenos ni duplicar filtros:

| Categoría | Productos Principales |
| :--- | :--- |
| 🛞 **Insumos Cauchera** | Parches en frío/caliente Tip Top, pega química azul, válvulas sin tripa TR-412/TR-414, mechas para pinchazos, plomos de balanceo y terrajas. |
| 🏍️ **Repuestos Moto** | Kits de arrastre reforzados (cadena 428H, piñón, corona), pastillas y bandas de freno, bujías de encendido (NGK), repuestos de motor y tripas aro 18/17. |
| 🎽 **Accesorios Moto** | Puños para manubrio, mallas porta-casco (pulpos), retrovisores, luces exploradoras LED, fundas y spray para cadena. |
| 📦 **Otros Productos** | Aceites de motor 4T/2T (Motul 20W50), refrigerantes para radiador, limpiadores de inyectores, aditivos de combustible y bombillos. |

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

### 1. 🕒 Horario Crastur: Semana vs. Cierre Temprano Dominical
- **Horario Predeterminado Oficial:** `Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM`.
- **Motor Horario Inteligente (`businessRules.js`):**
  - Evalúa la hora oficial en zona de Caracas (UTC-4).
  - De lunes a sábado opera en horario corrido (8:00 AM a 8:00 PM).
  - Los domingos aplica el horario especial de cierre temprano (8:30 AM a 2:00 PM) o cerrado si el comerciante lo configura así.
  - **Atención Continua 24/7:** Si el cliente escribe de noche o un domingo en la tarde, el bot responde cordialmente dudas de catálogo, precios y tasa BCV, e indica con precisión a qué hora abre la tienda física para retiros y apartados.

### 2. 💛 Calculadora Cashea y Constructor de Combos ($25 USD Mínimo)
- **Regla Oficial Cashea:** El financiamiento en 3 cuotas sin interés aplica en tienda física para compras a partir de **$25 USD**.
- **Constructor de Combos en el Panel:**
  - Si un repuesto cuesta menos de $25 USD (ej. aceite a $6 o bujía a $3.50), el vendedor puede sumar cantidades con `[-] [qty] [+]` o pulsar **"Sumar a Combo Cashea"** para armar un paquete personalizado.
  - **Barra de Progreso Dinámica:** Muestra en tiempo real cuánto dinero falta para alcanzar los $25 USD y chips con sugerencias rápidas.
  - **Cotización para WhatsApp en 1 Clic:** Genera un mensaje detallado con subtotales, total en $ y Bs, inicial según el nivel del cliente (Nivel 1: 40%, Nivel 2: 30%, Nivel 3+: 20%), 3 cuotas quincenales exactas y dirección para retirar en San Agustín Norte.

### 3. 🇻🇪 Tasa Oficial BCV en Vivo (Estricta a 2 Decimales)
- Conexión directa y automática al Banco Central de Venezuela. Todos los precios se muestran en dólares (`$ USD`) y en bolívares (`Bs.`) calculados con la tasa del día oficial (sin recargos punitivos).
- Resalta siempre el beneficio del **precio especial con descuento directo pagando en efectivo en divisas** en tienda física.

### 4. 🛒 Búsqueda Difusa (*Fuzzy Search*) y Venezolanismos
- Si el cliente escribe con faltas de ortografía o modismos (*"chamo tienes pastiyas y bujya?"*), el motor identifica los repuestos exactos sin mezclar categorías ajenas.

### 5. ⏱️ Flujo de Apartado por 24 Horas sin Costo
- Los clientes pueden reservar repuestos para retirar en tienda física en San Agustín Norte:
  1. **Nombre y Apellido:** Validación de persona real (rechaza apodos).
  2. **Cédula de Identidad:** Validación venezolana (`V-` o `E-`).
  3. **Teléfono de Contacto:** Normalización a formato nacional (`0412`, `0414`, `0424`, `0416`, `0426`).
  4. **Emisión de Comprobante:** Genera un ticket digital oficial con código único `CRA-` y fecha límite estricta de 24 horas continuas más 12 horas de gracia.
- **Protección de Datos:** Incorpora leyenda legal conforme al **Art. 28 de la CRBV**.

### 6. 🛵 Delivery en Caracas y Métodos de Pago
- Reconoce sectores de la Gran Caracas (San Agustín, Centro, Chacao, Catia, El Valle, Baruta, Petare, etc.) e informa tarifas estimadas de motorizado.
- Métodos configurables con tarjetas interactivas de encendido/apagado en 1 clic (Efectivo $, Binance USDT, Pago Móvil BCV, Cashea, Punto de Venta y Transferencia).

---

## 🛠️ Herramientas de Mantenimiento y Pruebas

El sistema incluye comandos dedicados para mantenimiento, diagnóstico y verificación:

```bash
# 🧪 Ejecutar suite de pruebas de estrés y validación extrema (68 pruebas automáticas)
npm test

# 🔄 Restablecimiento limpio de fábrica (Opción A: 0 productos para producción)
npm run reset

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
```

---

## 📂 Estructura del Proyecto

```text
crastur/
├── Crastur.bat                 # Lanzador principal de 1 clic para Windows
├── Crastur_SegundoPlano.vbs    # Lanzador silencioso en segundo plano para Windows
├── launcher.js                 # Verificador inteligente de arranque y auto-respaldo
├── crastur.ico                 # Icono oficial del sistema
├── package.json                # Scripts de inicio, mantenimiento y pruebas
├── scripts/
│   ├── reset_clean_install.js  # Reseteo de fábrica para producción limpia (0 productos)
│   ├── maintenance.js          # Script integral de mantenimiento y diagnóstico
│   ├── clean_data.js           # Limpieza operacional a cero
│   └── run_stress_and_edge_tests.js # Batería de estrés y 68 pruebas automatizadas
│
├── client/                     # Panel web administrativo (React + Vite + TailwindCSS)
│   ├── src/                    # Código fuente de vistas responsivas y modales
│   └── dist/                   # Bundle de producción optimizado
│
├── server/                     # Backend modular en Node.js
│   ├── bot/                    # MOTOR MODULAR DEL BOT DE WHATSAPP
│   │   ├── index.js            # Enrutador principal de mensajes y menú 1..6
│   │   ├── apartado/           # Flujo y validaciones de reserva por 24h
│   │   ├── followUp/           # Seguimiento inteligente sin spam
│   │   ├── handlers/           # Manejadores de intención (categorías, cashea, info, etc.)
│   │   ├── services/           # Búsqueda difusa y reglas comerciales (horarios domingo/semana)
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

## ❓ Preguntas Frecuentes

### 1. ¿El sistema viene vacío o con productos de prueba?
Siguiendo la **Opción A**, el sistema de producción se entrega **100% limpio** (0 productos, 0 chats y 0 apartados) para que la tienda física cargue sus repuestos reales directamente desde el menú Catálogo o mediante importación. Para volver a este estado inicial en cualquier momento, basta con ejecutar `npm run reset`.

### 2. ¿Qué pasa si la tienda abre un domingo y cierra más temprano?
En **Configuración** ➔ **1. Mi Tienda & Horario**, puedes seleccionar el preset oficial **Horario Completo Crastur** (`Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM`) o personalizar las horas exactas de apertura y cierre para domingos. El bot respetará el horario de forma autónoma.

### 3. ¿Cómo calculo una venta Cashea si los repuestos cuestan menos de $25 USD?
Ingresa a **Calculadora Cashea** ➔ pestaña **Elegir o Combinar Repuestos del Catálogo**. Selecciona los repuestos que el cliente llevará (aceite, bujías, parches, etc.) y presiona **"Sumar a Combo Cashea"**. La barra te indicará cuánto falta para los $25 USD y al alcanzarlos podrás copiar la cotización oficial lista para WhatsApp.

### 4. ¿Dónde se guardan los datos de mis clientes y precios?
Todo se almacena de forma **100% local y soberana** en tu propia computadora dentro de `data/crastur.db`. No requiere servidores en la nube ni pagos de mensualidades, y cuenta con copias de seguridad diarias en `data/backups/`.
