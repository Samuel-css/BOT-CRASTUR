# 🛞🏍️ Crastur - Sistema de Ventas y Bot de WhatsApp

Sistema automatizado de atención al cliente, cotización y ventas para **Crastur**, tienda física en Caracas especializada en insumos para caucheras, repuestos y accesorios para moto, lubricantes y productos de mantenimiento.

Incluye conversión en tiempo real a Bolívares con tasa oficial del **Banco Central de Venezuela (BCV)** a 2 decimales, **Calculadora Cashea con Constructor de Combos ($25 USD mínimo)**, control de **horarios de semana y domingos (cierre temprano)**, motor de **apartados por 24 horas**, seguimiento automático educado, gestión de asesores humanos y panel administrativo web con simulador de WhatsApp en vivo.

---

## ⚠️ LO MÁS IMPORTANTE QUE DEBES SABER (Léelo primero)

**Crastur es un sistema 100% local.** Toda la inteligencia del bot, la base de datos y la sesión
de WhatsApp viven en **tu propia computadora**. Esto tiene ventajas enormes (tus datos son tuyos,
no pagas mensualidades), pero también una regla de oro:

> 🔴 **Si la computadora está APAGADA, el bot NO responde a ningún cliente.**
> Los clientes pueden seguir escribiendo, pero nadie contestará hasta que
> **enciendas la PC** y el sistema vuelva a estar encendido.

Por eso, para una atención sin interrupciones:

- ✅ **Deja la computadora ENCENDIDA** durante todo el horario de la tienda (idealmente 24/7).
- ✅ Crastur **se recupera solo**: si la PC se apaga y vuelves a encender, el sistema retoma
  los apartados, repone el stock vencido y sigue funcionando con normalidad.
- ✅ Con la PC encendida, el bot atiende **incluso fuera del horario de tienda** (responde precios,
  catálogo y tasa BCV, y avisa cuándo abre la tienda para retiros y apartados).
- 💡 Si la PC estuvo apagada varias horas, revisa el panel al encender: puede haber mensajes
  de clientes que quedaron sin respuesta en ese lapso.

---

## 🚀 Cómo Iniciar, Instalar y Respaldar (Sin Consola ni Editor)

El sistema está diseñado para que cualquier persona en la tienda, sin conocimientos técnicos, pueda
instalarlo, encenderlo, respaldarlo y apagarlo con simples clics.

### 🟢 INSTALACIÓN Y MANTENIMIENTO VISUAL (RECOMENDADO)

Haz doble clic en **`Instalar.bat`** (Windows) o ejecuta `npm run instalar`. Se abrirá en tu navegador
un **Panel de Instalación y Mantenimiento** con botones, donde puedes:

- ▶ **Instalar / Verificar Sistema**: revisa e instala todo lo necesario (servidor, panel, datos).
- 🖥️ **Actualizar Panel Visual**: recompila la interfaz tras una actualización.
- 💾 **Crear Respaldo**: guarda tu **Catálogo + Asesores** en un archivo portable (entre versiones).
- 📂 **Ver Respaldos y Restaurar**: lista tus respaldos guardados y restáuralos con un clic.
- 🚀 **Iniciar Crastur**: arranca el sistema y abre el panel administrativo.

> No necesitas escribir ni un solo comando. Todo se controla desde botones en el navegador.

### 🟢 ENCENDIDO DIARIO

#### 🪟 En Windows:
1. **Primera vez:** doble clic en **`Crastur.bat`**. Si el sistema aún no está instalado, abrirá
   automáticamente el **Instalador Visual**. Una vez listo, crea el acceso directo **`Crastur`** en el Escritorio.
2. **Día a día:** el cliente solo hace doble clic en el acceso directo **`Crastur`** de su Escritorio.
   - **Si está apagado:** inicia el bot y el servidor en segundo plano y abre el navegador en `http://localhost:3333`.
   - **Si ya estaba encendido:** detecta la sesión activa y solo reabre la pestaña.

