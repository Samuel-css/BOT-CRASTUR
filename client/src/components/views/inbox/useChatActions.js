/**
 * @file useChatActions.js
 * @description Acciones del Live Inbox: pausa del bot, borrado de chats, vaciado del inbox,
 * envío manual, copia de teléfono e inserción de atajos. Extraído de LiveInboxView.jsx.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { formatPhone } from './formatters';

export default function useChatActions({
  selectedJid,
  setSelectedJid,
  activeSession,
  setActiveSession,
  setSessions,
  setMessages,
  appendDeduplicatedMessage,
  isConnected,
  onNavigate,
  onRequestConfirm
}) {
  const [inputText, setInputText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

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
        setActiveSession((prev) => ({
          ...prev,
          bot_pausado: nextState ? 1 : 0,
          bot_pausado_por: nextState ? (data.por || 'manual') : null
        }));
        setSessions((prev) =>
          prev.map((s) => (s.jid === selectedJid
            ? { ...s, bot_pausado: nextState ? 1 : 0, bot_pausado_por: nextState ? (data.por || 'manual') : null }
            : s))
        );
        if (nextState) {
          toast.warning('Ahora atiendes tú este chat. El bot no responderá hasta que lo reanudes.');
        } else {
          toast.success('Bot reanudado. Volverá a responder automáticamente en este chat.');
        }
      }
    } catch (err) {
      toast.error('Error al cambiar el estado del bot para este chat');
    }
  };

  // Eliminar un chat individual por JID con confirmación segura
  const handleDeleteChatByJid = (jidToDelete, clientName) => {
    if (!jidToDelete) return;
    const name = clientName || formatPhone(jidToDelete);

    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Eliminar esta conversación?',
        message: `Se eliminará definitivamente la conversación con "${name}" de la bandeja de entrada. Si el cliente vuelve a escribir, entrará como una nueva conversación normal sin perder nada.`,
        confirmText: 'Sí, Eliminar Chat',
        isDanger: true,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/inbox/${encodeURIComponent(jidToDelete)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              setSessions((prev) => prev.filter((s) => s.jid !== jidToDelete));
              if (selectedJid === jidToDelete) {
                setSelectedJid(null);
                setActiveSession(null);
                setMessages([]);
              }
              toast.info(`Chat con "${name}" eliminado de la bandeja.`);
            }
          } catch (e) {
            toast.error('Error al eliminar la conversación');
          }
        }
      });
    }
  };

  // Limpiar mensajes del chat actual abierto
  const handleClearCurrentChat = () => {
    if (!selectedJid) return;
    const clientName = activeSession?.push_name || formatPhone(selectedJid);
    handleDeleteChatByJid(selectedJid, clientName);
  };

  // Vaciar todas las conversaciones del inbox
  const handleClearAllInbox = () => {
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Vaciar todo el Live Inbox?',
        message: 'Esta acción borrará el historial de mensajes de todas las conversaciones para dejar la bandeja completamente limpia. Los repuestos y apartados no serán afectados.',
        confirmText: 'Sí, Vaciar Todo el Inbox',
        checkboxLabel: 'Confirmo que deseo vaciar todos los mensajes de la bandeja',
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
        const sentMsg = {
          id: data.id || `manual_${Date.now()}`,
          jid: selectedJid,
          remitente: 'asesor',
          contenido: text,
          timestamp: data.timestamp || Date.now()
        };
        setMessages((prev) => appendDeduplicatedMessage(prev, sentMsg));
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

  return {
    inputText,
    setInputText,
    sendingMessage,
    copiedPhone,
    shortcutsModalOpen,
    setShortcutsModalOpen,
    handleToggleBotPause,
    handleDeleteChatByJid,
    handleClearCurrentChat,
    handleClearAllInbox,
    handleSendMessage,
    handleCopyPhone,
    handleInsertShortcut
  };
}
