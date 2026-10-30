import { useEffect, useState } from 'react';

export function useRelativeTime(expiraEn) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('emerald');

  useEffect(() => {
    function calc() {
      const msLeft = Number(expiraEn) - Date.now();
      if (msLeft <= 0) { setLabel('Vencido'); setColor('rose'); return; }
      const h = Math.floor(msLeft / 3600000);
      const m = Math.floor((msLeft % 3600000) / 60000);
      if (h < 2) { setColor('rose'); }
      else if (h < 6) { setColor('orange'); }
      else { setColor('emerald'); }
      setLabel(h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`);
    }
    calc();
    const timer = setInterval(calc, 30000);
    return () => clearInterval(timer);
  }, [expiraEn]);

  return { label, color };
}
