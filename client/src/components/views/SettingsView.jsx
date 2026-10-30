/**
 * @file SettingsView.jsx
 * @description Shell de la vista de configuración. El estado y la lógica viven en
 * ./settings/useSettingsForm.js y cada pestaña en ./settings/tabs/.
 */

import { Settings, Check, RefreshCw } from 'lucide-react';
import { TABS } from './settings/constants';
import useSettingsForm from './settings/useSettingsForm';
import SettingsTabBar from './settings/SettingsTabBar';
import StoreTab from './settings/tabs/StoreTab';
import MessagesTab from './settings/tabs/MessagesTab';
import PaymentsTab from './settings/tabs/PaymentsTab';
import DeliveryTab from './settings/tabs/DeliveryTab';
import BackupTab from './settings/tabs/BackupTab';

export default function SettingsView({ settings, onSaveSettings, onRequestConfirm }) {
  const {
    activeTab,
    setActiveTab,
    saving,
    restoring,
    fileInputRef,
    form,
    setForm,
    subTabMensajes,
    setSubTabMensajes,
    scheduleMode,
    customDays,
    customOpenTime,
    customCloseTime,
    customSunday,
    deliveryZones,
    handleScheduleSelect,
    handleUpdateCustomSchedule,
    togglePaymentItem,
    field,
    insertVariable,
    handleSubmit,
    handleZoneChange,
    handleAddZone,
    handleDeleteZone,
    handleResetZones,
    handleDownloadMasterJson,
    handleSelectRestoreFile,
    handleFileChange
  } = useSettingsForm({ settings, onSaveSettings, onRequestConfirm });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ENCABEZADO PRINCIPAL DE LA VISTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Settings size={22} className="text-orange-400" />
              Configuración de la Tienda y el Bot
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fácil de usar: cambia horarios, activa o apaga formas de pago y estilos de atención con un solo toque.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="self-start sm:self-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>

        {/* NAVEGADOR DE PESTAÑAS (TABS GRANDES Y CLAROS) */}
        <SettingsTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* CONTENIDO PRINCIPAL POR PESTAÑAS */}
        <div key={activeTab} className="space-y-6 animate-fade-in">
          {activeTab === 'tienda' && (
            <StoreTab
              form={form}
              setForm={setForm}
              field={field}
              scheduleMode={scheduleMode}
              handleScheduleSelect={handleScheduleSelect}
              handleUpdateCustomSchedule={handleUpdateCustomSchedule}
              customDays={customDays}
              customOpenTime={customOpenTime}
              customCloseTime={customCloseTime}
              customSunday={customSunday}
            />
          )}

          {activeTab === 'mensajes' && (
            <MessagesTab
              form={form}
              setForm={setForm}
              field={field}
              insertVariable={insertVariable}
              subTabMensajes={subTabMensajes}
              setSubTabMensajes={setSubTabMensajes}
            />
          )}

          {activeTab === 'pagos' && (
            <PaymentsTab form={form} setForm={setForm} togglePaymentItem={togglePaymentItem} />
          )}

          {activeTab === 'delivery' && (
            <DeliveryTab
              deliveryZones={deliveryZones}
              handleResetZones={handleResetZones}
              handleZoneChange={handleZoneChange}
              handleDeleteZone={handleDeleteZone}
              handleAddZone={handleAddZone}
            />
          )}

          {activeTab === 'seguridad' && (
            <BackupTab
              fileInputRef={fileInputRef}
              handleDownloadMasterJson={handleDownloadMasterJson}
              handleSelectRestoreFile={handleSelectRestoreFile}
              handleFileChange={handleFileChange}
              restoring={restoring}
            />
          )}
        </div>

        {/* BARRA INFERIOR DE GUARDADO */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-800/80">
          <span className="text-xs text-slate-500">
            Sección activa: <strong className="text-slate-300">{TABS.find((t) => t.id === activeTab)?.label}</strong>
          </span>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Guardando Cambios...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Toda la Configuración
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
