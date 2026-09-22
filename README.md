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

El bot y el inventario están organizados en 4 líneas comerciales sin mezclar repuestos ajenos:

| Categoría | Productos Principales |
| :--- | :--- |
| 🛞 **Insumos para Caucheras** | Parches en frío/caliente, pega química azul, válvulas sin tripa TR-414, mechas para pinchazos, plomos de balanceo y terrajas. |
| 🏍️ **Repuestos para Moto** | Kits de arrastre (cadena 428H, piñón, corona), pastillas y bandas de freno, bujías de encendido (NGK), aceites 4T/2T, tripas y cauchos. |
| 🎽 **Accesorios para Moto** | Puños para manubrio, mallas porta-casco (pulpos), retrovisores, luces exploradoras LED, fundas y spray para cadena. |
| 📦 **Otros Productos** | Refrigerantes para radiador, limpiadores de inyectores, aditivos de combustible, lubricantes multiuso y bombillos. |

---

## 🤖 Capacidades Inteligentes del Bot

### 1. 🇻🇪 Tasa Oficial BCV en Vivo (Estricta a 2 Decimales)
- Conexión directa al Banco Central de Venezuela. Todos los precios se muestran en dólares (`$ USD`) y en bolívares (`Bs.`) calculados con la tasa del día a dos decimales exactos (ej. *Bs. 854,30 / USD*).
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

## 📂 Estructura Limpia del Proyecto

```text
crastur/
├── Crastur.bat                 # Lanzador de 1 clic para Windows
├── launcher.js                 # Verificador inteligente de arranque y auto-respaldo
├── crastur.ico                 # Icono oficial del sistema
├── scripts/
│   └── iniciar_crastur.sh      # Lanzador para entornos Linux / macOS
│
├── client/                     # Panel web administrativo (React 19 + Vite)
│   ├── src/                    # Código fuente de vistas, modales y componentes
│   └── dist/                   # Versión compilada para producción
│
├── server/                     # Backend modular en Node.js
│   ├── bot/                    # MOTOR MODULAR DEL BOT DE WHATSAPP
│   │   ├── index.js            # Enrutador principal de mensajes
│   │   ├── apartado/           # Flujo y validaciones de reserva por 24 horas
│   │   ├── followUp/           # Seguimiento inteligente sin spam
│   │   ├── handlers/           # Respuestas por intención (productos, cashea, info, etc.)
│   │   ├── services/           # Búsqueda difusa y reglas comerciales
│   │   └── utils/              # Formateadores BCV, delivery de Caracas y anti-spam
│   ├── botEngine.js            # Puente retrocompatible seguro
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
En el panel web, ve a **Conexión WhatsApp** y haz clic en el botón rojo **Desconectar / Reiniciar Sesión**. El sistema borrará las credenciales anteriores y te generará un nuevo código QR limpio para escanear con otra línea.

### 3. Al abrir `Crastur.bat`, la consola dice que no se encuentra Node.js:
Descarga e instala la versión recomendada (LTS) desde el sitio oficial: [nodejs.org](https://nodejs.org). Durante la instalación, asegúrate de dejar marcada la opción que añade Node al `PATH` del sistema.

### 4. ¿Dónde están los datos de mis productos y clientes?
Todo se almacena de forma 100% local en tu propia computadora dentro de la carpeta `data/crastur.db`. El sistema crea además copias de seguridad diarias en `data/backups/`, garantizando máxima privacidad sin mensualidades ni dependencias en la nube.
