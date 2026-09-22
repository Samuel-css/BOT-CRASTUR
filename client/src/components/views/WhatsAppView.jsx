import { QrCode, CheckCircle2, RefreshCw, Smartphone, LogOut } from 'lucide-react';

export default function WhatsAppView({
  waStatus = { status: 'disconnected', qr: null, user: null },
  loading,
  onStartWhatsApp,
  onResetWhatsApp,
  onOpenLogoutConfirm
}) {
  const status = waStatus?.status || 'disconnected';
  const qr = waStatus?.qr || null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="p-6 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl shadow-xl space-y-6">
        <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <QrCode size={18} className="text-orange-400" />
              Conexión a WhatsApp & Estado del Bot
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Vincula la línea de WhatsApp de tu tienda para atender clientes, cotizar repuestos y recibir apartados.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {status === 'connected' ? (
              <button
                type="button"
                onClick={onOpenLogoutConfirm}
                className="h-10 flex items-center gap-2 px-4 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-bold border border-rose-900/50 transition active:scale-95"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStartWhatsApp}
                  disabled={loading}
                  className="h-10 flex items-center gap-2 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  <RefreshCw size={14} className={loading || status === 'connecting' ? 'animate-spin' : ''} />
                  <span>{status === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={onResetWhatsApp}
                  disabled={loading}
                  title="Elimina sesiones caducadas y genera un QR fresco desde cero"
                  className="h-10 flex items-center gap-2 px-4 rounded-xl bg-[#070b14] hover:bg-slate-900 text-orange-400 border border-orange-500/30 hover:border-orange-500/60 font-bold text-xs transition disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  <RefreshCw size={13} />
                  <span>Nuevo QR Limpio</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* State Display */}
        <div className="p-8 bg-[#070b14] rounded-3xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[320px]">
          {status === 'connected' ? (
            <div className="space-y-4 max-w-sm">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={44} />
              </div>
              <h4 className="text-lg font-bold text-white">¡WhatsApp Conectado y Atendiendo!</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                El bot está atendiendo mensajes, cotizando repuestos, registrando apartados de 24 horas y ofreciendo Cashea a tus clientes en tiempo real.
              </p>
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-xs font-mono text-emerald-400 font-bold">
                Línea vinculada: +{waStatus?.user?.phone || 'Activa'}
              </div>
            </div>
          ) : qr ? (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-3xl shadow-2xl inline-block border-4 border-orange-500 shadow-orange-500/20">
                <img src={qr} alt="Código QR WhatsApp" className="w-64 h-64 mx-auto" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">Escanea este código desde WhatsApp</h4>
                <p className="text-xs text-slate-400">
                  Abre WhatsApp en tu teléfono &gt; Dispositivos vinculados &gt; Vincular dispositivo.
                </p>
              </div>
            </div>
          ) : status === 'connecting' ? (
            <div className="space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto">
                <RefreshCw size={30} className="animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">Generando Código QR...</h4>
                <p className="text-xs text-slate-400">
                  Iniciando canal seguro con WhatsApp. En unos segundos verás el código QR en pantalla.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <QrCode size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white">WhatsApp Desconectado</h4>
                <p className="text-xs text-slate-400">
                  Haz clic en el botón naranja de arriba para generar el código QR y conectar la línea de tu tienda.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
