# 🛞🏍️ Crastur - Insumos para Caucheras, Repuestos de Moto & Otros Productos

Sistema integral de atención y ventas automatizadas por WhatsApp para **Crastur** (Insumos para Caucheras, Repuestos y Accesorios para Moto y Otros Productos en Caracas). Cuenta con financiamiento **Cashea**, conversión en vivo a Bolívares con tasa oficial del **Banco Central de Venezuela (BCV)** a 2 decimales, motor de apartados por 24 horas, seguimiento automático a clientes y panel administrativo visual con **Live Inbox**, diseñado para ejecutarse localmente con máxima privacidad y sin costos de APIs externas.

---

## 🌟 Características Principales

### 1. 🤖 Motor de WhatsApp Modular e Inteligente (`server/bot/`):
- **Identidad Comercial Definida en 4 Categorías:**
  1. 🛞 **Insumos para Caucheras:** Parches en frío/caliente, pega química azul, válvulas sin tripa TR-414, mechas/tarugos para pinchazos, plomos de balanceo adhesivos y herramientas.
  2. 🏍️ **Repuestos para Moto:** Kits de arrastre (cadena 428H, piñón y corona), pastillas y bandas de freno, bujías de encendido, aceites de motor 4T/2T, tripas y cauchos.
  3. 🎽 **Accesorios para Moto:** Puños para manubrio, mallas porta-casco (pulpos), retrovisores, luces LED y spray para cadena.
  4. 📦 **Otros Productos:** Aceites de motor, refrigerantes para radiador, limpiadores de inyectores, aditivos, bombillos y plumillas.
- **Redacción Callejera Venezolana y Cero Tecnicismos:**
  - Respuestas en lenguaje cotidiano y directo que cualquier cliente entiende al instante, sin tecnicismos confusos.
  - Cero menciones de autos/carros y cero uso de palabras complejas como "misceláneos".
- **Búsqueda Difusa (*Fuzzy Search*) y Cotizador de Combos:**
  - Tolera faltas de ortografía (ej: *"parxhes"*, *"pastiyas"*, *"bujia"*, *"tripa"*, *"kit de arastre"*).
  - Si el cliente consulta varios productos a la vez (ej: *"kit de arrastre bera y aceite 20w50"*), el bot desglosa los subtotales en USD y Bs, calcula el total combinado y permite apartar el combo completo.
- **Tasa Oficial BCV Estricta a 2 Decimales:**
  - Sincronización en vivo con el portal oficial del BCV, formateando siempre a dos decimales (`Bs. 852,42 / USD`) en todos los mensajes y presupuestos.
- **Flujo de Apartados / Reservas por 24 Horas:**
  - Permite al cliente reservar su pieza o combo en caja sin costo:
    1. Captura de Nombre y Apellido.
    2. Cédula de Identidad venezolana (`V-` o `E-`).
    3. Teléfono de contacto nacional (`0412`, `0414`, `0424`, `0416`, `0426`).
    4. Emisión de ticket digital con hora límite estricta de 24 horas continuas de retiro en tienda. Si no se retira, el sistema libera el stock automáticamente.
- **Financiamiento Cashea con Regla de $25 USD Mínimo:**
  - Desglosa inicial y 3 cuotas quincenales a 0% interés.
  - Si el producto cuesta menos de $25, explica de forma proactiva la política y sugiere armar un combo para acceder al financiamiento en la tienda física.
- **Tarifas de Delivery a Toda Caracas:**
  - Detecta sectores (Chacao, Catia, Baruta, El Valle, Petare, etc.) y cotiza las tarifas estimadas de motorizado configuradas en el panel.
- **Orientación Inteligente ante Consultas de Carros:**
  - Si un usuario pregunta por piezas pesadas de motor de carro (como cigüeñales o cajas de velocidad), el bot aclara amablemente la especialidad de Crastur (caucheras, motos y productos como refrigerantes o aceites) para evitar confusiones.

---

