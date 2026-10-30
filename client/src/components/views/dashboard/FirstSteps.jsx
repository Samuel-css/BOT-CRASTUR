export default function FirstSteps({ pasosPendientes, productsCount, onNavigate }) {
  return (
    <div className="bg-gradient-to-br from-orange-950/40 via-[#11192e] to-[#0a0f1d] border border-orange-500/30 rounded-3xl p-4 sm:p-5 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center text-lg shrink-0">
          🚀
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Primeros pasos para dejar Crastur listo</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Esta guía se completa sola. Cuando todo esté en verde, el bot atenderá a tus clientes con normalidad.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('whatsapp')}
              className={`text-left p-3 rounded-2xl border transition cursor-pointer ${pasosPendientes.whatsapp ? 'bg-[#070b14] border-slate-800 hover:border-orange-500/50' : 'bg-emerald-950/20 border-emerald-800/40'}`}
            >
              <div className="flex items-center gap-2">
                <span>{pasosPendientes.whatsapp ? '1️⃣' : '✅'}</span>
                <span className="text-xs font-bold text-white">Conectar WhatsApp</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {pasosPendientes.whatsapp ? 'Escanea el QR con el teléfono de la tienda.' : 'WhatsApp conectado.'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('products')}
              className={`text-left p-3 rounded-2xl border transition cursor-pointer ${pasosPendientes.catalogo ? 'bg-[#070b14] border-slate-800 hover:border-orange-500/50' : 'bg-emerald-950/20 border-emerald-800/40'}`}
            >
              <div className="flex items-center gap-2">
                <span>{pasosPendientes.catalogo ? '2️⃣' : '✅'}</span>
                <span className="text-xs font-bold text-white">Cargar el catálogo</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {pasosPendientes.catalogo ? 'Agrega productos o importa tu Excel/CSV.' : `${productsCount} producto(s) cargados.`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('settings')}
              className={`text-left p-3 rounded-2xl border transition cursor-pointer ${pasosPendientes.tasa ? 'bg-[#070b14] border-slate-800 hover:border-orange-500/50' : 'bg-emerald-950/20 border-emerald-800/40'}`}
            >
              <div className="flex items-center gap-2">
                <span>{pasosPendientes.tasa ? '3️⃣' : '✅'}</span>
                <span className="text-xs font-bold text-white">Revisar la tasa BCV</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {pasosPendientes.tasa ? 'Sincroniza o configura una tasa manual.' : 'Tasa lista para cotizar.'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('settings')}
              className={`text-left p-3 rounded-2xl border transition cursor-pointer ${pasosPendientes.asesor ? 'bg-[#070b14] border-slate-800 hover:border-orange-500/50' : 'bg-emerald-950/20 border-emerald-800/40'}`}
            >
              <div className="flex items-center gap-2">
                <span>{pasosPendientes.asesor ? '4️⃣' : '✅'}</span>
                <span className="text-xs font-bold text-white">Bot y asesor</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {pasosPendientes.asesor ? 'Activa “Silenciar el bot cuando un vendedor escribe”.' : 'El bot se calla cuando atiende un asesor.'}
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
