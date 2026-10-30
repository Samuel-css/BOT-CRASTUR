/**
 * @file useSettingsForm.js
 * @description Estado y lógica de la vista de configuración (formulario, horarios,
 * zonas de delivery y respaldos). Extraído de SettingsView.jsx.
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { DEFAULT_DELIVERY_ZONES } from '../../../constants/deliveryZones';
import { SCHEDULE_OPTIONS } from './constants';
import { parseActivePayments, buildScheduleString } from './helpers';

export default function useSettingsForm({ settings, onSaveSettings, onRequestConfirm }) {
  const [activeTab, setActiveTab] = useState('tienda');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(settings || {});
  const [subTabMensajes, setSubTabMensajes] = useState('bienvenida');

  // Estado para el selector de horario
  const [scheduleMode, setScheduleMode] = useState(() => {
    const cur = (settings?.horario_atencion || '').trim();
    const match = SCHEDULE_OPTIONS.find(o => o.id !== 'custom' && o.value === cur);
    return match ? match.id : (cur ? 'custom' : 'crastur_standard');
  });

  const [customDays, setCustomDays] = useState('Lunes a Sábado');
  const [customOpenTime, setCustomOpenTime] = useState('8:00 AM');
  const [customCloseTime, setCustomCloseTime] = useState('8:00 PM');
  const [customSunday, setCustomSunday] = useState('8:30 AM a 2:00 PM');

  const [deliveryZones, setDeliveryZones] = useState(() => {
    if (settings?.delivery_zonas_json) {
      try {
        const parsed = typeof settings.delivery_zonas_json === 'string'
          ? JSON.parse(settings.delivery_zonas_json)
          : settings.delivery_zonas_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((z) => ({
            ...z,
            palabras: Array.isArray(z.palabras) ? z.palabras.join(', ') : (z.palabras || '')
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_DELIVERY_ZONES;
  });

  useEffect(() => {
    setForm(settings || {});
    if (settings?.horario_atencion) {
      const cur = settings.horario_atencion.trim();
      const match = SCHEDULE_OPTIONS.find(o => o.id !== 'custom' && o.value === cur);
      if (match) {
        setScheduleMode(match.id);
      } else {
        setScheduleMode('custom');
      }
    }
  }, [settings]);

  // Manejo de cambio en el selector de horario
  const handleScheduleSelect = (modeId) => {
    setScheduleMode(modeId);
    if (modeId !== 'custom') {
      const found = SCHEDULE_OPTIONS.find(o => o.id === modeId);
      if (found) {
        setForm(prev => ({ ...prev, horario_atencion: found.value }));
        toast.success(`Horario seleccionado: ${found.shortLabel}`);
      }
    } else {
      const generated = buildScheduleString(customDays, customOpenTime, customCloseTime, customSunday);
      setForm(prev => ({ ...prev, horario_atencion: generated }));
      toast.info('Modo horario personalizado activo. Puedes ajustar semana y domingos abajo.');
    }
  };

  const handleUpdateCustomSchedule = (days, open, close, sunday) => {
    const nextDays = days !== undefined ? days : customDays;
    const nextOpen = open !== undefined ? open : customOpenTime;
    const nextClose = close !== undefined ? close : customCloseTime;
    const nextSunday = sunday !== undefined ? sunday : customSunday;

    setCustomDays(nextDays);
    setCustomOpenTime(nextOpen);
    setCustomCloseTime(nextClose);
    setCustomSunday(nextSunday);

    const generated = buildScheduleString(nextDays, nextOpen, nextClose, nextSunday);
    setForm(prev => ({ ...prev, horario_atencion: generated }));
  };

  // Conmutador interactivo de formas de pago
  const togglePaymentItem = (paymentLabel) => {
    const currentActive = parseActivePayments(form.metodos_pago);
    const exists = currentActive.includes(paymentLabel);
    let updatedList;
    if (exists) {
      updatedList = currentActive.filter(l => l !== paymentLabel);
      toast.info(`Desactivado: ${paymentLabel}`);
    } else {
      updatedList = [...currentActive, paymentLabel];
      toast.success(`Activado: ${paymentLabel}`);
    }
    const val = updatedList.length === 0 ? 'ninguno' : updatedList.join(', ');
    setForm(prev => ({ ...prev, metodos_pago: val }));
  };

  const field = (name) => ({
    value: form[name] ?? '',
    onChange: (e) => setForm({ ...form, [name]: e.target.value })
  });

  const insertVariable = (fieldName, varTag) => {
    const cur = form[fieldName] || '';
    setForm(prev => ({ ...prev, [fieldName]: `${cur} ${varTag}` }));
    toast.info(`Insertado "${varTag}"`);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const zonesToSave = deliveryZones.map((z) => ({
        ...z,
        palabras: typeof z.palabras === 'string'
          ? z.palabras.split(',').map((p) => p.trim()).filter(Boolean)
          : z.palabras
      }));

      const payload = {
        ...form,
        delivery_zonas_json: JSON.stringify(zonesToSave)
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if (onSaveSettings) onSaveSettings(data.settings);
      } else {
        toast.error('Error al guardar la configuración');
      }
    } catch {
      toast.error('Error de red al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleZoneChange = (index, key, value) => {
    const updated = [...deliveryZones];
    updated[index] = { ...updated[index], [key]: value };
    setDeliveryZones(updated);
  };

  const handleAddZone = () => {
    setDeliveryZones([
      ...deliveryZones,
      { zona: '', tarifa: '$3 a $4 USD', palabras: '' }
    ]);
  };

  const handleDeleteZone = (index) => {
    const zoneName = deliveryZones[index]?.zona || 'esta zona';
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Eliminar zona de delivery?',
        message: `¿Estás seguro de eliminar "${zoneName}"? El bot ya no cotizará envíos automáticamente para este sector.`,
        confirmText: 'Sí, Eliminar Zona',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones((prev) => prev.filter((_, i) => i !== index));
          toast.info('Zona de delivery eliminada.');
        }
      });
    } else {
      setDeliveryZones((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleResetZones = () => {
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Restablecer zonas de Caracas?',
        message: 'Esto cargará las zonas y tarifas predeterminadas de Caracas (San Agustín, Centro, Chacao, Baruta, etc.), reemplazando la lista actual.',
        confirmText: 'Restablecer Valores',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones(DEFAULT_DELIVERY_ZONES);
          toast.success('Zonas de delivery restablecidas a valores recomendados.');
        }
      });
    } else {
      setDeliveryZones(DEFAULT_DELIVERY_ZONES);
    }
  };

  const handleDownloadMasterJson = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = '/api/backup/catalog-sellers';
    link.download = `catalogo_asesores_crastur_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Descargando respaldo de Catálogo + Asesores (.json)...');
  };

  const handleSelectRestoreFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const performRestore = async () => {
      setRestoring(true);
      try {
        const fileText = await file.text();
        const parsed = JSON.parse(fileText);
        const res = await fetch('/api/backup/catalog-sellers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`¡Restaurado! ${data.importedProducts} productos y ${data.importedSellers} asesores cargados.`);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error(data.error || 'Error al restaurar el respaldo');
        }
      } catch {
        toast.error('El archivo no tiene un formato válido de Catálogo y Asesores de Crastur');
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (onRequestConfirm) {
      onRequestConfirm({
        title: '⚠️ ¿Restaurar Catálogo y Asesores?',
        message: `Se agregarán o actualizarán los productos y asesores del archivo "${file.name}". La configuración y los chats actuales NO se tocan.`,
        confirmText: 'Sí, Restaurar Ahora',
        isDanger: true,
        onConfirm: performRestore
      });
    } else {
      performRestore();
    }
  };

  return {
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
    buildScheduleString,
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
  };
}