### 2. 🖥️ Panel Administrativo (React 19 + Tailwind CSS + Vite):
- **Diseño Ergonómico y Cero Errores Visuales:**
  - Sidebar espaciado con ícono auténtico de motocicleta y distintivo horizontal `MOTO & CAUCHERA`.
  - Header con badges simétricos a la misma altura (40px) y tasa BCV oficial en 2 decimales.
  - Cero bordes blancos involuntarios gracias a tokens oscuros calibrados.
- **Base de Datos Inicial en 0:**
  - El sistema arranca limpio de productos ficticios, con las 4 categorías comerciales preconfiguradas para registrar inventario real con 1 clic.
- **Prevención de Errores Humanos (`ConfirmModal`):**
  - Modales de confirmación antes de eliminar productos, liberar apartados, reiniciar sesiones de WhatsApp o alterar tarifas.
- **Calculadora Cashea Integrada:**
  - Selector con buscador en vivo para cotizar cuotas rápidamente y copiarlas formateadas para WhatsApp.
- **Conexión WhatsApp:**
  - Generador de código QR en pantalla y botón para purgar credenciales viejas y solicitar un QR limpio al instante.

---

### 3. 🛡️ Resiliencia, Privacidad y Rendimiento:
- **Base de Datos SQLite en RAM (`sql.js` WASM):** Consultas en sub-milisegundos, sin bloqueos de disco y con persistencia atómica en `data/crastur.db`.
- **Copias de Seguridad Diarias Automáticas:** Respaldos fechados cada 24 horas en `data/backups/` con rotación automática de 7 días.
- **Blindaje Anti-Caídas:** Monitores de proceso `uncaughtException` y `unhandledRejection` para garantizar que el servidor jamás se detenga ante fallos de red.
- **Protección Anti-Spam:** Detección de ráfagas para proteger la línea contra bloqueos de WhatsApp.

---

## 🧭 Flujo de Decisión del Bot

```mermaid
graph TD
    A[Mensaje entrante de WhatsApp] --> B{¿Bot pausado manualmente?}
    B -- Sí --> C[Silenciar - Asesor atendiendo]
    B -- No --> D{¿Es Spam ráfaga?}
    D -- Sí --> E[Ignorar ráfaga]
    D -- No --> F{¿Es Nota de Voz o Imagen?}
    F -- Sí --> G[Mensaje amable: escribir texto o pedir VENDEDOR]
    F -- No --> H{¿Está en flujo de Apartado?}
    
    H -- Sí --> I[Capturar Nombre -> Cédula -> Teléfono -> Emitir Ticket 24h]
    H -- No --> J{¿Desea Apartar o Reservar?}
    
    J -- Sí --> K{¿Tienda Cerrada y Modo Fuera Horario ON?}
    K -- Sí --> L[Aviso tienda cerrada: Permite consultas, apartado al abrir]
    K -- No --> M[Iniciar Flujo de Apartado]
    
    J -- No --> N{¿Qué intención tiene el cliente?}
    N -- Saludo / Menú --> O[Menú guiado: Cauchera, Moto, Accesorios, Otros Productos, Cashea, Vendedor]
    N -- Búsqueda de Producto --> P[Fuzzy Search -> Ficha con $ USD, Bs BCV 2 decimales y Cashea]
    N -- Pregunta por Cauchera --> Q[Ficha de parches, pegas, válvulas, mechas y plomos]
    N -- Pregunta por Motos --> R[Ficha de kits de arrastre, frenos, bujías, aceites 4T, tripas]
    N -- Pregunta por Piezas de Carro --> S[Aclaratoria amable de rubros que maneja Crastur]
    N -- Pregunta por Cashea --> T[Cálculo inteligente cuotas Niveles 1, 2 y 3+]
    N -- Ubicación / Maps --> U[Dirección física San Agustín y enlace directo Google Maps]
    N -- Delivery / Envíos --> V[Tarifas motorizado por zonas de Caracas]
    N -- Métodos de Pago / Divisas --> W[Pago Móvil, Efectivo con descuento en divisas y Cashea]
    N -- Hablar con Vendedor --> X[Contacto directo con asesor humano]
    N -- Sin coincidencia --> Y[Mensaje orientador para guiar al cliente]
```