> [!TIP]
> **Si Windows 11 o SmartScreen bloquea el archivo la primera vez:**  
> Clic derecho en el archivo (`Crastur.bat` o `Instalar.bat`) ➔ **Propiedades** ➔ Marca la casilla **☑ Desbloquear** ➔ **Aceptar**.

#### 🐧 En Linux / macOS:
```bash
./crastur.sh        # Arranca el sistema
npm run instalar    # Abre el panel visual de instalación y respaldos
```

---

### 🛑 CÓMO APAGAR CRASTUR:

Al apagar el sistema se guarda la base de datos de inmediato (`persistDB()`), se desconecta la sesión de WhatsApp de forma limpia y se libera el puerto `3333`.

1. **🔴 Desde la propia Interfaz Web (Oficial y más cómoda):**  
   En la barra superior del panel (esquina superior derecha, al lado del botón de WhatsApp), haz clic en el botón rojo **"Apagar"**.  
   Aparecerá un mensaje de confirmación de seguridad. Al confirmar:
   - Se guarda la base de datos y se detiene el servidor.
   - La pantalla muestra una confirmación de apagado y **puedes cerrar la pestaña con total tranquilidad sin afectar tus demás pestañas del navegador**.
2. **🛠️ Herramienta de Apagado de Emergencia (Para técnicos):**  
   - **Terminal (cualquier sistema):** Ejecutar `npm run stop`.

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
| 🪖 **Accesorios Moto** | Puños para manubrio, mallas porta-casco (pulpos), retrovisores, luces exploradoras LED, fundas y spray para cadena. |
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
# 🧪 Ejecutar suite de estrés y validación extrema (202 pruebas del bot)
# Corre sobre una base de datos temporal: NO toca el catálogo real ni los respaldos.
npm test

# 🖥️ Ejecutar pruebas E2E de la interfaz web (18 pruebas en Chrome headless)
npm run test:ui

# 📦 Preparar el sistema para entrega u otra PC (100% limpio)
# Sin argumentos solo previsualiza; con --confirmar ejecuta la limpieza.
npm run preparar-entrega
npm run preparar-entrega -- --confirmar

# 🔄 Restablecimiento limpio de fábrica (Opción A: 0 productos para producción)
npm run reset

# 🧹 Limpieza operacional (mensajes y métricas a cero)
npm run clean

# 💾 Exportar Catálogo + Asesores a un respaldo portable
npm run migrar -- --db "data/crastur.db" --out "data/backups/catalogo.json"

# ↩️ Restaurar Catálogo + Asesores desde un respaldo portable
npm run migrar -- --db "data/crastur.db" --in "data/backups/catalogo.json"

# 🖥️ Recompilar el panel visual web
npm run build

# 🧪 Verificar tipos del servidor / compilar backend
npm run typecheck:server
npm run build:server

