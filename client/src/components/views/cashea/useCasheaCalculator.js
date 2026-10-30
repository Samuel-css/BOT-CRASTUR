import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { formatBs, formatRate } from '../../../utils/formatters';

export function useCasheaCalculator({ products = [], bcvRate = 849.56, onCopyManualQuote, casheaCuotas = 3 }) {
  const [calcMode, setCalcMode] = useState('catalog'); // 'catalog' | 'manual'
  const [manualUsd, setManualUsd] = useState('50');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedNivel, setSelectedNivel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copiedCombo, setCopiedCombo] = useState(false);
  const dropdownRef = useRef(null);

  // Lista de productos combinados en combo para alcanzar los $25 USD
  const [comboItems, setComboItems] = useState([]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (products && products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const filteredProducts = (products || []).filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const marca = (p.marca || '').toLowerCase();
    const modelo = (p.modelo || '').toLowerCase();
    const desc = (p.descripcion || '').toLowerCase();
    const cat = (p.categoria || '').toLowerCase();
    return marca.includes(q) || modelo.includes(q) || desc.includes(q) || cat.includes(q);
  });

  const selectedProduct = (products || []).find(p => String(p.id) === String(selectedProductId)) || (products && products[0]);

  // Agregar producto al Combo Cashea
  const handleAddToCombo = (prodToAdd = selectedProduct, qty = selectedQuantity) => {
    if (!prodToAdd) return;
    const cleanQty = Math.max(1, Math.min(99, qty));
    setComboItems(prev => {
      const existing = prev.find(item => String(item.id) === String(prodToAdd.id));
      if (existing) {
        return prev.map(item =>
          String(item.id) === String(prodToAdd.id)
            ? { ...item, cantidad: Math.min(99, item.cantidad + cleanQty) }
            : item
        );
      }
      return [
        ...prev,
        {
          id: prodToAdd.id,
          marca: prodToAdd.marca,
          modelo: prodToAdd.modelo,
          categoria: prodToAdd.categoria,
          precio_usd: parseFloat(prodToAdd.precio_usd) || 0,
          cantidad: cleanQty
        }
      ];
    });
    toast.success(`"${prodToAdd.modelo}" agregado al combo`);
  };

  // Modificar cantidad en el combo (acotada entre 1 y 99)
  const handleUpdateComboQty = (id, delta) => {
    setComboItems(prev =>
      prev
        .map(item => {
          if (String(item.id) === String(id)) {
            const nextQty = item.cantidad + delta;
            if (nextQty <= 0) return null;
            return { ...item, cantidad: Math.min(99, nextQty) };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveFromCombo = (id) => {
    setComboItems(prev => prev.filter(item => String(item.id) !== String(id)));
  };

  const handleClearCombo = () => {
    setComboItems([]);
    toast.info('Combo Cashea vaciado.');
  };

  // Cálculo del monto total USD
  const isComboActive = calcMode === 'catalog' && comboItems.length > 0;

  const totalUsd = calcMode === 'manual'
    ? (parseFloat(manualUsd) || 0)
    : (isComboActive
        ? comboItems.reduce((acc, item) => acc + (item.precio_usd * item.cantidad), 0)
        : (selectedProduct ? (parseFloat(selectedProduct.precio_usd) || 0) * selectedQuantity : 0));

  const inicialPct = selectedNivel === 1 ? 0.40 : selectedNivel === 2 ? 0.30 : 0.20;
  const inicialUsd = totalUsd * inicialPct;
  const inicialBs = inicialUsd * bcvRate;

  const saldoFinanciarUsd = totalUsd - inicialUsd;

  const cuotasCasheaNum = Math.max(1, parseInt(casheaCuotas, 10) || 3);
  const cuotaQuincenalUsd = saldoFinanciarUsd / cuotasCasheaNum;
  const cuotaQuincenalBs = cuotaQuincenalUsd * bcvRate;

  const qualifiesCashea = totalUsd >= 25;
  const amountShort = Math.max(0, 25 - totalUsd);

  // Generador de cotización lista para WhatsApp
  const handleCopyQuote = () => {
    let quoteText = '';

    if (calcMode === 'manual') {
      if (typeof onCopyManualQuote === 'function') {
        onCopyManualQuote(totalUsd, selectedNivel, inicialUsd, inicialBs, cuotaQuincenalUsd, cuotaQuincenalBs);
        return;
      }
    }

    if (isComboActive) {
      quoteText = `¡Hola! 👋 Te compartimos tu cotización de *Combo Cashea 💛* en *Crastur Caracas*:\n\n`;
      quoteText += `📦 *Detalle de Repuestos Seleccionados:*\n`;
      comboItems.forEach(item => {
        const itemSubtotal = item.precio_usd * item.cantidad;
        quoteText += `• ${item.cantidad}x ${item.marca} - ${item.modelo}: *$${itemSubtotal.toFixed(2)} USD*\n`;
      });
      quoteText += `\n💰 *Total de la compra:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * bcvRate)} a tasa BCV: ${formatRate(bcvRate)})\n\n`;
      if (qualifiesCashea) {
        quoteText += `💛 *Plan de Pago Cashea (Nivel ${selectedNivel} - ${Math.round(inicialPct * 100)}%):*\n`;
        quoteText += `👉 *Inicial hoy en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialBs)})\n`;
        quoteText += `👉 *${cuotasCasheaNum} Cuotas quincenales sin interés:* *$${cuotaQuincenalUsd.toFixed(2)} USD / cuota* (Bs. ${formatBs(cuotaQuincenalBs)})\n\n`;
        quoteText += `📍 *Retiro inmediato:* Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n`;
        quoteText += `🛵 O si prefieres te lo enviamos con delivery a toda Caracas.\n\n`;
        quoteText += `¿Deseas que te apartemos este combo por 24 horas sin costo? Escribe *SI* para reservarlo.`;
      } else {
        quoteText += `⚠️ *Aviso Cashea:* Para financiar en ${cuotasCasheaNum} cuotas con tu app Cashea, el consumo mínimo en tienda es de *$25 USD* (faltan solo $${amountShort.toFixed(2)} USD). ¡Puedes agregar otro repuesto para llevarte todo financiado!\n\n`;
        quoteText += `Escribe *VENDEDOR* si deseas que te armemos un combo a tu medida. 👨‍🔧`;
      }
    } else if (selectedProduct) {
      const prodSubtotal = parseFloat(selectedProduct.precio_usd) * selectedQuantity;
      quoteText = `¡Hola! 👋 Te cotizamos *${selectedQuantity > 1 ? `${selectedQuantity}x ` : ''}${selectedProduct.marca} - ${selectedProduct.modelo}* en *Crastur*:\n\n`;
      quoteText += `💵 *Precio:* *$${prodSubtotal.toFixed(2)} USD* (Bs. ${formatBs(prodSubtotal * bcvRate)} a tasa oficial BCV: ${formatRate(bcvRate)})\n\n`;
      if (qualifiesCashea) {
        quoteText += `💛 *Financiamiento Cashea (Nivel ${selectedNivel}):*\n`;
        quoteText += `👉 *Inicial hoy en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialBs)})\n`;
        quoteText += `👉 *${cuotasCasheaNum} Cuotas quincenales:* *$${cuotaQuincenalUsd.toFixed(2)} USD / cuota* (Bs. ${formatBs(cuotaQuincenalBs)})\n\n`;
        quoteText += `📍 *Retiro en tienda física:* San Agustín Norte, Caracas.\n`;
        quoteText += `👉 Escribe *APARTAR* para reservarlo por 24 horas sin costo.`;
      } else {
        quoteText += `💡 *Nota Cashea:* Cashea aplica en nuestra tienda física a partir de *$25 USD*. Puedes combinar este repuesto con aceite, bujías o más unidades para llevarte todo en cuotas.\n\n`;
        quoteText += `👉 Escribe *VENDEDOR* para asistirte de inmediato.`;
      }
    }

    if (navigator.clipboard && quoteText) {
      navigator.clipboard.writeText(quoteText);
      setCopiedCombo(true);
      toast.success('¡Cotización copiada lista para WhatsApp!');
      setTimeout(() => setCopiedCombo(false), 2500);
    }
  };

  return {
    calcMode,
    setCalcMode,
    manualUsd,
    setManualUsd,
    selectedProductId,
    setSelectedProductId,
    selectedQuantity,
    setSelectedQuantity,
    selectedNivel,
    setSelectedNivel,
    searchQuery,
    setSearchQuery,
    isDropdownOpen,
    setIsDropdownOpen,
    copiedCombo,
    dropdownRef,
    comboItems,
    filteredProducts,
    selectedProduct,
    handleAddToCombo,
    handleUpdateComboQty,
    handleRemoveFromCombo,
    handleClearCombo,
    isComboActive,
    totalUsd,
    inicialPct,
    inicialUsd,
    inicialBs,
    saldoFinanciarUsd,
    cuotasCasheaNum,
    cuotaQuincenalUsd,
    cuotaQuincenalBs,
    qualifiesCashea,
    amountShort,
    handleCopyQuote
  };
}
