/**
 * @file useSystemActions.js
 * @description Acciones de ciclo de vida: conectar/resetear/cerrar WhatsApp, pausa
 * global del bot y apagado controlado del sistema.
 */

export default function useSystemActions({
  setLoading,
  setWaStatus,
  setConfirmModal,
  setIsSystemShutdown,
  botPausedGlobal,
  setBotPausedGlobal,
  toast
}) {
  const handleStartWhatsApp = () => {
    setLoading(true);
    fetch('/api/whatsapp/start', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        setLoading(false);
        setWaStatus(prev => ({ ...prev, status: 'connecting' }));
        toast.info('Conectando con WhatsApp...');
      })
      .catch(() => {
        setLoading(false);
        toast.error('Error al conectar con WhatsApp');
      });
  };

  const handleResetWhatsApp = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Restablecer conexión de WhatsApp?',
      message: 'Esta acción limpiará las credenciales y sesiones guardadas de WhatsApp y generará un nuevo código QR desde cero. Deberás volver a escanearlo con el teléfono.',
      confirmText: 'Sí, Generar Nuevo QR',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        toast.info('Restableciendo sesión y generando nuevo código QR...');
        fetch('/api/whatsapp/reset', { method: 'POST' })
          .then(r => r.json())
          .then(() => {
            setLoading(false);
            setWaStatus({ status: 'connecting', qr: null, user: null });
            toast.success('Sesión limpia. Generando código QR...');
          })
          .catch((err) => {
            setLoading(false);
            toast.error('Error al reiniciar WhatsApp: ' + err.message);
          });
      }
    });
  };

  const handleOpenLogoutConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Cerrar sesión de WhatsApp?',
      message: 'El bot dejará de responder mensajes automáticos y apartados hasta que vuelvas a escanear el código QR con tu teléfono.',
      confirmText: 'Cerrar Sesión',
      checkboxLabel: 'Vaciar también el historial de chats del Live Inbox (Privacidad)',
      checkboxChecked: false,
      isDanger: true,
      onConfirm: (clearChats) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch('/api/whatsapp/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clearHistory: !!clearChats })
        })
          .then(r => r.json())
          .then((res) => {
            setWaStatus({ status: 'disconnected', qr: null, user: null });
            if (res.cleared) {
              toast.info('Sesión de WhatsApp cerrada y chats eliminados');
            } else {
              toast.info('Sesión de WhatsApp cerrada');
            }
          })
          .catch(() => {});
      }
    });
  };

  const handleToggleGlobalBotPause = () => {
    const nextState = !botPausedGlobal;
    fetch('/api/bot/pause-global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: nextState })
    })
      .then(r => r.json())
      .then(data => {
        if (data.bot_pausado_global !== undefined) {
          setBotPausedGlobal(data.bot_pausado_global);
          if (data.bot_pausado_global) {
            toast.warning('Bot PAUSADO globalmente. No responderá automáticamente a ningún chat.');
          } else {
            toast.success('Bot REANUDADO globalmente. Está atendiendo mensajes.');
          }
        }
      })
      .catch(() => {
        toast.error('Error al cambiar el estado del bot');
      });
  };

  const handleShutdownSystem = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Deseas apagar el sistema?',
      subtitle: 'Cierre de turno o jornada',
      message: 'Se guardarán todas las ventas, apartados y cambios del día de forma segura.\n\nEl asistente de WhatsApp se pondrá en pausa hasta que vuelvas a abrir el sistema con el acceso directo Crastur de tu Escritorio.',
      confirmText: 'Sí, Apagar Sistema',
      cancelText: 'Seguir Trabajando',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        toast.info('Guardando información y cerrando el sistema...');
        try {
          await fetch('/api/system/shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'user_requested_ui' })
          });
        } catch {
          // El servidor se apaga inmediatamente tras recibir la orden.
        }
        setIsSystemShutdown(true);
      }
    });
  };

  return {
    handleStartWhatsApp,
    handleResetWhatsApp,
    handleOpenLogoutConfirm,
    handleToggleGlobalBotPause,
    handleShutdownSystem
  };
}