# 🛑 Apagar el sistema de forma segura
npm run stop
```

> **Nota:** `npm test` y `npm run test:ui` se ejecutan sobre una **base de datos temporal aislada**, por lo que **no modifican** tu catálogo, tus chats, tus respaldos ni la sesión de WhatsApp reales.

---

## 📂 Estructura del Proyecto

```text
crastur/
├── Crastur.bat                 # Lanzador principal de 1 clic para Windows
├── Crastur_SegundoPlano.vbs    # Lanzador silencioso en segundo plano para Windows
├── launcher.js                 # Verificador inteligente de arranque y auto-respaldo
├── crastur.ico                 # Icono oficial del sistema
├── Instalar.bat                # Instalador visual de 1 clic para Windows
├── package.json                # Scripts de inicio, mantenimiento y pruebas
├── installer/
│   └── server.js               # Panel de Instalación y Mantenimiento (navegador)
├── scripts/
│   ├── reset_clean_install.ts  # Reseteo de fábrica para producción limpia (0 productos)
│   ├── preparar_entrega.ts     # Limpieza total para copiar a otra PC / entregar (npm run preparar-entrega)
│   ├── clean_data.ts           # Limpieza operacional a cero
│   ├── migrar_catalogo_asesores.ts # Respaldo/restauración de catálogo y asesores
│   ├── run_stress_and_edge_tests.ts # Batería de estrés y 202 pruebas del bot
│   ├── run_stress_and_edge_tests_isolated.js # Runner que ejecuta las pruebas en BD temporal
│   └── run_ui_e2e_tests.ts      # Pruebas E2E de la interfaz web (Chrome headless)
│
├── client/                     # Panel web administrativo (React + Vite + TailwindCSS)
│   ├── src/                    # Código fuente de vistas responsivas y modales
│   └── dist/                   # Bundle de producción optimizado
│
├── server/                     # Backend modular en Node.js + TypeScript
│   ├── bot/                    # MOTOR MODULAR DEL BOT DE WHATSAPP
│   │   ├── index.ts            # Enrutador principal de mensajes y menú 1..6
│   │   ├── config/             # Sinónimos, stop-words y agrupación canónica de categorías
│   │   ├── router/             # Guardas de seguridad y comandos transversales
│   │   ├── apartado/           # Flujo y validaciones de reserva por 24h
│   │   ├── followUp/           # Seguimiento inteligente sin spam
│   │   ├── handlers/           # Manejadores de intención (categorías, cashea, info, etc.)
│   │   ├── services/           # Búsqueda difusa y reglas comerciales (horarios domingo/semana)
│   │   └── utils/              # Formateadores BCV, delivery de Caracas y anti-spam
│   ├── db/                     # Módulos de acceso a datos (catálogo, reservas, respaldos...)
│   ├── whatsapp/               # Conexión Baileys modular (conexión, envío, ingesta...)
│   ├── routes/                 # API REST modular (productos, apartados, ajustes...)
│   ├── database.ts             # Base de datos SQLite local (sql.js) con auto-respaldos
│   ├── whatsappService.ts      # Fachada de la conexión WhatsApp (Baileys)
│   ├── bcvService.ts           # Sincronización oficial con el BCV
│   └── server.ts               # Servidor Express y WebSockets
│
└── data/                       # Datos locales persistentes (NO BORRAR)
    ├── crastur.db              # Base de datos local
    ├── backups/                # Copias de seguridad automáticas diarias
    └── auth_info_baileys/      # Sesión guardada de WhatsApp
