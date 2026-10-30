import { DollarSign } from 'lucide-react';
import { handleNumericKeyDown, sanitizeCurrency } from '../../../utils/inputSanitizers';

export default function ManualCalculator({ manualUsd, setManualUsd }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
        Monto del Repuesto o Combo en Dólares ($ USD):
      </label>
      <div className="relative">
        <DollarSign size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          inputMode="decimal"
          value={manualUsd}
          onKeyDown={(e) => handleNumericKeyDown(e, true)}
          onChange={(e) => setManualUsd(sanitizeCurrency(e.target.value, 0.01, 50000))}
          placeholder="0.00"
          className="w-full bg-[#070b14] border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-orange-500 transition"
        />
      </div>
    </div>
  );
}
