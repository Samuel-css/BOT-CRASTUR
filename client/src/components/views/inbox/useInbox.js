/**
 * @file useInbox.js
 * @description Estado y efectos del Live Inbox: carga de sesiones y mensajes, deduplicación,
 * autoscroll y streaming en tiempo real por WebSocket. Extraído de LiveInboxView.jsx.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Helper de deduplicación robusto (evita duplicados entre WebSocket y envío optimista)
export function appendDeduplicatedMessage(prevList, newMsg) {
  if (!newMsg || !newMsg.contenido) return prevList;
  const newNorm = String(newMsg.contenido).replace(/\r\n/g, '\n').trim();
  const newTime = Number(newMsg.timestamp) || Date.now();

  const existingIndex = prevList.findIndex((m) => {
    // 1. Mismo ID oficial de BD
    if (m.id && newMsg.id && typeof m.id === 'number' && typeof newMsg.id === 'number' && m.id === newMsg.id) {
      return true;
    }
    // 2. Mismo remitente y contenido en una ventana de 15 segundos
    const mNorm = String(m.contenido || '').replace(/\r\n/g, '\n').trim();
    if (m.remitente === newMsg.remitente && mNorm === newNorm) {
      const mTime = Number(m.timestamp) || 0;
      if (Math.abs(mTime - newTime) < 15000) {
        return true;
      }
    }
    return false;
  });

  if (existingIndex !== -1) {
    const updated = [...prevList];
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...newMsg,
      id: (typeof newMsg.id === 'number' ? newMsg.id : updated[existingIndex].id)
    };
    return updated;
  }

  return [...prevList, newMsg];
}

export default function useInbox() {
  const [sessions, setSessions] = useState([]);
  const [selectedJid, setSelectedJid] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // [HUMAN TAKEOVER AUTOMÁTICO] Configuración de la pausa/reactivación del bot por asesor
  const [botSettings, setBotSettings] = useState({ reactivar_bot_minutos: '180', auto_pausa_asesor: '1' });
  const messagesEndRef = useRef(null);

  // Cargar lista de sesiones (chats recientes)
  const loadInbox = async () => {
    setLoadingChats(true);
    try {
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
        // En Desktop/Tablet seleccionar el primero automáticamente; en teléfonos móviles mostrar la lista completa
        if (!selectedJid && data.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
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
        const raw = data.messages || [];
        const clean = [];
        for (const m of raw) {
          const isDup = clean.some(c => 
            (c.id === m.id) ||
            (c.remitente === m.remitente && 
             String(c.contenido).replace(/\r\n/g, '\n').trim() === String(m.contenido).replace(/\r\n/g, '\n').trim() && 
             Math.abs((Number(c.timestamp) || 0) - (Number(m.timestamp) || 0)) < 3000)
          );
          if (!isDup) clean.push(m);
        }
        setMessages(clean);
      }
    } catch (err) {
      console.error('Error cargando mensajes de chat:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadInbox();

    // [HUMAN TAKEOVER AUTOMÁTICO] Leer configuración de reactivación para explicarla en pantalla
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setBotSettings({
            reactivar_bot_minutos: data.reactivar_bot_minutos ?? '180',
            auto_pausa_asesor: data.auto_pausa_asesor ?? '1'
          });
        }
      })
      .catch(() => {});
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

  // [INTEGRIDAD] Referencia viva al chat seleccionado, para que el WebSocket
  // no tenga que reconectarse cada vez que el usuario cambia de conversación.
  const selectedJidRef = useRef(selectedJid);
  useEffect(() => { selectedJidRef.current = selectedJid; }, [selectedJid]);

  // Escuchar mensajes en tiempo real vía WebSocket (una sola conexión durante toda la vista)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;
    // [RENDIMIENTO] Evita recargar toda la lista de chats en cada mensaje recibido.
    let inboxReloadTimer = null;
    const scheduleInboxReload = () => {
      if (inboxReloadTimer) clearTimeout(inboxReloadTimer);
      inboxReloadTimer = setTimeout(() => { inboxReloadTimer = null; loadInbox(); }, 900);
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        const currentJid = selectedJidRef.current;
        try {
          const { type, data } = JSON.parse(event.data);
          if (type === 'live_chat_message') {
            if (data?.action === 'deleted') {
              setSessions((prev) => prev.filter((s) => s.jid !== data.jid));
              if (currentJid === data.jid) {
                setSelectedJid(null);
                setActiveSession(null);
                setMessages([]);
              }
              return;
            }
            if (data?.action === 'all_deleted' || data?.action === 'all_cleared') {
              setSessions([]);
              setMessages([]);
              setSelectedJid(null);
              setActiveSession(null);
              return;
            }
            scheduleInboxReload();

            if (data && data.jid === currentJid) {
              setMessages((prev) => appendDeduplicatedMessage(prev, {
                id: data.id || Date.now(),
                jid: data.jid,
                remitente: data.remitente,
                contenido: data.contenido,
                timestamp: data.timestamp || Date.now()
              }));
            }
          } else if (type === 'chat_pause_changed') {
            if (data && data.jid === currentJid) {
              setActiveSession((prev) => prev ? {
                ...prev,
                bot_pausado: data.pausado ? 1 : 0,
                bot_pausado_por: data.pausado ? (data.por || prev.bot_pausado_por) : null,
                // [DIAGNÓSTICO] Refresca en vivo la hora del último mensaje del asesor.
                ...(data.pausado && data.por === 'asesor' ? { asesor_ultimo_at: data.at || Date.now() } : {}),
                // [HANDOFF] Refresca el estado y los tiempos del SLA en vivo.
                ...(data.handoffEstado ? { handoff_estado: data.handoffEstado } : {}),
                ...(data.handoffVenceAt ? { handoff_vence_at: data.handoffVenceAt } : {}),
                ...(data.handoffSolicitadoAt ? { handoff_solicitado_at: data.handoffSolicitadoAt } : {}),
                ...(data.handoffAtendidoAt ? { handoff_atendido_at: data.handoffAtendidoAt } : {})
              } : null);

              // [HANDOFF] Avisos claros para el vendedor.
              if (data.handoff && data.notify !== false) {
                const hora = data.handoffVenceTexto ? ` Límite: ${data.handoffVenceTexto}.` : '';
                toast.warning(`⏳ ${data.cliente || 'El cliente'} pidió un asesor.${hora}`);
              } else if (data.handoffVencido) {
                toast.error(`🔴 SLA vencido: ${data.cliente || 'el cliente'} sigue sin respuesta. El bot retomó.`);
              } else if (data.auto && data.pausado && data.origen === 'telefono' && data.notify !== false) {
                toast.warning('Un asesor respondió en este chat: el bot se pausó automáticamente.');
              } else if (data.auto && !data.pausado && !data.handoffEstado) {
                toast.success('El bot retomó este chat automáticamente.');
              }
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
      if (inboxReloadTimer) clearTimeout(inboxReloadTimer);
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sessions,
    setSessions,
    selectedJid,
    setSelectedJid,
    activeSession,
    setActiveSession,
    messages,
    setMessages,
    loadingChats,
    loadingMessages,
    searchTerm,
    setSearchTerm,
    botSettings,
    loadInbox,
    loadMessages,
    appendDeduplicatedMessage,
    messagesEndRef
  };
}
