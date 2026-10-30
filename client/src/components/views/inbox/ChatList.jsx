/**
 * @file ChatList.jsx
 * @description Columna izquierda del Live Inbox: cabecera de estado, buscador y lista
 * scrollable de conversaciones. Extraído de LiveInboxView.jsx.
 */

import { useEffect, useState } from 'react';
import { MessageSquare, Search, RefreshCw, Trash2 } from 'lucide-react';
import ChatListItem from './ChatListItem';

export default function ChatList({
  isConnected,
  sessions,
  selectedJid,
  onSelectChat,
  onDeleteChat,
  searchTerm,
  onSearchChange,
  loadingChats,
  onRefresh,
  onClearAll
}) {
  // [SLA] Re-renderiza cada 30 s para que la cuenta regresiva del asesor no se congele.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filtrar chats por término de búsqueda
  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.toLowerCase();
    const name = (s.push_name || '').toLowerCase();
    const phone = (s.jid || '').toLowerCase();
    const lastMsg = (s.ultimo_mensaje_texto || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
  });

  // Los chats con asesor pendiente o SLA vencido se muestran primero.
  const rankHandoff = (s) => {
    if (s.handoff_estado === 'pendiente') return 0;
    if (s.handoff_estado === 'vencido') return 1;
    return 2;
  };
  const orderedSessions = [...filteredSessions].sort((a, b) => rankHandoff(a) - rankHandoff(b));

  return (
    <div className={`w-full md:w-72 lg:w-80 xl:w-96 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col shrink-0 bg-[#070b14] ${
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
              onClick={onRefresh}
              disabled={loadingChats}
              title="Actualizar lista de chats"
              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw size={14} className={loadingChats ? 'animate-spin' : ''} />
            </button>

            {sessions.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
          orderedSessions.map((session) => (
            <ChatListItem
              key={session.jid}
              session={session}
              isSelected={selectedJid === session.jid}
              onSelect={onSelectChat}
              onDelete={onDeleteChat}
              now={now}
            />
          ))
        )}
      </div>
    </div>
  );
}
