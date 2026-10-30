/**
 * ============================================================================
 * BANDEJA DE ENTRADA EN VIVO: LIVE INBOX & HUMAN TAKEOVER (LIVEINBOXVIEW.JSX)
 * ============================================================================
 * Provee la interfaz de atención en tiempo real entre asesores humanos y clientes de WhatsApp:
 * - Streaming bidireccional de mensajes mediante WebSocket
 * - Human Takeover: Pausar/reanudar intervención automática del bot por chat individual
 * - Biblioteca de atajos rápidos con respuestas comerciales contextualizadas (Caracas, Cashea, BCV)
 * - Ficha lateral del cliente con estatus de apartado de 24 horas y contacto
 *
 * [ANTI-BANEO META 2025]
 * - Envío manual a través de la cola con presencia 'composing' y retardo estocástico.
 * - Deduplicación entre envíos optimistas y confirmaciones WebSocket en una ventana de 15 segundos.
 *
 * [MERCADO VENEZUELA]
 * - Atajos con cotizaciones BCV actualizadas, coordenadas en San Agustín Norte y cálculo Cashea.
 *
 * [MODULARIZACIÓN] Estado, efectos y acciones viven en ./inbox/useInbox.js y
 * ./inbox/useChatActions.js; la UI se compone de los componentes de ./inbox/.
 */

import { MessageSquare } from 'lucide-react';
import useInbox from './inbox/useInbox';
import useChatActions from './inbox/useChatActions';
import { createCannedShortcuts, FALLBACK_BCV_RATE } from './inbox/constants';
import ChatList from './inbox/ChatList';
import ChatHeader from './inbox/ChatHeader';
import MessageList from './inbox/MessageList';
import Composer from './inbox/Composer';
import ShortcutsModal from './inbox/ShortcutsModal';
import { WaDisconnectedAlert, ApartadoBanner, BotStatusBanner, HandoffBanner } from './inbox/InboxAlerts';

export default function LiveInboxView({ waStatus, onNavigate, bcvRate, onRequestConfirm, settings = {} }) {
  const isConnected = waStatus?.status === 'connected';
  const inbox = useInbox();
  const actions = useChatActions({
    selectedJid: inbox.selectedJid,
    setSelectedJid: inbox.setSelectedJid,
    activeSession: inbox.activeSession,
    setActiveSession: inbox.setActiveSession,
    setSessions: inbox.setSessions,
    setMessages: inbox.setMessages,
    appendDeduplicatedMessage: inbox.appendDeduplicatedMessage,
    isConnected,
    onNavigate,
    onRequestConfirm
  });

  const effectiveRate = bcvRate || FALLBACK_BCV_RATE;
  const shortcuts = createCannedShortcuts({ settings, effectiveRate });

  // [HUMAN TAKEOVER AUTOMÁTICO] ¿El bot está pausado porque un asesor tomó el chat?
  const pausadoPorAsesor = !!(inbox.activeSession?.bot_pausado && inbox.activeSession?.bot_pausado_por === 'asesor');

  // Texto humano del tiempo de reactivación automática configurado
  const reactivacionTexto = (() => {
    const min = parseInt(inbox.botSettings.reactivar_bot_minutos || '180', 10);
    if (!min || min <= 0) return 'sin reactivación automática';
    if (min >= 60) {
      const horas = Math.round((min / 60) * 10) / 10;
      return horas === 1 ? '1 hora' : `${horas} horas`;
    }
    return `${min} minutos`;
  })();

  // [DIAGNÓSTICO HUMAN TAKEOVER] Hora relativa de la última respuesta del asesor.
  // Sirve para confirmar que la PC está recibiendo lo que el asesor escribe en el teléfono.
  const asesorUltimoTexto = (() => {
    const ts = Number(inbox.activeSession?.asesor_ultimo_at) || 0;
    if (!ts) return null;
    const minutos = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (minutos < 1) return 'hace menos de 1 minuto';
    if (minutos < 60) return `hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  })();

  return (
    <div className="h-[calc(100vh-6.5rem)] max-w-7xl mx-auto flex flex-col space-y-3 animate-fade-in-up">
      <WaDisconnectedAlert isConnected={isConnected} onNavigate={onNavigate} />

      {/* Main Inbox Container */}
      <div className="flex-1 min-h-0 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        <ChatList
          isConnected={isConnected}
          sessions={inbox.sessions}
          selectedJid={inbox.selectedJid}
          onSelectChat={inbox.setSelectedJid}
          onDeleteChat={actions.handleDeleteChatByJid}
          searchTerm={inbox.searchTerm}
          onSearchChange={inbox.setSearchTerm}
          loadingChats={inbox.loadingChats}
          onRefresh={inbox.loadInbox}
          onClearAll={actions.handleClearAllInbox}
        />

        {/* COLUMNA DERECHA: Conversación Activa */}
        {inbox.selectedJid ? (
          <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1d] w-full">
            <ChatHeader
              selectedJid={inbox.selectedJid}
              activeSession={inbox.activeSession}
              pausadoPorAsesor={pausadoPorAsesor}
              asesorUltimoTexto={asesorUltimoTexto}
              copiedPhone={actions.copiedPhone}
              onBack={() => inbox.setSelectedJid(null)}
              onCopyPhone={actions.handleCopyPhone}
              onClearChat={actions.handleClearCurrentChat}
              onToggleBotPause={actions.handleToggleBotPause}
            />

            <ApartadoBanner
              activeSession={inbox.activeSession}
              effectiveRate={effectiveRate}
              onNavigate={onNavigate}
            />

            <HandoffBanner activeSession={inbox.activeSession} />

            <BotStatusBanner
              activeSession={inbox.activeSession}
              pausadoPorAsesor={pausadoPorAsesor}
              botSettings={inbox.botSettings}
              reactivacionTexto={reactivacionTexto}
            />

            <MessageList
              messages={inbox.messages}
              loadingMessages={inbox.loadingMessages}
              activeSession={inbox.activeSession}
              messagesEndRef={inbox.messagesEndRef}
            />

            <Composer
              shortcuts={shortcuts}
              onInsertShortcut={actions.handleInsertShortcut}
              onOpenShortcuts={() => actions.setShortcutsModalOpen(true)}
              inputText={actions.inputText}
              onInputChange={actions.setInputText}
              onSend={actions.handleSendMessage}
              sendingMessage={actions.sendingMessage}
              isConnected={isConnected}
            />
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

      <ShortcutsModal
        open={actions.shortcutsModalOpen}
        onClose={() => actions.setShortcutsModalOpen(false)}
        shortcuts={shortcuts}
        onInsertShortcut={actions.handleInsertShortcut}
      />
    </div>
  );
}
