import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Error visual capturado:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#070b12] text-white p-6 font-sans select-none">
          <div className="max-w-lg w-full bg-[#0f172a] border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Interrupción Visual Protegida</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                El sistema detectó una excepción visual y protegió la sesión. La base de datos, tus productos y el bot de WhatsApp permanecen intactos.
              </p>
              {this.state.error?.message && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Detalle técnico:</p>
                  <p className="text-xs font-mono text-amber-300 break-all">{this.state.error.message}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Reintentar Vista</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700/80 transition cursor-pointer"
              >
                <span>Volver al Inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
