import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  PauseCircle,
  PlayCircle,
  User,
  Bot,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  MapPin,
  DollarSign,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Layers,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRate } from '../../utils/formatters';

export default function LiveInboxView({ waStatus, onNavigate, bcvRate, onRequestConfirm }) {
  const [sessions, setSessions] = useState([]);
  const [selectedJid, setSelectedJid] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const isConnected = waStatus?.status === 'connected';
  const effectiveRate = bcvRate || 849.56;

  // Catálogo completo de atajos comerciales profesionales para Crastur
  const CANNED_SHORTCUTS = [
    {
      id: 'saludo',
      titulo: 'Saludo de Asesor',
      categoria: 'Atención',
      icono: User,
      color: 'emerald',
      texto: `¡Hola! 👋 Te atiende directamente un asesor de ventas de *Crastur*. ¿En qué repuesto o insumo para cauchera te podemos ayudar hoy? Con gusto te verificamos disponibilidad y precio en tienda física.`
    },
    {
      id: 'ubicacion',
      titulo: 'Ubicación & Puntos de Referencia',
      categoria: 'Tienda',
      icono: MapPin,
      color: 'orange',
      texto: `🏢 *Tienda Física Crastur - Insumos & Repuestos de Moto* 🛞🏍️\n📍 *Dirección:* Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n📌 *Puntos de Referencia:* Frente al Centro Financiero Latino, a 2 cuadras de la estación de Metro Parque Central y muy cerca de la Av. Bolívar.\n🕒 *Horario:* Lunes a Sábado de 8:00 AM a 8:00 PM (horario corrido).\n🗺️ *Google Maps:* https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`
    },
    {
      id: 'pagos',
      titulo: 'Métodos de Pago & Tasa BCV',
      categoria: 'Pagos',
      icono: DollarSign,
      color: 'emerald',
      texto: `💳 *Formas de Pago Autorizadas en Crastur:*\n💵 *Efectivo en Divisas / Dólares* (🔥 ¡Con descuento especial por pago en divisas en tienda!)\n✅ *Pago Móvil* (a tasa oficial BCV del día, sin recargos)\n✅ *Transferencia Bancaria (Banesco / Mercantil / Banco de Venezuela)*\n✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n💛 *Cashea* (Disponible en tienda física a partir de $25 USD)\n🇻🇪 *Tasa oficial BCV hoy:* Bs. ${formatRate(effectiveRate)} / USD`
    },
    {
      id: 'cashea',
      titulo: 'Financiamiento Cashea Completo',
      categoria: 'Pagos',
      icono: Layers,
      color: 'amber',
      texto: `💛 *Financiamiento Cashea en Crastur:*\n¡Sí! Aplica para compras y combos a partir de *$25 USD* en nuestra tienda física de San Agustín Norte:\n• *Pagas hoy solo la inicial* en caja escaneando con tu App Cashea al retirar.\n• *El monto restante* te queda en 3 cuotas quincenales a 0% de interés.\n📊 *Porcentajes según tu nivel de usuario:*\n- Nivel 1: 40% inicial + 3 cuotas quincenales del 20%\n- Nivel 2: 30% inicial + 3 cuotas quincenales del 23.3%\n- Nivel 3+: 20% inicial + 3 cuotas quincenales del 26.6%`
    },
    {
      id: 'delivery',
      titulo: 'Delivery en Caracas & Tarifas',
      categoria: 'Envíos',
      icono: Truck,
      color: 'orange',
      texto: `🛵 *Servicio de Delivery en Caracas - Crastur* 📦\nDespachamos hoy mismo con motorizado confiable directo a tu domicilio, trabajo o taller mecánico.\n📍 *Tarifas estimadas de motorizado:*\n• San Agustín, Centro, Bellas Artes: *$2 a $3 USD*\n• Catia, El Valle, Chacao, Baruta, Petare: *$3 a $5 USD*\n👉 Indícanos tu zona o dirección exacta para confirmarte la tarifa del motorizado.`
    },
    {
      id: 'apartado',
      titulo: 'Cómo Apartar por 24 Horas',
      categoria: 'Ventas',
      icono: Clock,
      color: 'orange',
      texto: `⏱️ *Apartado sin Costo por 24 Horas en Crastur:*\nTe reservamos tu repuesto en tienda física durante 24 horas continuas para que lo retires con calma.\nPara emitir tu ticket oficial en caja, por favor indícanos:\n1️⃣ *Nombre y Apellido*\n2️⃣ *Cédula de Identidad (V- o E-)*\n3️⃣ *Teléfono de Contacto*\n¡Al llegar a tienda presentas tu cédula en caja y retiras!`
    },
    {
      id: 'disponibilidad',
      titulo: 'Disponibilidad Inmediata',
      categoria: 'Ventas',
      icono: CheckCircle2,
      color: 'emerald',
      texto: `✅ ¡Sí, tenemos disponibilidad inmediata! Puedes retirar hoy mismo en nuestra tienda física de San Agustín Norte (Lun-Sáb 8am-8pm) o solicitar despacho con motorizado a tu ubicación en Caracas.`
    },
    {
      id: 'garantia',
      titulo: 'Garantía & Devoluciones',
      categoria: 'Atención',
      icono: ShieldCheck,
      color: 'emerald',
      texto: `🛡️ *Garantía de Repuestos Crastur:*\nTodos nuestros repuestos y accesorios son 100% nuevos y cuentan con garantía contra defectos de fábrica y garantía de calce. Para hacer válida cualquier garantía o cambio es indispensable conservar el repuesto en su empaque original sin daños físicos ni modificaciones.`
    }
  ];

  // Cargar lista de sesiones (chats recientes)
  const loadInbox = async () => {
    setLoadingChats(true);
    try {
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
        // Si no hay chat seleccionado y hay chats disponibles, seleccionar el primero
        if (!selectedJid && data.length > 0) {
          setSelectedJid(data[0].jid);
        }
      }
    } catch (err) {
      console.error('Error cargando inbox:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  // Cargar mensajes del chat seleccionado
  const loadMessages = async (jid) => {
    if (!jid) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(jid)}`);
      const data = await res.json();
      if (data) {
        setActiveSession(data.session || null);
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error cargando mensajes de chat:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (selectedJid) {
      loadMessages(selectedJid);
    }
  }, [selectedJid]);

  // Auto-scroll al final cuando cambian los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Escuchar mensajes en tiempo real vía WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'live_chat_message') {
            loadInbox();

            if (data?.action === 'cleared' && data.jid === selectedJid) {
              setMessages([]);
              return;
            }
            if (data?.action === 'all_cleared') {
              setSessions([]);
              setMessages([]);
              return;
            }

            if (data && data.jid === selectedJid) {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  jid: data.jid,
                  remitente: data.remitente,
                  contenido: data.contenido,
                  timestamp: data.timestamp || Date.now()
                }
              ]);
            }
          } else if (type === 'chat_pause_changed') {
            if (data && data.jid === selectedJid) {
              setActiveSession((prev) => prev ? { ...prev, bot_pausado: data.pausado ? 1 : 0 } : null);
            }
            loadInbox();
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (err) {
      console.log('WS Inbox omitido');
    }

    return () => {
      if (ws) ws.close();
    };
  }, [selectedJid]);

  // Pausar o reanudar el bot en este chat específico (Human Takeover)
  const handleToggleBotPause = async () => {
    if (!selectedJid) return;
    const nextState = !activeSession?.bot_pausado;
    try {
      const res = await fetch('/api/chat/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: selectedJid, pausado: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession((prev) => ({ ...prev, bot_pausado: nextState ? 1 : 0 }));
        setSessions((prev) =>
          prev.map((s) => (s.jid === selectedJid ? { ...s, bot_pausado: nextState ? 1 : 0 } : s))
        );
        if (nextState) {
          toast.warning('Bot PAUSADO en este chat. Ahora puedes atender manualmente sin interferencia.');
        } else {
          toast.success('Bot REANUDADO en este chat. Volverá a responder automáticamente.');
        }
      }
    } catch (err) {
      toast.error('Error al cambiar el estado del bot para este chat');
    }
  };

  // Limpiar mensajes del chat actual
  const handleClearCurrentChat = () => {
    if (!selectedJid) return;
    const clientName = activeSession?.push_name || formatPhone(selectedJid);

    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Limpiar historial de este chat?',
        message: `Se eliminarán los mensajes guardados de la conversación con "${clientName}". El chat quedará limpio y el bot reiniciará su flujo de atención.`,
        confirmText: 'Sí, Limpiar Conversación',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/inbox/${encodeURIComponent(selectedJid)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              setMessages([]);
              loadInbox();
              toast.info('Conversación limpiada con éxito.');
            }
          } catch (e) {
            toast.error('Error al limpiar la conversación');
          }
        }
      });
    }
  };

  // Vaciar todas las conversaciones del inbox
  const handleClearAllInbox = () => {
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Vaciar todo el Live Inbox?',
        message: 'Esta acción borrará el registro de mensajes de todos los chats para dejar la bandeja completamente limpia. Las reservas vigentes no se verán afectadas.',
        confirmText: 'Sí, Vaciar Todo el Inbox',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetch('/api/inbox/clear-all', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              setSessions([]);
              setMessages([]);
              setSelectedJid(null);
              setActiveSession(null);
              toast.success('Live Inbox vaciado completamente.');
            }
          } catch (e) {
            toast.error('Error al vaciar el inbox');
          }
        }
      });
    }
  };

  // Enviar mensaje manual
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedJid || sendingMessage) return;

    if (!isConnected) {
      toast.error('WhatsApp no está conectado. Vincula tu línea primero para enviar mensajes.', {
        action: {
          label: 'Conectar WhatsApp',
          onClick: () => onNavigate && onNavigate('whatsapp')
        }
      });
      return;
    }

    setSendingMessage(true);
    try {
      const res = await fetch('/api/chat/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: selectedJid, text })
      });
      const data = await res.json();
      if (data.success) {
        setInputText('');
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            jid: selectedJid,
            remitente: 'asesor',
            contenido: text,
            timestamp: Date.now()
          }
        ]);
        toast.success('Mensaje enviado al cliente ✅');
      } else {
        toast.error(data.error || 'Error al enviar mensaje');
      }
    } catch (err) {
      toast.error('Error de conexión al enviar mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  // Formateador de teléfono para mostrar
  const formatPhone = (jid) => {
    if (!jid) return '';
    const num = jid.split('@')[0];
    return `+${num}`;
  };

  // Formateador de fecha/hora para mensajes
  const formatMsgTime = (ts) => {
    if (!ts) return '';
    const date = new Date(Number(ts));
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleCopyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.info('Número copiado al portapapeles');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleInsertShortcut = (text) => {
    setInputText(text);
    setShortcutsModalOpen(false);
    toast.info('Atajo copiado al cuadro de texto. Presiona Enviar cuando desees.');
  };

  // Filtrar chats por término de búsqueda
  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.toLowerCase();
    const name = (s.push_name || '').toLowerCase();
    const phone = (s.jid || '').toLowerCase();
    const lastMsg = (s.ultimo_mensaje_texto || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
  });

  return (
    <div className="h-[calc(100vh-6.5rem)] max-w-7xl mx-auto flex flex-col space-y-3 animate-fade-in-up">
      {/* ALERTA CRÍTICA: WHATSAPP DESCONECTADO (Con botón de acción directa) */}
      {!isConnected && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#2a1707] to-amber-950/80 border-2 border-amber-500/60 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>WhatsApp no está conectado al sistema</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  Desconectado
                </span>
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                El Live Inbox y las respuestas automáticas del bot están en pausa hasta que vincules tu teléfono celular escaneando el código QR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('whatsapp')}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-orange-500/30 active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
          >
            <QrCode size={16} />
            <span>Vincular WhatsApp Ahora</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Main Inbox Container */}
      <div className="flex-1 min-h-0 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        {/* COLUMNA IZQUIERDA: Lista de Conversaciones (Oculta en móvil si hay chat seleccionado) */}
        <div className={`w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col shrink-0 bg-[#070b14] ${
          selectedJid ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header de la lista */}
          <div className="p-3.5 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Live Inbox</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {isConnected ? 'En línea con WhatsApp' : 'Desconectado de WhatsApp'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={loadInbox}
                  disabled={loadingChats}
                  title="Actualizar lista de chats"
                  className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                >
                  <RefreshCw size={14} className={loadingChats ? 'animate-spin' : ''} />
                </button>

                {sessions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllInbox}
                    title="Vaciar todo el historial del Live Inbox"
                    className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Input de búsqueda */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar cliente, número o mensaje..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Lista scrollable de chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <MessageSquare size={28} className="mx-auto opacity-40" />
                <p className="text-xs">No hay conversaciones registradas</p>
                <span className="text-[10px] text-slate-600 block leading-relaxed">
                  Los chats de clientes aparecerán aquí automáticamente cuando escriban a tu línea de WhatsApp.
                </span>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isSelected = selectedJid === session.jid;
                const isPaused = session.bot_pausado === 1 || session.bot_pausado === '1';
                const phone = formatPhone(session.jid);
                const lastMsg = session.ultimo_mensaje_texto || 'Consulta recibida';
                const isClient = session.ultimo_remitente === 'cliente';

                return (
                  <div
                    key={session.jid}
                    onClick={() => setSelectedJid(session.jid)}
                    className={`p-3 cursor-pointer transition flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border-l-4 border-orange-500'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Avatar con indicador */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                        {(session.push_name || 'C').charAt(0)}
                      </div>
                      {isPaused ? (
                        <span
                          title="Bot pausado por asesor (Atención manual)"
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-[#070b14] flex items-center justify-center text-[8px] text-slate-950 font-black"
                        >
                          P
                        </span>
                      ) : (
                        <span
                          title="Bot respondiendo automáticamente"
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070b14]"
                        ></span>
                      )}
                    </div>

                    {/* Información del chat */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white truncate">
                          {session.push_name || phone}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
                          {formatMsgTime(session.ultimo_mensaje_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                        {isClient ? '' : '↪ '}
                        {lastMsg}
                      </p>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-slate-500 font-mono truncate">
                          {phone}
                        </span>
                        {isPaused ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                            Manual
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                            Bot Activo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: Conversación Activa */}
        {selectedJid ? (
          <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1d] w-full">
            {/* Header del chat abierto */}
            <div className="p-3 sm:p-3.5 border-b border-slate-800/80 bg-[#070b14] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Botón Volver a Lista en Móvil */}
                <button
                  type="button"
                  onClick={() => setSelectedJid(null)}
                  className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition shrink-0"
                  title="Volver a la lista de chats"
                  aria-label="Volver a lista de chats"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold uppercase text-xs sm:text-sm shrink-0">
                  {(activeSession?.push_name || 'C').charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">
                      {activeSession?.push_name || 'Cliente de WhatsApp'}
                    </h4>
                    {activeSession?.bot_pausado ? (
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                        Pausado
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="hidden xs:inline">Bot</span> Activo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="font-mono">{formatPhone(selectedJid)}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(formatPhone(selectedJid))}
                      className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      title="Copiar número de teléfono"
                    >
                      {copiedPhone ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                    {activeSession?.ultimo_producto_nombre && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="truncate text-slate-300">
                          📦 {activeSession.ultimo_producto_nombre}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción superior del chat */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Botón Limpiar conversación */}
                <button
                  type="button"
                  onClick={handleClearCurrentChat}
                  title="Limpiar mensajes de esta conversación"
                  className="h-9 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Limpiar Chat</span>
                </button>

                {/* Botón de Pausa/Reanudación del Bot por Chat (Human Takeover) */}
                <button
                  type="button"
                  onClick={handleToggleBotPause}
                  className={`h-9 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                    activeSession?.bot_pausado
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  }`}
                  title={
                    activeSession?.bot_pausado
                      ? 'Reanudar bot para que vuelva a responder automáticamente'
                      : 'Pausar bot para atender tú manualmente sin interrupciones'
                  }
                >
                  {activeSession?.bot_pausado ? (
                    <>
                      <PlayCircle size={15} />
                      <span>Reanudar Bot</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle size={15} />
                      <span>Pausar Bot (Atender Yo)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Banner de Estado del Bot */}
            {activeSession?.bot_pausado ? (
              <div className="bg-amber-950/40 border-b border-amber-500/25 px-4 py-2 text-[11px] text-amber-300 flex items-center justify-between">
                <span>
                  ✋ <strong>El bot está silenciado para este cliente:</strong> Puedes escribir y despachar libremente. El bot no intervendrá hasta que hagas clic en "Reanudar Bot".
                </span>
              </div>
            ) : null}

            {/* Contenedor de Mensajes (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#080d1a]/60">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-xs">Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <MessageSquare size={32} className="opacity-30" />
                  <p className="text-xs">No hay mensajes recientes en esta conversación</p>
                  <p className="text-[11px] text-slate-600">Puedes escribirle al cliente con los atajos o la barra inferior.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isFromClient = msg.remitente === 'cliente';
                  const isFromBot = msg.remitente === 'bot';
                  const isFromAdvisor = msg.remitente === 'asesor';

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex ${isFromClient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-md ${
                          isFromClient
                            ? 'bg-[#121829] border border-slate-800 text-slate-100 rounded-tl-sm'
                            : isFromAdvisor
                            ? 'bg-gradient-to-r from-emerald-950/80 to-[#071d15] border border-emerald-500/30 text-emerald-100 rounded-tr-sm'
                            : 'bg-gradient-to-r from-[#1b1509] to-[#26180a] border border-orange-500/30 text-orange-100 rounded-tr-sm'
                        }`}
                      >
                        {/* Etiqueta del remitente */}
                        <div className="flex items-center gap-1.5 text-[10px] mb-1 font-semibold">
                          {isFromClient ? (
                            <span className="text-slate-400 flex items-center gap-1">
                              <User size={11} />
                              {activeSession?.push_name || 'Cliente'}
                            </span>
                          ) : isFromAdvisor ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              Asesor Humano
                            </span>
                          ) : (
                            <span className="text-orange-400 flex items-center gap-1">
                              <Bot size={11} />
                              Bot Crastur
                            </span>
                          )}
                        </div>

                        {/* Contenido del mensaje */}
                        <p className="text-xs sm:text-[13px] whitespace-pre-wrap leading-relaxed break-words">
                          {msg.contenido}
                        </p>

                        {/* Hora del mensaje */}
                        <div className="text-right mt-1">
                          <span className="text-[9px] text-slate-400 font-mono opacity-80">
                            {formatMsgTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* BARRA DE ATAJOS RÁPIDOS PROFESIONALES */}
            <div className="px-4 py-2.5 bg-[#070b14] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-thin">
              <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
                <Sparkles size={11} className="text-orange-400" />
                Atajos:
              </span>

              {/* Botones de Atajos Directos */}
              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[0].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>👋 Saludo</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[1].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>📍 Ubicación Maps</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[2].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>💳 Pagos & Tasa BCV</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[3].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>💛 Cashea</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[4].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>🛵 Delivery Caracas</span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertShortcut(CANNED_SHORTCUTS[5].texto)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>⏱️ Apartar 24h</span>
              </button>

              {/* Botón Ver Todos los Atajos */}
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(true)}
                className="ml-auto px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 text-[11px] font-bold transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>Ver Todos (8)</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Barra de Entrada de Mensaje */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[#070b14] border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isConnected
                    ? 'Escribe un mensaje al cliente... (Presiona Enter para enviar)'
                    : '⚠️ Vincula WhatsApp para poder enviar mensajes...'
                }
                disabled={sendingMessage || !isConnected}
                className="flex-1 bg-[#0a0f1d] border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || sendingMessage || !isConnected}
                className="h-10 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-orange-500/20 disabled:opacity-40 active:scale-95 shrink-0 cursor-pointer"
              >
                {sendingMessage ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    <span>Enviar</span>
                    <Send size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <MessageSquare size={30} />
            </div>
            <h4 className="text-base font-bold text-white">Selecciona una conversación</h4>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Elige un chat de la lista izquierda para supervisar mensajes, pausar el bot automático y responder directamente como asesor de ventas de Crastur.
            </p>
          </div>
        )}
      </div>

      {/* MODAL / BANCO COMPLETO DE ATAJOS COMERCIALES */}
      {shortcutsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShortcutsModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl bg-[#0a0f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Banco de Atajos Comerciales Crastur</h3>
                  <p className="text-[11px] text-slate-400">Plantillas de respuesta rápida con información oficial completa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {CANNED_SHORTCUTS.map((item) => {
                const IconComponent = item.icono;
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-[#070b14] border border-slate-800/80 rounded-2xl hover:border-orange-500/40 transition space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-orange-400 flex items-center justify-center">
                          <IconComponent size={14} />
                        </div>
                        <h4 className="text-xs font-bold text-white">{item.titulo}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                          {item.categoria}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInsertShortcut(item.texto)}
                        className="px-3 py-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        Usar Atajo
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed bg-[#0a0f1d] p-3 rounded-xl border border-slate-800/50">
                      {item.texto}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
