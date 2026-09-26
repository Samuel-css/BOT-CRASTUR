# 🇻🇪 Guía Integral de Entrega, Marco Legal en Venezuela y Manual de Operaciones - Crastur

Este documento constituye la documentación formal de entrega del sistema **Crastur - Sistema de Ventas y Bot de WhatsApp para Tiendas de Repuestos e Insumos**. Ha sido redactado para servir como manual operativo para el comerciante y su personal de mostrador, y como dictamen técnico-jurídico que respalda la legalidad y libre distribución del producto en la República Bolivariana de Venezuela.

---

## 📑 ÍNDICE
1. [Dictamen de Cumplimiento Legal en Venezuela](#1-dictamen-de-cumplimiento-legal-en-venezuela)
2. [Términos de WhatsApp (Meta) y Blindaje Anti-Baneo](#2-términos-de-whatsapp-meta-y-blindaje-anti-baneo)
3. [Manual Operativo para el Comerciante (Paso a Paso)](#3-manual-operativo-para-el-comerciante-paso-a-paso)
4. [Gestión de Inventario, Horarios, Combos Cashea y Apartados 24h](#4-gestión-de-inventario-horarios-combos-cashea-y-apartados-24h)
5. [Uso del Live Inbox y Gestión de Asesores (Human Takeover)](#5-uso-del-live-inbox-y-gestión-de-asesores-human-takeover)
6. [Respaldo, Mantenimiento y Suite de Pruebas de Estrés](#6-respaldo-mantenimiento-y-suite-de-pruebas-de-estrés)
7. [Contrato de Licenciamiento y Acta de Entrega de Software](#7-contrato-de-licenciamiento-y-acta-de-entrega-de-software)

---

## 1. DICTAMEN DE CUMPLIMIENTO LEGAL EN VENEZUELA

El sistema Crastur ha sido diseñado respetando estrictamente el marco jurídico venezolano aplicable a comercio electrónico, telecomunicaciones, protección de datos y regulaciones cambiarias:

### A. Ley Orgánica de Precios Justos y Directrices de la SUNDDE
* **Exigencia Legal:** Toda actividad comercial en territorio venezolano debe expresar de forma obligatoria y prioritaria los precios en **Bolívares (Bs.)**, calculados según la tasa oficial del Banco Central de Venezuela (BCV). Está terminantemente prohibido por la SUNDDE publicar precios exclusivamente en divisas extranjeras, utilizar tasas no oficiales ("paralelo") o imponer recargos punitivos a los pagos realizados en moneda de curso legal.
* **Cumplimiento en Crastur:**
  - El sistema consulta y sincroniza automáticamente la tasa del **Banco Central de Venezuela (`bcv.org.ve`)** a 2 decimales exactos.
  - Cada respuesta del bot, comprobante de apartado y cotización en el panel administrativo muestra simultáneamente el monto en dólares (`$ USD`) y en bolívares (`Bs.`), especificando la tasa oficial referencial del día.
  - La política de descuentos por pronto pago en divisas se presenta como un beneficio comercial de descuento directo en caja por pronto pago en efectivo y nunca como una penalización al pago en Bolívares (Pago Móvil o transferencias bancarias).

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
  - El comerciante mantiene el control físico y absoluto de sus registros de clientes y productos.

### E. Ley sobre Mensajes de Datos y Firmas Electrónicas (G.O. N° 37.076)
* **Artículos 4 y 6:** Reconocimiento de la eficacia probatoria y validez jurídica de los mensajes de datos y comunicaciones electrónicas entre partes comerciales.
* **Cumplimiento en Crastur:**
  - Los tickets de apartado emitidos por WhatsApp poseen validez como constancia de oferta mercantil y reserva temporal.
  - Incluyen fecha y hora de emisión, plazo exacto de expiración, descripción del producto, precio en Bolívares y USD, código único de control `CRA-` e identificación del establecimiento físico en San Agustín Norte.

### F. Ley Orgánica de Telecomunicaciones (LOT) y CONATEL
* El software no presta servicios portadores ni opera redes públicas de telecomunicaciones; actúa como una aplicación de usuario final (Over-The-Top / OTT) instalada en un computador privado para la atención de clientes sobre el canal de WhatsApp. **No requiere habilitación administrativa, concesión ni licencia de CONATEL.**
* El sistema cumple con directrices anti-spam: la insistencia automática educada se ejecuta una sola vez (a los 15 minutos) y se aborta de inmediato si el cliente manifiesta negativa, agradecimiento o si se encuentra fuera de horario de tienda.

---

## 2. TÉRMINOS DE WHATSAPP (META) Y BLINDAJE ANTI-BANEO

### ¿Es legal comercializar y usar este bot?
- **Ante la ley venezolana:** Sí, es 100% legal. No existe ninguna prohibición legal en Venezuela para conectar software propio a mensajería instantánea.
- **Ante los Términos de Servicio de WhatsApp (Meta):** Meta establece en sus políticas privadas comerciales la preferencia por su API oficial de pago (WhatsApp Business Cloud API). El bot de Crastur utiliza **Baileys**, una librería de conexión directa WebSocket basada en el protocolo nativo de WhatsApp Web.

### Mecanismos de Protección y Humanización Implementados:
1. **Presencia Humana Simulada (`composing`):**  
   Antes de despachar cualquier respuesta automática, el bot envía el evento de presencia a WhatsApp para que en el celular del cliente aparezca el estado *"Escribiendo..."*.
2. **Retardo Humano Variable (Human Typing Delay):**  
   El bot no responde de forma instantánea (<200ms) como los bots maliciosos; aplica un retraso orgánico calculado de 1.2 a 2.2 segundos para simular el ritmo de digitación humana.
3. **Agrupación de Mensajes por Ráfaga (Debounce Anti-Spam de 1.2s):**  
   Si el cliente envía varios mensajes cortos seguidos (*"hola"*, *"tienen bujía?"*, *"precio?"*), el bot los procesa en un único bloque en lugar de bombardear al cliente con múltiples respuestas concurrentes.
4. **Protección Contra Grupos, Canales y Estados:**  
   El bot ignora estrictamente mensajes de grupos (`@g.us`), canales (`@newsletter`), estados de WhatsApp (`status@broadcast`) y difusiones masivas para evitar saturación de la cuenta.

### ⚠️ Reglas de Oro para el Comerciante (Evitar Bloqueos de Línea):
1. **No enviar mensajes masivos a números desconocidos:** El bot debe utilizarse para responder a clientes que escriben a la tienda, **nunca para enviar publicidad en frío a bases de datos compradas**.
2. **Calentamiento de líneas nuevas (Warm-up):** Si se utiliza una línea de teléfono recién comprada, úsala normalmente durante 7 a 10 días (chatear con amigos, grupos de confianza) antes de vincularla a un volumen comercial alto.
3. **Mantener una buena tasa de respuesta:** Utilizar la pestaña **Live Inbox** cuando un cliente requiera atención especializada para que la interacción sea fluida y ningún usuario reporte la cuenta como spam.

---

## 3. MANUAL OPERATIVO PARA EL COMERCIANTE (PASO A PASO)

### 🖥️ Experiencia para el Cliente / Trabajador de Mostrador

El cliente **no necesita entrar a carpetas técnicas ni ver código**. Todo el flujo está pensado para funcionar directamente con **1 solo acceso directo en el Escritorio de Windows**:

#### 1. Configuración Inicial (Solo la Primera Vez):
- En la carpeta de la aplicación, haz doble clic en **`Crastur.bat`**.
- El asistente comprobará el sistema, inicializará la base de datos y **creará automáticamente 1 único acceso directo oficial en el Escritorio de Windows**:
  - 🛞 **`Crastur`**: Con el icono oficial naranja de la tienda.
- A partir de este momento, el operador **solo usará ese acceso directo de su Escritorio**.

---

### 🟢 Rutina Diaria: Cómo Abrir el Sistema

1. **En su Escritorio de Windows:**
   - Haz **doble clic en el acceso directo `Crastur`**.
   - **Si el sistema estaba apagado:** Arranca de forma 100% silenciosa en segundo plano (sin consolas negras que puedan cerrarse por error) y abre automáticamente el navegador en `http://localhost:3333`.
   - **Si el sistema ya estaba encendido (ej. cerraron la pestaña por descuido):** El lanzador detecta que el servicio ya está corriendo y **simplemente reabre la pestaña en el navegador**, sin generar bloqueos ni errores de puerto ocupado.

2. **En Linux / macOS:**
   - Abre la terminal y ejecuta: `./crastur.sh`.

---

### 🛑 Rutina de Cierre: Cómo Apagar el Sistema

Al terminar el turno o cerrar la tienda, el apagado se realiza de forma elegante y respetuosa directamente desde el sistema:

1. **Apagado Oficial desde el Navegador:**
   - En la esquina superior derecha del panel administrativo, haz clic en el botón rojo **"Apagar"**.
   - Confirma el diálogo de seguridad.
   - El sistema guarda de inmediato la base de datos SQLite en disco (`persistDB()`), desconecta WhatsApp sin perder la sesión y detiene el servidor.
   - La pantalla cambia a una confirmación agradable indicando que todo está a salvo y que ya puedes cerrar esa pestaña. **Tus demás pestañas del navegador (correo, bancos, etc.) permanecen totalmente intactas.**

2. **Herramienta Técnica de Emergencia (Solo si el navegador no responde):**
   - En Windows: ejecuta `scripts/apagar_servidor.bat`.
   - En Linux / macOS: ejecuta `scripts/apagar_servidor.sh`.

---

### Cómo Vincular la Línea de WhatsApp
1. En el menú lateral izquierdo, haz clic en **Conexión WhatsApp**.
2. Abre WhatsApp en tu celular ➔ menú de 3 puntos (o Ajustes en iPhone) ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
3. Apunta la cámara de tu teléfono hacia el **código QR** que aparece en pantalla.
4. Una vez vinculado, el indicador cambiará a **Conectado** en color verde y el bot empezará a atender de inmediato.

### ¿Qué hacer si se cambia de teléfono o WhatsApp se desconecta?
1. Dirígete a **Conexión WhatsApp** en el panel.
2. Haz clic en el botón **"Nuevo QR Limpio"** (o "Cerrar Sesión").
3. El sistema purgará las credenciales caducadas y generará un nuevo código QR limpio para escanear con la nueva línea.

---

## 4. GESTIÓN DE INVENTARIO, HORARIOS, COMBOS CASHEA Y APARTADOS 24H

### A. Inventario Limpio para Producción (Opción A)
Para su despliegue comercial oficial, el sistema se entrega con **`0 productos`**, permitiendo cargar el catálogo real directamente desde:
- **Catálogo ➔ Nuevo Repuesto**: Registro manual con marca, modelo, categoría, precio USD y stock.
- **Importación**: Carga rápida de inventario.
- **Restablecimiento Limpio de Fábrica**: En caso de requerir volver a dejar la base de datos 100% limpia en el futuro, ejecuta en la terminal:
  ```bash
  npm run reset
  ```

### B. Gestión de Horarios: Lunes a Sábado vs. Cierre Temprano Dominical
Crastur opera de lunes a sábado en horario corrido y los domingos con horario reducido:
- **Preset Oficial Predeterminado:**  
  `Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM`
- **Configuración Intuitiva:** En la pestaña **1. Mi Tienda & Horario**, dispones de chips rápidos y un selector para configurar por separado los días laborales de semana y el horario especial de domingos (`☀️ 8:30 AM a 2:00 PM`, `☀️ 8:00 AM a 1:00 PM`, `☀️ 9:00 AM a 2:00 PM`, o `🚫 Cerrado`).
- **Comportamiento Fuera de Horario:** Si un cliente escribe fuera de las horas comerciales, el bot le brinda información completa de precios, catálogo y tasa BCV, pero aclara que las reservas y entregas físicas se procesarán a partir de la hora oficial de apertura de la tienda física.

### C. Calculadora Cashea y Constructor de Combos ($25 USD Mínimo)
El servicio de financiamiento en 3 cuotas quincenales sin interés de Cashea exige en tienda física un monto mínimo de **$25 USD**. Para productos económicos (ej. aceite a $6, pastillas a $5 o bujías a $3.50):
1. Ingresa a la **Calculadora Cashea** ➔ **Elegir o Combinar Repuestos del Catálogo**.
2. Utiliza los selectores de cantidad `[-] [qty] [+]` o el botón **"Sumar a Combo Cashea"** para armar el paquete de repuestos que el cliente desea llevarse.
3. La **barra de progreso** indica en tiempo real cuánto dinero falta para alcanzar los $25 USD y ofrece sugerencias rápidas en 1 clic.
4. Al llegar a $25 USD, presiona **"Copiar Cotización Lista para WhatsApp"** para enviar un presupuesto formal con desglose por ítem, precio en USD, precio en Bs a tasa BCV, inicial en tienda física (según Nivel 1: 40%, Nivel 2: 30%, Nivel 3+: 20%) y 3 cuotas quincenales exactas sin interés.

### D. Ciclo de Vida del Apartado (24 Horas + 12 Horas de Gracia)
1. **Control de Stock en Tiempo Real:** Al apartar una pieza, el bot verifica que exista existencia física (`stock > 0`) y descuenta inmediatamente 1 unidad del inventario disponible para evitar sobreventa.
2. **Primeras 24 Horas (`activo`):** El cliente cuenta con 24 horas continuas para retirar en el local de San Agustín Norte.
3. **Al Vencer las 24 Horas (`vencido`):** El sistema **reintegra automáticamente la pieza al stock activo** para que pueda ser vendida a otro cliente.
4. **12 Horas de Gracia Extra:** El registro no se elimina de inmediato; permanece visible en el panel durante 12 horas adicionales con el badge `Vencido (Gracia: Xh)`, permitiendo al encargado contactar al cliente por teléfono antes de descartar la ficha.
5. **A las 36 Horas Totales:** El registro se purga automáticamente de la base de datos para mantener el sistema ligero y rápido.

---

## 5. USO DEL LIVE INBOX Y GESTIÓN DE ASESORES (HUMAN TAKEOVER)

El panel incluye la sección **Live Inbox**, donde el personal de ventas puede supervisar los chats de WhatsApp y tomar el control manual cuando sea necesario:

1. **Pausar Bot en un Chat Específico (Human Takeover):**  
   Si deseas atender tú mismo a un cliente sin que el bot envíe respuestas automáticas, abre el chat y presiona **"Pausar Bot (Atender Yo)"**. El bot guardará silencio en esa conversación hasta que presiones **"Reanudar Bot"**.
2. **Banco de Atajos Comerciales Profesionales (8 Plantillas Oficiales):**  
   Dispones de botones rápidos con respuestas redactadas y verificadas de Crastur:
   - **👋 Saludo Asesor**
   - **📍 Ubicación & Puntos de Referencia** (Edif. Liberalba, San Agustín Norte)
   - **💳 Métodos de Pago & Tasa BCV**
   - **💛 Financiamiento Cashea**
   - **🛵 Delivery en Caracas & Tarifas**
   - **⏱️ Cómo Apartar por 24 Horas**
   - **✅ Disponibilidad Inmediata**
   - **🛡️ Garantía & Política de Cambios**
3. **Gestión de Asesores de Ventas:**  
   En la sección de Asesores puedes registrar los miembros del equipo de ventas. El sistema normaliza automáticamente números de teléfono con o sin código internacional (`+58`, `0412...`, etc.) generando enlaces directos de WhatsApp `wa.me/58...` sin errores de marcado.
4. **Limpieza Segura del Inbox:**  
   - Borrado individual de chats con confirmación de seguridad.
   - Vaciado general de la bandeja sin tocar productos ni configuraciones.

---

## 6. RESPALDO, MANTENIMIENTO Y SUITE DE PRUEBAS DE ESTRÉS

### A. Herramienta Automatizada de Mantenimiento (`npm run maintenance`)
Ejecutando por terminal:
```bash
npm run maintenance
```
Dispones de un menú de diagnóstico y optimización:
- **`--diag`**: Integridad física de SQLite (`PRAGMA integrity_check`) y verificación de puertos.
- **`--node-check`**: Detección de versión de Node.js y compatibilidad LTS oficial.
- **`--rebuild-deps`**: Re-vinculación de dependencias nativas y WebAssembly (`sql.js`).
- **`--clean`**: Vaciado de mensajes y métricas a cero operativo.
- **`--vacuum`**: Desfragmentación y optimización profunda de SQLite.
- **`--prune-backups`**: Limpieza de respaldos automáticos de más de 7 días.
- **`--reset-wa`**: Reinicio de credenciales de WhatsApp para escanear un nuevo QR.
- **`--build`**: Compilación del panel visual web en Vite.

### B. Suite de Pruebas de Estrés y Validación Extrema (`npm test`)
El sistema cuenta con una batería de **68 pruebas automatizadas** que validan:
- **Alta Concurrencia:** 100 y 200 peticiones simultáneas procesadas en menos de 120 ms (> 1.700 req/s).
- **16 Perfiles de Clientes y Casos Extremos:** Modismos venezolanos (*"epale mano"*, *"chamo tienes..."*), errores ortográficos (*"pastiya"*, *"bujya"*), notas de voz, fotos, y de-escalación respetuosa ante insultos o quejas.
- **Ciberseguridad:** Protección contra inyecciones SQL (`' OR '1'='1`, `DROP TABLE`), payloads masivos y anti-spam automático (> 30 msgs/min).
- **Auto-Limpieza Post-Pruebas:** El script inyecta fixtures temporales para ejecutar las pruebas y los elimina al terminar, garantizando que el catálogo de producción permanezca en **0 productos**.

### C. Copias de Seguridad y Protección contra Apagones
- **Descarga en 1 Clic:** En **Configuración ➔ 5. Copia de Seguridad**, haz clic en **"Descargar Copia de Seguridad"** para obtener tu archivo `.db`.
- **Restauración Segura:** Puedes restaurar un respaldo `.db` en cualquier momento; el sistema genera una copia de seguridad preventiva antes de aplicar los datos.
- **Escritura Atómica:** El motor SQLite escribe en archivos temporales antes de consolidar el archivo maestro, protegiendo los datos contra pérdidas ante cortes imprevistos de energía eléctrica.

---

## 7. CONTRATO DE LICENCIAMIENTO Y ACTA DE ENTREGA DE SOFTWARE

*(Modelo para ser suscrito entre el desarrollador y el representante comercial de Crastur al momento de la entrega formal del producto)*

### ACTA DE ENTREGA Y LICENCIA DE USO DE SOFTWARE COMERCIAL

**Entre las partes:**  
Por una parte, **EL DESARROLLADOR / PROVEEDOR**, y por la otra parte, **CRASTUR (EL CLIENTE / ADQUIRIENTE)**, convienen en suscribir la presente acta de entrega bajo las siguientes condiciones:

1. **Objeto:** EL DESARROLLADOR hace entrega formal a EL CLIENTE de la solución de software **Crastur - Sistema de Ventas y Bot de WhatsApp**, que incluye el backend modular en Node.js, panel administrativo web en React, servicio de conexión a WhatsApp y sincronización con la tasa oficial del Banco Central de Venezuela (BCV).
2. **Soberanía y Privacidad de los Datos:** EL CLIENTE declara conocer que la base de datos opera de forma estrictamente local en su equipo de cómputo. EL DESARROLLADOR no almacena, no transfiere ni tiene acceso a los datos de los clientes, números telefónicos, cédulas de identidad ni conversaciones generadas en el negocio de EL CLIENTE, cumpliendo a cabalidad con el Art. 28 de la CRBV y la Ley Especial contra los Delitos Informáticos.
3. **Cumplimiento de Leyes Comerciales y SUNDDE:** EL CLIENTE se compromete a mantener activa la sincronización con la tasa oficial del BCV y a no utilizar el sistema para fines contrarios a la Ley Orgánica de Precios Justos ni para especulación cambiaria.
4. **Políticas de WhatsApp y Exención de Responsabilidad:** EL CLIENTE reconoce que el servicio de mensajería de WhatsApp es provisto por una empresa tercera (Meta Platforms, Inc.). EL DESARROLLADOR entrega el software equipado con mecanismos de humanización y anti-spam (composing, retardo humano y limitadores). EL CLIENTE se compromete a no utilizar el bot para envío masivo de spam o comunicaciones no solicitadas, eximiendo a EL DESARROLLADOR de cualquier responsabilidad en caso de suspensiones de la línea originadas por reportes de usuarios o uso indebido por parte de los operadores del negocio.
5. **Garantía y Aceptación:** EL CLIENTE ha inspeccionado el sistema, verificado el correcto funcionamiento del bot, del catálogo, del sistema de apartados de 24 horas, de la calculadora de combos Cashea y del panel administrativo web, declarando su total conformidad y aceptación de entrega a satisfacción.

En Caracas, a la fecha de su entrega y puesta en marcha.

*(Firma del Desarrollador)* &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp; *(Firma del Representante de Crastur)*
