import { Users, Plus, Edit2, Trash2, Phone, Briefcase } from 'lucide-react';

export default function SellersView({
  sellers,
  onOpenAddModal,
  onEditSeller,
  onDeleteSeller
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0f1d] p-5 sm:p-6 rounded-3xl border border-slate-800/80 shadow-xl">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users size={18} className="text-orange-400" />
            Asesores de Ventas y Equipo Técnico
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            El bot entregará estos contactos con enlaces directos para que los clientes puedan chatear o llamar con un solo toque.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs transition shadow-lg shadow-orange-500/20 shrink-0 active:scale-95"
        >
          <Plus size={15} />
          <span>Agregar Asesor</span>
        </button>
      </div>

      {sellers.length === 0 ? (
        <div className="p-12 text-center bg-[#0a0f1d] border border-slate-800/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#070b14] border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Users size={28} />
          </div>
          <h4 className="font-bold text-base text-white">No hay asesores registrados aún</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Cuando un cliente pida hablar con un vendedor, el bot le indicará educadamente que el equipo atiende directamente en tienda física en Caracas hasta que registres tus números oficiales.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 mt-2"
          >
            <Plus size={15} />
            <span>Registrar Primer Asesor</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sellers.map((s) => (
            <div
              key={s.id}
              className="p-5 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl flex items-center justify-between shadow-xl card-hover"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center font-bold text-base shrink-0">
                  {s.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">{s.nombre}</h4>
                  <p className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {s.telefono}
                  </p>
                  <span className="mt-1 text-[10px] px-2 py-0.5 rounded-md bg-[#070b14] text-slate-300 border border-slate-800 flex items-center gap-1 inline-flex">
                    <Briefcase size={10} className="text-orange-400" /> {s.departamento || 'Repuestos & Ventas'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditSeller(s)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                  title="Editar asesor"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDeleteSeller(s.id)}
                  className="p-2 hover:bg-rose-950/40 rounded-xl text-rose-400 hover:text-rose-300 transition"
                  title="Eliminar asesor"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
