/**
 * @file MessageList.jsx
 * @description Contenedor scrollable de mensajes del Live Inbox con estados de carga
 * y conversación vacía. Extraído de LiveInboxView.jsx.
 */

import { MessageSquare, RefreshCw } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function MessageList({ messages, loadingMessages, activeSession, messagesEndRef }) {
  return (
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
        messages.map((msg, index) => (
          <MessageBubble
            key={msg.id || index}
            msg={msg}
            activeSession={activeSession}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
