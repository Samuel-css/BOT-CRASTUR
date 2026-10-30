import { formatRate } from '../../../utils/formatters';

export default function LevelSelector({ selectedNivel, setSelectedNivel, bcvRate }) {
  return (
    <>
      {/* Nivel de Usuario en Cashea */}
      <div>
        <label className="text-xs font-semibold text-slate-300 block mb-2">
          Nivel de Usuario en Cashea:
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedNivel(1)}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
              selectedNivel === 1
                ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="block text-xs font-bold">Nivel 1</span>
            <span className="text-[11px] font-mono">40% Inicial</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedNivel(2)}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
              selectedNivel === 2
                ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="block text-xs font-bold">Nivel 2</span>
            <span className="text-[11px] font-mono">30% Inicial</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedNivel(3)}
            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
              selectedNivel === 3
                ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="block text-xs font-bold">Nivel 3+</span>
            <span className="text-[11px] font-mono">20% Inicial</span>
          </button>
        </div>
      </div>

      <div className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">Tasa Oficial BCV:</span>
        <span className="text-orange-400 font-bold">Bs. {formatRate(bcvRate)} / USD</span>
      </div>
    </>
  );
}
