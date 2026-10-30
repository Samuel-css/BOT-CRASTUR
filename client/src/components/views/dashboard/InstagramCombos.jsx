import { Layers } from 'lucide-react';
import { InstagramIcon } from '../../../utils/instagramFormatter';

export default function InstagramCombos({ activeCombos, onOpenProductModal, onCopyComboCaption }) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-orange-400" />
          <h3 className="text-sm font-bold text-white">
            Combos & Kits para Instagram
          </h3>
        </div>
        <button
          onClick={onOpenProductModal}
          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold cursor-pointer"
        >
          <span>+ Nuevo Combo</span>
        </button>
      </div>

      {activeCombos.length === 0 ? (
        <div className="p-6 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-2">
          <p className="text-xs text-slate-400">No hay combos registrados bajo la categoría "Combos & Kits".</p>
          <button
            onClick={onOpenProductModal}
            className="px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold hover:bg-orange-500/30 transition cursor-pointer"
          >
            Crear Primer Combo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeCombos.slice(0, 4).map((combo) => (
            <div
              key={combo.id}
              className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div className="min-w-0 pr-2">
                <h5 className="font-bold text-xs text-white truncate">
                  {combo.modelo}
                </h5>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {combo.descripcion || 'Kit promocional'}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs font-bold text-orange-400 font-mono">
                  ${parseFloat(combo.precio_usd || 0).toFixed(2)}
                </span>
                <button
                  onClick={() => onCopyComboCaption(combo)}
                  title="Copiar post listo para Instagram"
                  className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                >
                  <InstagramIcon size={13} />
                  <span className="hidden sm:inline">Instagram</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
