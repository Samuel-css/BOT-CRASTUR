import { Layers, DollarSign } from 'lucide-react';

export default function ModeSelector({ calcMode, setCalcMode }) {
  return (
    <div className="flex items-center justify-center">
      <div className="bg-[#0a0f1d] p-1.5 rounded-2xl border border-slate-800 flex items-center shadow-lg">
        <button
          type="button"
          onClick={() => setCalcMode('catalog')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            calcMode === 'catalog'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={15} />
          <span>Elegir o Combinar Repuestos del Catálogo</span>
        </button>
        <button
          type="button"
          onClick={() => setCalcMode('manual')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            calcMode === 'manual'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign size={15} />
          <span>Monto Libre en Dólares ($)</span>
        </button>
      </div>
    </div>
  );
}