---

## 📁 Estructura del Proyecto

```text
crastur/
├── Crastur.bat                 # EJECUTABLE MAESTRO (Windows 1-clic con auto-instalación)
├── Crear-Acceso-Directo.bat    # Crea el acceso directo en el Escritorio con crastur.ico
├── Iniciar-Crastur.ps1         # Lanzador alternativo para PowerShell en Windows
├── crastur.ico                 # Icono oficial de Windows (resoluciones de 16x16 a 256x256)
├── iniciar_crastur.sh          # Lanzador ejecutable para Linux / macOS
├── launcher.js                 # Verificador inteligente y lanzador multiplataforma
├── .gitattributes              # Control estricto de finales de línea CRLF/LF
│
├── client/                     # Panel Web Administrativo (React 19, Tailwind CSS, Vite)
│   ├── public/
│   │   ├── favicon.svg         # Favicon oficial con isotipo de moto en relieve
│   │   └── favicon.ico         # Favicon estándar para navegadores
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar (espaciado estético) y Header (simetría)
│   │   │   ├── views/          # CatalogView, ReservationsView, DashboardView, SettingsView, etc.
│   │   │   └── modals/         # ProductModal, ConfirmModal, SellerModal, ReservationModal
│   │   └── constants/          # categories.js (4 categorías oficiales y subcategorías)
│   └── dist/                   # Build compilado de producción (generado con npm run build)
│
├── server/                     # Backend local en Node.js
│   ├── bot/                    # MOTOR MODULAR DEL BOT DE WHATSAPP
│   │   ├── index.js            # Enrutador principal de mensajes
│   │   ├── config/             # synonyms.js (callejero venezolano), stopWords.js
│   │   ├── utils/              # formatters.js (BCV 2 decimales), caracasDelivery.js, antiSpam.js
│   │   ├── services/           # searchService.js, businessRules.js
│   │   ├── handlers/           # greeting, info, product, cashea, advisory, fallback
│   │   └── apartado/           # apartadoFlow.js (Embudo 24h)
│   ├── database.js             # SQLite WASM, migraciones, PRAGMA checks y respaldos 7 días
│   ├── whatsappService.js      # Baileys WhatsApp con debounce por cliente y reconexión
│   ├── bcvService.js           # Scraping oficial del BCV en vivo
│   └── server.js               # Servidor Express, WebSocket y servidor de interfaz
│
└── data/                       # Almacenamiento local persistente
    ├── crastur.db              # Base de datos SQLite
    ├── backups/                # Respaldos diarios rotativos
    └── auth_info_baileys/      # Sesión vinculada de WhatsApp
```

---

## 💻 Requisitos Previos

