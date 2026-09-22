# 🇻🇪 Guía Integral de Entrega, Marco Legal en Venezuela y Manual de Operaciones - Crastur

Este documento constituye la documentación formal de entrega del sistema **Crastur - Sistema de Ventas y Bot de WhatsApp para Tiendas de Repuestos e Insumos**. Ha sido redactado para servir como manual operativo para el comerciante y como dictamen técnico-jurídico que respalda la legalidad y libre distribución del producto en la República Bolivariana de Venezuela.

---

## 📑 ÍNDICE
1. [Dictamen de Cumplimiento Legal en Venezuela](#1-dictamen-de-cumplimiento-legal-en-venezuela)
2. [Términos de WhatsApp (Meta) y Blindaje Anti-Baneo](#2-términos-de-whatsapp-meta-y-blindaje-anti-baneo)
3. [Manual Operativo para el Cliente (Paso a Paso)](#3-manual-operativo-para-el-cliente-paso-a-paso)
4. [Gestión de Inventario, Apartados y Ciclo de Gracia (24h + 12h)](#4-gestión-de-inventario-apartados-y-ciclo-de-gracia-24h--12h)
5. [Uso del Live Inbox (Atención Humana / Human Takeover)](#5-uso-del-live-inbox-atención-humana--human-takeover)
6. [Respaldo, Importación y Mantenimiento de Base de Datos](#6-respaldo-importación-y-mantenimiento-de-base-de-datos)
7. [Contrato de Licenciamiento y Acta de Entrega de Software](#7-contrato-de-licenciamiento-y-acta-de-entrega-de-software)

---

## 1. DICTAMEN DE CUMPLIMIENTO LEGAL EN VENEZUELA

El sistema Crastur ha sido diseñado respetando estrictamente el marco jurídico venezolano aplicable a comercio electrónico, telecomunicaciones, protección de datos y regulaciones cambiarias:

### A. Ley Orgánica de Precios Justos y Directrices de la SUNDDE
* **Exigencia Legal:** Toda actividad comercial en territorio venezolano debe expresar de forma obligatoria y prioritaria los precios en **Bolívares (Bs.)**, calculados según la tasa oficial del Banco Central de Venezuela (BCV). Está terminantemente prohibido por la SUNDDE publicar precios exclusivamente en divisas extranjeras, utilizar tasas no oficiales ("paralelo") o imponer recargos punitivos a los pagos realizados en moneda de curso legal.
* **Cumplimiento en Crastur:**
  - El sistema consulta y sincroniza automáticamente la tasa del **Banco Central de Venezuela (`bcv.org.ve`)** a 2 decimales exactos.
  - Cada respuesta del bot, comprobante de apartado y cotización en el panel administrativo muestra simultáneamente el monto en dólares (`$ USD`) y en bolívares (`Bs.`), especificando la tasa oficial referencial.
  - La política de descuentos por pronto pago en divisas se presenta como un beneficio comercial de descuento directo en caja y nunca como una penalización al pago en Bolívares (Pago Móvil o transferencias).

### B. Convenio Cambiario N° 1 del Banco Central de Venezuela (BCV)
* **Gaceta Oficial N° 6.405 Extraordinario del 7 de septiembre de 2018:**
  - Establece la libre convertibilidad de la moneda y designa como único tipo de cambio oficial para operaciones comerciales y fijación de precios el determinado por las mesas de cambio informadas por el BCV.
  *Crastur cumple al 100% de manera nativa y auditable.*

### C. Constitución de la República Bolivariana de Venezuela (CRBV) y Habeas Data
* **Artículo 28 (Derecho al Habeas Data):** Toda persona tiene derecho a conocer qué datos personales existen sobre ella, el fin para el que se recopilan y a exigir su rectificación o eliminación.
* **Artículo 117 (Derechos del Consumidor):** Garantía de información veraz sobre bienes, precios, garantías y condiciones de entrega.
* **Cumplimiento en Crastur:**
  - El bot recopila Nombre, Cédula de Identidad y Teléfono únicamente en el momento voluntario en que el cliente decide formalizar un apartado por 24 horas.
  - El comprobante digital emitido incluye la leyenda legal obligatoria:  
    *«🔒 Protección de Datos (Venezuela): Tus datos personales se registran confidencialmente de forma exclusiva para la validación y canje de este apartado en tienda física conforme al Art. 28 de la CRBV y la Ley Especial contra los Delitos Informáticos.»*

### D. Ley Especial contra los Delitos Informáticos (G.O. N° 37.313)
* **Artículos 20, 21 y 22:** Sancionan penalmente la violación de la privacidad de la data personal, interceptación indebida de comunicaciones y la revelación o cesión no autorizada de datos de clientes.
* **Cumplimiento en Crastur:**
  - **Soberanía y Almacenamiento 100% Local:** La base de datos (`crastur.db`) opera bajo SQLite en la computadora del comerciante. **No envía datos de clientes ni conversaciones a servidores en la nube de terceros, ni contiene telemetría oculta.**
  - El comerciante mantiene el control físico y absoluto de sus registros de clientes.

### E. Ley sobre Mensajes de Datos y Firmas Electrónicas (G.O. N° 37.076)
* **Artículos 4 y 6:** Reconocimiento de la eficacia probatoria y validez jurídica de los mensajes de datos y comunicaciones electrónicas entre partes comerciales.
* **Cumplimiento en Crastur:**
  - Los tickets de apartado emitidos por WhatsApp poseen validez como constancia de oferta mercantil y reserva temporal.
  - Incluyen fecha y hora de emisión, plazo exacto de expiración, descripción del producto, precio en Bolívares y USD, e identificación del establecimiento físico en San Agustín Norte.

### F. Ley Orgánica de Telecomunicaciones (LOT) y CONATEL
* El software no presta servicios portadores ni opera redes públicas de telecomunicaciones; actúa como una aplicación de usuario final (Over-The-Top / OTT) instalada en un computador privado para la atención de clientes sobre el canal de WhatsApp. **No requiere habilitación administrativa, concesión ni licencia de CONATEL.**
* El sistema cumple con las directrices anti-spam: la insistencia automática educada se ejecuta una sola vez (a los 15 minutos) y se aborta de inmediato si el cliente manifiesta negativa o agradecimiento.

---

## 2. TÉRMINOS DE WHATSAPP (META) Y BLINDAJE ANTI-BANEO

### ¿Es legal comercializar y usar este bot?
- **Ante la ley venezolana:** Sí, es 100% legal. No existe ninguna prohibición legal en Venezuela para conectar software propio a mensajería instantánea.
- **Ante los Términos de Servicio de WhatsApp (Meta):** Meta establece en sus políticas privadas comerciales la preferencia por su API oficial de pago (WhatsApp Business Cloud API). El bot de Crastur utiliza **Baileys**, una librería de conexión directa WebSocket basada en el protocolo de WhatsApp Web.

### Mecanismos de Protección y Humanización Implementados:
1. **Presencia Humana Simulada (`composing`):**  
   Antes de despachar cualquier respuesta automática, el bot envía el evento de presencia a WhatsApp para que en el celular del cliente aparezca el estado *"Escribiendo..."*.
2. **Retardo Humano Variable (Human Typing Delay):**  
   El bot no responde de forma instantánea (<200ms) como los bots maliciosos; aplica un retraso orgánico calculado de 1.2 a 2.2 segundos para simular el ritmo de digitación humana.
3. **Agrupación de Mensajes por Ráfaga (Debounce Anti-Spam de 1.2s):**  
   Si el cliente envía varios mensajes cortos seguidos (*"hola"*, *"tienen bujía?"*, *"precio?"*), el bot los procesa en un único bloque en lugar de bombardear al cliente con 3 respuestas automáticas concurrentes.
4. **Protección Contra Grupos y Canales:**  
   El bot ignora estrictamente mensajes de grupos (`@g.us`), canales (`@newsletter`), estados de WhatsApp (`status@broadcast`) y difusiones masivas para evitar saturación de la cuenta.

### ⚠️ Reglas de Oro para el Comerciante (Evitar Bloqueos de Línea):
1. **No enviar mensajes masivos a números desconocidos:** El bot debe utilizarse para responder a clientes que escriben a la tienda, **nunca para enviar publicidad en frío a bases de datos compradas**.
2. **Calentamiento de líneas nuevas (Warm-up):** Si se utiliza una línea de teléfono recién comprada, úsala normalmente durante 7 a 10 días (chatear con amigos, grupos de confianza) antes de vincularla a un volumen comercial alto.
3. **Mantener una buena tasa de respuesta:** Utilizar la pestaña **Live Inbox** cuando un cliente requiera atención especializada para que la interacción sea de mutua satisfacción y ningún usuario reporte la cuenta como spam.

---

## 3. MANUAL OPERATIVO PARA EL CLIENTE (PASO A PASO)

### Arranque en 1 Solo Clic (Windows)
1. Ubica el archivo **`Crastur.bat`** en la carpeta principal o el acceso directo en el Escritorio.
2. Haz **doble clic en `Crastur.bat`**.
3. El sistema verificará automáticamente el entorno y abrirá tu navegador predeterminado en `http://localhost:3333`.

### Arranque en Linux / macOS
1. Abre la terminal en la carpeta del proyecto.
2. Ejecuta: **`./crastur.sh`** (o **`npm start`**).
3. El iniciador comprobará las dependencias y abrirá automáticamente el panel en `http://localhost:3333`.

### Cómo Vincular la Línea de WhatsApp
1. En el menú lateral izquierdo, haz clic en **Conexión WhatsApp**.
2. Abre WhatsApp en tu celular ➔ menú de 3 puntos (o Ajustes en iPhone) ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
3. Apunta la cámara de tu teléfono hacia el **código QR** que aparece en la pantalla de la computadora.
4. Una vez vinculado, el indicador cambiará a **Conectado** en color verde y el bot empezará a atender de inmediato.

### ¿Qué hacer si se cambia de teléfono o WhatsApp se desconecta?
1. Dirígete a **Conexión WhatsApp** en el panel.
2. Haz clic en el botón **"Nuevo QR Limpio"** (o "Cerrar Sesión").
3. El sistema purgará las credenciales caducadas y generará un nuevo código QR fresco para escanear con la nueva línea.

---

## 4. GESTIÓN DE INVENTARIO, APARTADOS Y CICLO DE GRACIA (24H + 12H)

### Control Estricto de Stock
- Al registrar un apartado desde WhatsApp o el panel, el sistema **verifica que el repuesto tenga existencias disponibles (`stock > 0`)**.
- Si el stock es 0, el bot informa cordialmente al cliente que la pieza está agotada y le sugiere hablar con un vendedor.
- Al generarse el apartado, **el sistema descuenta automáticamente 1 unidad del stock activo** para garantizar que no se venda la misma pieza a dos personas diferentes.

### Ciclo de Vida del Apartado (24 Horas + 12 Horas de Gracia):
1. **Primeras 24 Horas (Estado `activo`):**  
   El repuesto queda reservado en tienda física. El panel muestra la cuenta regresiva en verde o ámbar (*"18h restantes"*).
2. **Al cumplir las 24 Horas (Estado `vencido`):**  
   - Si el cliente no retiró la pieza, el sistema cambia el estado a **`vencido`** y **restablece automáticamente el stock al inventario de la tienda** para que pueda ser vendido a otro comprador.
   - **Plazo de Gracia de 12 Horas:** El apartado **NO se borra de inmediato**. Se mantiene visible en el panel durante **12 horas extras** con el badge `Vencido (Gracia: Xh restantes)`. Esto permite al dueño llamar al cliente por teléfono si desea ofrecerle retirar la pieza antes de descartar el registro.
3. **A las 36 Horas Totales (24h + 12h de gracia):**  
   El registro se purga automáticamente de la base de datos para mantener el sistema ligero y ordenado.

---

## 5. USO DEL LIVE INBOX (ATENCIÓN HUMANA / HUMAN TAKEOVER)

El panel incluye la pestaña **Live Inbox**, diseñada para que los asesores de ventas puedan supervisar las conversaciones de los clientes y tomar el control manual cuando sea necesario:

1. **Indicador de Estado de Conexión:**  
   En la parte superior, si WhatsApp no está vinculado, el sistema mostrará un banner de alerta con el botón directo **"👉 Vincular WhatsApp Ahora"**. En el menú lateral se indicará claramente *"Sin Conexión"* en lugar de confundir al usuario.
2. **Lista de Chats Recientes:**  
   En la columna izquierda verás todas las conversaciones con el nombre del cliente, número de teléfono, último mensaje y un badge que indica si el bot está activo (verde) o en pausa (ámbar).
3. **Pausar Bot en un Chat Específico (Human Takeover):**  
   Si deseas atender tú mismo a un cliente sin que el bot envíe respuestas automáticas, abre el chat y presiona el botón **"Pausar Bot (Atender Yo)"**. El bot guardará silencio en esa conversación.
4. **Banco de Atajos Comerciales Profesionales (8 Plantillas Oficiales):**  
   Encima de la barra de mensajes dispones de botones directos y el botón **"Ver Todos (8)"** con información completa y verificada de Crastur:
   - **👋 Saludo Asesor:** Presentación cordial del equipo de ventas.
   - **📍 Ubicación & Puntos de Referencia:** Dirección exacta (Edif. Liberalba, San Agustín Norte), referencias (Metro Parque Central / Centro Financiero Latino) y enlace a Google Maps.
   - **💳 Métodos de Pago & Tasa BCV:** Desglose de divisas en efectivo (con descuento), Pago Móvil sin recargos, transferencias y tasa oficial del BCV en vivo.
   - **💛 Financiamiento Cashea:** Explicación detallada de compras a partir de $25 USD, pago de inicial y 3 cuotas quincenales según el nivel del cliente.
   - **🛵 Delivery en Caracas & Tarifas:** Tarifas estimadas por zonas de la Gran Caracas ($2-$3 USD y $3-$5 USD).
   - **⏱️ Cómo Apartar por 24 Horas:** Datos requeridos (Nombre, Cédula y Teléfono).
   - **✅ Disponibilidad Inmediata:** Confirmación de stock para retiro hoy o delivery.
   - **🛡️ Garantía & Política de Cambios:** Especificación de garantía y conservación de empaque original.
5. **Limpieza y Mantenimiento del Inbox:**  
   - **Limpiar Chat:** Puedes hacer clic en el botón con icono de papelera en la barra superior del chat para eliminar los mensajes de esa conversación y reiniciar el flujo del bot.
   - **Vaciar Todo el Inbox:** Botón en la lista de chats para limpiar todos los historiales y dejar la bandeja limpia al inicio de jornada.
6. **Reanudar Bot:**  
   Cuando termines de atender al cliente, haz clic en **"Reanudar Bot"** para que el asistente virtual vuelva a encargarse de responderle.

---

## 6. RESPALDO, IMPORTACIÓN Y MANTENIMIENTO DEL SISTEMA

### A. Herramienta Automatizada de Mantenimiento (`npm run maintenance`)
El sistema cuenta con un script integral de mantenimiento y diagnóstico accesible por terminal ejecutando:
```bash
npm run maintenance
```
Este comando despliega un menú interactivo en consola con las siguientes opciones:

1. **🔍 Diagnóstico Integral de Salud (`--diag`):**
   - Comprueba la integridad física de SQLite (`PRAGMA integrity_check`).
   - Muestra el tamaño de la base de datos y desglose de registros (catálogo, apartados activos, mensajes).
   - Verifica la disponibilidad del puerto de red `3333` y el estado de la sesión de WhatsApp.
2. **🟢 Verificación de Node.js y Compatibilidad LTS (`--node-check`):**
   - Detecta la versión de Node.js instalada en la máquina y consulta la última versión LTS oficial en `nodejs.org`.
   - Si el sistema operativo actualizó Node.js (por ejemplo, a Node.js 20, 22 o superior), te permite verificar la compatibilidad de inmediato.
3. **🔄 Re-vincular Dependencias tras Cambio de Node.js (`--rebuild-deps`):**
   - Ejecuta `npm rebuild` para re-compilar y vincular los módulos nativos y de WebAssembly (`sql.js`, buffers de sockets) con el runtime activo de Node.js, garantizando cero fallos de ABI.
4. **🧹 Limpieza Operacional a Cero (`--clean`):**
   - Limpia historiales de chat, sesiones inactivas, apartados vencidos y métricas de prueba, dejando el catálogo de productos comerciales y la configuración de la tienda 100% intactos.
5. **🗜️ Optimización y Desfragmentación SQLite (`--vacuum`):**
   - Ejecuta `VACUUM` y `PRAGMA optimize;` en la base de datos, reduciendo su peso en disco y acelerando las lecturas y consultas del bot.
6. **📦 Depuración de Respaldos Antiguos (`--prune-backups`):**
   - Elimina respaldos automáticos con más de 7 días de antigüedad en `data/backups/`, evitando consumo innecesario de almacenamiento y generando un respaldo maestro actualizado.
7. **📲 Reinicio Seguro de Sesión de WhatsApp (`--reset-wa`):**
   - Si la línea telefónica cambia o las credenciales sufren desincronización, purga la carpeta `data/auth_info_baileys/` para permitir escanear un nuevo código QR limpio de inmediato.
8. **🚀 Recompilación del Panel Web (`--build`):**
   - Ejecuta la compilación de producción de Vite para asegurar que el panel visual esté al día con todas las optimizaciones.
9. **⚡ Mantenimiento Completo Automático (`--all`):**
   - Ejecuta el diagnóstico, verificación de Node.js, optimización SQLite, depuración de respaldos y compilación web en una sola acción.

### B. Respaldo e Importación Masiva del Catálogo (1 Clic)
- **Exportar Catálogo:** En la pestaña **Catálogo Productos**, haz clic en el botón **"Exportar"**. Se descargará un archivo `.json` con todos los repuestos, precios y stock.
- **Importar Catálogo:** Si necesitas cargar un inventario masivo o migrar datos desde otra computadora, haz clic en **"Importar"** y selecciona el archivo `.json`. El sistema normaliza automáticamente las categorías a las 4 canónicas (`Insumos Cauchera`, `Repuestos Moto`, `Accesorios Moto`, `Otros Productos`) y actualiza el inventario al instante.

### C. Protección Atómica Contra Apagones y Fallas Eléctricas
- El motor de almacenamiento de Crastur utiliza **escritura atómica en disco** mediante archivos temporales antes de consolidar `crastur.db`.
- Si ocurre un corte de luz o fluctuación eléctrica durante la operación de la tienda, el archivo principal de la base de datos no sufre corrupción. Además, el sistema genera copias de seguridad automáticas diarias en la carpeta `data/backups/`.

---

## 7. CONTRATO DE LICENCIAMIENTO Y ACTA DE ENTREGA DE SOFTWARE

*(Este modelo puede ser firmado entre el desarrollador y el cliente propietario de Crastur al momento de la entrega formal del producto)*

### ACTA DE ENTREGA Y LICENCIA DE USO DE SOFTWARE COMERCIAL

**Entre las partes:**  
Por una parte, **EL DESARROLLADOR / PROVEEDOR**, y por la otra parte, **CRASTUR (EL CLIENTE / ADQUIRIENTE)**, convienen en suscribir la presente acta de entrega bajo las siguientes condiciones:

1. **Objeto:** EL DESARROLLADOR hace entrega formal a EL CLIENTE de la solución de software **Crastur - Sistema de Ventas y Bot de WhatsApp**, que incluye el backend modular en Node.js, panel administrativo web en React, servicio de conexión a WhatsApp y sincronización con la tasa oficial del Banco Central de Venezuela (BCV).
2. **Soberanía y Privacidad de los Datos:** EL CLIENTE declara conocer que la base de datos opera de forma estrictamente local en su equipo de cómputo. EL DESARROLLADOR no almacena, no transfiere ni tiene acceso a los datos de los clientes, números telefónicos, cédulas de identidad ni conversaciones generadas en el negocio de EL CLIENTE, cumpliendo a cabalidad con el Art. 28 de la CRBV y la Ley Especial contra los Delitos Informáticos.
3. **Cumplimiento de Leyes Comerciales y SUNDDE:** EL CLIENTE se compromete a mantener activa la sincronización con la tasa oficial del BCV y a no utilizar el sistema para fines contrarios a la Ley Orgánica de Precios Justos ni para especulación cambiaria.
4. **Políticas de WhatsApp y Exención de Responsabilidad:** EL CLIENTE reconoce que el servicio de mensajería de WhatsApp es provisto por una empresa tercera (Meta Platforms, Inc.). EL DESARROLLADOR entrega el software equipado con mecanismos de humanización y anti-spam (composing, retardo humano y limitadores). EL CLIENTE se compromete a no utilizar el bot para envío masivo de spam o comunicaciones no solicitadas, eximiendo a EL DESARROLLADOR de cualquier responsabilidad en caso de suspensiones de la línea originadas por reportes de usuarios o uso indebido por parte de los operadores del negocio.
5. **Garantía y Aceptación:** EL CLIENTE ha inspeccionado el sistema, verificado el correcto funcionamiento del bot, del catálogo, del sistema de apartados de 24 horas y del panel administrativo web, declarando su total conformidad y aceptación de entrega a satisfacción.

En Caracas, a la fecha de su entrega y puesta en marcha.

*(Firma del Desarrollador)* &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp; *(Firma del Representante de Crastur)*
