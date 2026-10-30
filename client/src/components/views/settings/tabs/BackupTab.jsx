/**
 * @file BackupTab.jsx
 * @description Pestaña "Copia de Seguridad": descarga y restauración de Catálogo + Asesores.
 */

import { Database, Download, Upload, AlertCircle } from 'lucide-react';
import { cardCls } from '../styles';

export default function BackupTab({
  fileInputRef,
  handleDownloadMasterJson,
  handleSelectRestoreFile,
  handleFileChange,
  restoring
}) {
  return (
            <div className="space-y-6">
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Copias de Seguridad de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Guarda un archivo de respaldo o restaura datos en otra computadora</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Descargar Catálogo y Asesores */}
                  <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Download size={14} className="text-orange-400" />
                        Descargar Catálogo y Asesores (.json)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Exporta en un solo archivo tus <strong>productos</strong> y tus <strong>asesores de venta</strong>. Es portable y compatible entre versiones. No incluye configuración ni chats.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleDownloadMasterJson}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer active:scale-95"
                      >
                        <Download size={14} />
                        <span>Descargar Catálogo y Asesores</span>
                      </button>
                    </div>
                  </div>

                  {/* Restaurar Catálogo y Asesores */}
                  <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Upload size={14} className="text-amber-400" />
                        Restaurar Catálogo y Asesores (.json)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Sube un archivo de <strong>Catálogo y Asesores</strong>. Se agregan o actualizan los productos y asesores; tu configuración y chats actuales NO se modifican.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".json"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={handleSelectRestoreFile}
                      disabled={restoring}
                      className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Upload size={14} />
                      <span>{restoring ? 'Restaurando...' : 'Seleccionar Archivo (.json)'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-800/40 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-sky-200/90 leading-relaxed">
                    <strong>Consejo de migración:</strong> Este respaldo se puede llevar a otra versión o computadora. Descárgalo antes de reinstalar o resetear el sistema y vuelve a cargarlo después.
                  </p>
                </div>
              </div>
            </div>
  );
}
