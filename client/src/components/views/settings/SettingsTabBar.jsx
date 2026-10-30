/**
 * @file SettingsTabBar.jsx
 * @description Navegador de pestañas principales de la vista de configuración.
 */

import { TABS } from './constants';

export default function SettingsTabBar({ activeTab, setActiveTab }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-[#070b14] border border-slate-800 rounded-2xl shadow-sm">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
              isActive
                ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-orange-400' : 'text-slate-500'} />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