* **Node.js (Versión LTS 18 o superior):**
  Descárgalo e instálalo gratis desde el sitio oficial: [https://nodejs.org](https://nodejs.org).
  *(Asegúrate de marcar la casilla para agregarlo al `PATH` durante la instalación).*

---

## 🚀 Cómo Iniciar el Sistema

### 🪟 En Windows (Usuarios Finales - Recomendado):

> [!IMPORTANT]
> **Paso previo en Windows 11 (Desbloquear archivos descargados):**
> Si descargaste el proyecto en un archivo comprimido o desde internet, Windows 11 (*Smart App Control / SmartScreen*) puede bloquear archivos `.bat`.
> 1. Haz clic derecho sobre **`Crastur.bat`** ➔ **Propiedades**.
> 2. En la pestaña **General**, abajo del todo en la sección *Seguridad*, marca la casilla **☑ Desbloquear** (*Unblock*).
> 3. Haz clic en **Aplicar** y luego en **Aceptar**. *(Haz lo mismo con `Crear-Acceso-Directo.bat`)*.
>
> *Alternativa en PowerShell:* En la carpeta del proyecto ejecuta: `dir | Unblock-File`

#### Método 1: Doble clic directo
* Haz doble clic en **`Crastur.bat`**.
* El sistema comprobará Node.js, instalará las dependencias necesarias, compilará el panel visual y abrirá la ventana de la aplicación automáticamente.

#### Método 2: Acceso directo en el Escritorio
* Haz doble clic en **`Crear-Acceso-Directo.bat`**.
* Creará inmediatamente un acceso directo en tu Escritorio con el ícono oficial de Crastur para abrir el sistema con un clic en cualquier momento.

#### Método 3: Lanzador alternativo PowerShell
* Clic derecho en **`Iniciar-Crastur.ps1`** ➔ **Ejecutar con PowerShell**.

---

### 👨‍💻 En el Editor de Código (VS Code / Cursor / Terminal):

Si eres desarrollador o deseas ejecutar el sistema desde la terminal de tu editor:

1. **Abre la terminal en la raíz del proyecto** (donde está el archivo `package.json` principal).
2. **Instala las dependencias:**
   ```bash
   npm install
   ```
3. **Compila la interfaz visual:** *(Paso obligatorio para generar la carpeta `client/dist`)*
   ```bash
   npm run build
   ```
4. **Inicia el sistema:**
   ```bash
   npm run launch
   # o alternativamente:
   npm start
   ```
5. Abre en tu navegador: **`http://localhost:3333`**.

---

### 🐧 En Linux / macOS:

```bash
chmod +x iniciar_crastur.sh
./iniciar_crastur.sh
```

---

## 📲 Vincular WhatsApp por Primera Vez

1. Abre el panel web en tu computadora (**`http://localhost:3333`**).
2. Ve al menú lateral y haz clic en **Conexión WhatsApp**.
3. En tu teléfono móvil, abre WhatsApp ➔ Menú de tres puntos (o Ajustes) ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
4. Escanea el código QR que se muestra en el panel administrativo.
5. ¡Listo! El sistema confirmará la conexión con el badge verde de **Conectado** y comenzará a atender clientes de forma automática.

---

## 🛠️ Solución de Problemas Frecuentes (FAQ / Troubleshooting)

> [!WARNING]
> ### 1. Al abrir `Crastur.bat`, Windows muestra: *"Smart App Control blocked a file that may be unsafe"*
> **Causa:** Medida de protección de Windows 11 para archivos `.bat` descargados de internet.  
> **Solución:** Clic derecho sobre `Crastur.bat` ➔ **Propiedades** ➔ Marcar la casilla **Desbloquear** abajo ➔ **Aplicar** y **Aceptar**.

> [!NOTE]
> ### 2. El navegador muestra pantalla en blanco con *"Cannot GET /"*
> **Causa:** Se inició el servidor backend (`node server/server.js`) pero la interfaz visual aún no ha sido compilada.  
> **Solución:** Abre la terminal en la raíz del proyecto y ejecuta `npm run build`. Luego recarga el navegador. *(Si inicias con `Crastur.bat`, este paso se hace automáticamente).*

> [!NOTE]
> ### 3. Error en terminal: *"npm error enoent: Could not read package.json"*
> **Causa:** La consola se abrió en tu carpeta de usuario personal (ej. `C:\Users\tu-nombre>`) en lugar de la carpeta del proyecto.  
> **Solución:** Navega hasta la carpeta del proyecto antes de ejecutar comandos:
> ```cmd
> cd ruta\donde\esta\crastur
> npm install
> ```

> [!NOTE]
> ### 4. Error: *"[ERROR] No se encontro Node.js instalado en esta computadora"*
> **Causa:** Node.js no está instalado o no se encuentra en las variables de entorno del sistema.  
> **Solución:** Descarga e instala Node.js LTS desde [nodejs.org](https://nodejs.org). Si ya lo instalaste, cierra todas las ventanas de consola o reinicia tu equipo para que Windows actualice la variable `PATH`.