```

---

## ❓ Preguntas Frecuentes

### 1. ¿El sistema viene vacío o con productos de prueba?
Siguiendo la **Opción A**, el sistema de producción se entrega **100% limpio** (0 productos, 0 chats y 0 apartados) para que la tienda física cargue sus repuestos reales directamente desde el menú Catálogo o mediante importación.

- **Descargando desde Git** (clonado o RAR/ZIP del repositorio): arranca **limpio automáticamente**, porque la base de datos, los respaldos y la sesión de WhatsApp están excluidos del repositorio (`.gitignore`). No hay que hacer nada.
- **Copiando la carpeta a mano a otra PC**: primero ejecuta `npm run preparar-entrega -- --confirmar` en la PC de origen. Ese comando respalda los datos fuera del proyecto y deja la instalación limpia (0 productos, sin chats, sin respaldos y sin la sesión de WhatsApp).
- **Para volver a cero en cualquier momento**: ejecuta `npm run reset`.

### 2. ¿Qué pasa si la tienda abre un domingo y cierra más temprano?
En **Configuración** ➔ **1. Mi Tienda & Horario**, puedes seleccionar el preset oficial **Horario Completo Crastur** (`Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM`) o personalizar las horas exactas de apertura y cierre para domingos. El bot respetará el horario de forma autónoma.

### 3. ¿Cómo calculo una venta Cashea si los repuestos cuestan menos de $25 USD?
Ingresa a **Calculadora Cashea** ➔ pestaña **Elegir o Combinar Repuestos del Catálogo**. Selecciona los repuestos que el cliente llevará (aceite, bujías, parches, etc.) y presiona **"Sumar a Combo Cashea"**. La barra te indicará cuánto falta para los $25 USD y al alcanzarlos podrás copiar la cotización oficial lista para WhatsApp.

### 4. ¿Dónde se guardan los datos de mis clientes y precios?
Todo se almacena de forma **100% local y soberana** en tu propia computadora dentro de `data/crastur.db`. No requiere servidores en la nube ni pagos de mensualidades, y cuenta con copias de seguridad diarias en `data/backups/`.

### 5. ¿Qué pasa si apago la computadora de la tienda?
El bot deja de responder mientras esté apagada. Al volver a encender, **Crastur se recupera solo**:

- Los **apartados** se recalculan con la hora real: los que cumplieron 24 horas pasan a *vencido* y su stock vuelve al inventario; los que cumplieron 36 horas se depuran.
- Los **seguimientos** y avisos que iban a enviarse mientras estaba apagada pueden no enviarse; conviene revisar el **Live Inbox** al encender.
- La **tasa BCV** se vuelve a sincronizar automáticamente al encender.

> Recomendación: deja la PC encendida durante el horario de tienda para no perder clientes.

### 6. ¿El bot responde de noche o los domingos cuando la tienda está cerrada?
Sí, **mientras la PC esté encendida**. Atiende consultas de catálogo, precios y tasa BCV 24/7, y aclara a qué hora abre la tienda física para retiros y apartados. Si quieres que solo atienda dentro del horario, puedes activar el mensaje de fuera de horario en **Configuración**.

### 7. ¿Cómo sé qué repuestos me faltan por cargar?
En el **Dashboard** verás la tarjeta **"Inventario por Línea Comercial"**: muestra cuántos productos tienes en cada categoría y marca en amarillo las que están **sin productos**, para que sepas qué falta cargar.

---

## 🧯 Solución de Problemas Rápidos

| Síntoma | Causa probable | Solución |
| :--- | :--- | :--- |
| **La página no carga / "Cannot GET"** | El sistema no está encendido o hay un proceso viejo ocupando el puerto | Cierra todas las pestañas, ejecuta `npm run stop` y vuelve a abrir el acceso directo **Crastur** |
| **El bot no responde** | La PC está apagada, el bot está pausado globalmente, o WhatsApp no está vinculado | Enciende la PC, revisa **Conexión WhatsApp** (debe estar verde) y que la pausa global esté desactivada |
| **El QR no aparece** | La sesión de WhatsApp se desvinculó | En **Conexión WhatsApp**, pulsa **"Nuevo QR Limpio"** y escanea de nuevo |
| **Los precios en Bs. se ven viejos** | La PC estuvo apagada y aún no sincronizó el BCV | Espera un minuto (se sincroniza solo) o revisa el widget de tasa en la barra superior |
| **No responde a un cliente específico** | Se activó "Pausar Bot (Atender Yo)" en ese chat | En el **Live Inbox**, abre el chat y pulsa **"Reanudar Bot"** |
| **Faltan productos en el menú del bot** | La categoría del producto usa una subcategoría no reconocida | Verifica la categoría en **Catálogo**; las 4 líneas canónicas son: Insumos Cauchera, Repuestos Moto, Accesorios Moto, Otros Productos |

---

## 🧑🍳 Uso Diario Recomendado (Rutina de la Tienda)

**Al abrir la tienda (mañana):**
1. Enciende la PC (si estaba apagada).
2. Doble clic en el acceso directo **Crastur**.
3. Verifica que el indicador de **WhatsApp** esté **verde (En Línea)** en la barra superior.
4. Mira el **Dashboard**: apartados activos, stock bajo y categorías sin productos.

**Durante el día:**
- Revisa el **Live Inbox** para atender consultas y tomar el control cuando haga falta.
- Usa la **Calculadora Cashea** para armar combos y enviar cotizaciones por WhatsApp.

**Al cerrar (o al final del día):**
- Puedes **dejar la PC encendida** (recomendado para no perder clientes nocturnos) o apagar con el botón rojo **"Apagar"** del panel.

> El sistema se entrega con **0 productos** para que cargues tu inventario real desde el menú **Catálogo**.
