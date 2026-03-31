// src/components/PWAInstallBanner.tsx
import { useState, useEffect } from 'react';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { setupInstallPrompt, promptInstall, isStandalone, isIOS } from '@/lib/pwa';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores/layoutStore';
import { cn } from '@/lib/utils';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [installMode, setInstallMode] = useState<'native' | 'ios' | null>(null);
  const { sidebarCollapsed } = useLayoutStore();

useEffect(() => {
  if (isStandalone()) return;

  if (localStorage.getItem('pwa-banner-MedLabCore-dismissed') === 'true') {
    setShowBanner(false);
    return;
  }

  if (isIOS()) {
    setInstallMode('ios');
    setShowBanner(true);
  }


  const cleanup = setupInstallPrompt(() => {
    console.log('PWA Install Banner - prompt ready');
    setInstallMode('native');
    setShowBanner(true);
  });

  return cleanup;
}, []);

  const handleInstall = async () => {
    if (installMode === 'native') {
      const success = await promptInstall();
      if (success) setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-banner-MedLabCore-dismissed', 'true');

    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className={cn(
      "fixed md:bottom-2 bottom-16 left-4 md:left-64 right-4 z-50 animate-in fade-in slide-in-from-bottom-5",
      sidebarCollapsed && "md:left-[80px]",
       "transition-all duration-300"
    )}>
      <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl border border-primary-foreground/10 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Download className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-sm">Instalar MedLabCore</h3>
            {installMode === 'ios' ? (
              <p className="text-xs opacity-90 flex items-center gap-1 mt-1">
                Toca <Share size={14} /> y luego <PlusSquare size={14} /> "Añadir a inicio"
              </p>
            ) : (
              <p className="text-xs opacity-90 mt-1">
                Añade la app a tu pantalla de inicio para acceso rápido.
              </p>
            )}
          </div>

            {installMode === 'native' && (
              <Button 
                onClick={handleInstall} 
                variant="secondary" 
                size="sm" 
                className="font-bold"
              >
                Instalar
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}