import { useEffect, useState } from "react";
import { CheckCheck, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEMO_SHARE_EVENT, type DemoShareDetail } from "@/lib/demo/isDemo";

export const SHARE_CHAT_TITLE = "Chat con tu paciente";
export const SHARE_VIEWER_TITLE = "Así lo ve tu paciente";

/**
 * Stands in for WhatsApp in the demo: shows the message the lab would send and, when the "patient"
 * taps the link, opens the shared report page. The iframe shares this tab's sessionStorage, so it
 * runs in demo mode against the same in-memory data.
 */
export function DemoShareSimulator({ onOpenLink }: { onOpenLink: () => void }) {
  const [share, setShare] = useState<DemoShareDetail | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    const onShare = (event: Event) => setShare((event as CustomEvent<DemoShareDetail>).detail);
    window.addEventListener(DEMO_SHARE_EVENT, onShare);
    return () => window.removeEventListener(DEMO_SHARE_EVENT, onShare);
  }, []);

  const openLink = () => {
    if (!share) return;
    onOpenLink();
    // Phones can't show a PDF inside an iframe; a new tab gets a copy of sessionStorage, so it stays in demo mode.
    if (window.matchMedia("(max-width: 768px)").matches) window.open(share.url, "_blank");
    else setViewerUrl(share.url);
    setShare(null);
  };

  const [before = "", after = ""] = share ? share.message.split(share.url) : [];
  const time = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Dialog open={!!share} onOpenChange={(open) => !open && setShare(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
          <DialogHeader className="space-y-0.5 bg-[#075e54] px-4 py-3 text-left text-white">
            <DialogTitle className="flex items-center gap-2 text-base text-white">
              <MessageCircle className="h-4 w-4" /> {SHARE_CHAT_TITLE}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/80">WhatsApp · simulación del demo</DialogDescription>
          </DialogHeader>
          <div className="min-h-56 space-y-3 bg-[#ece5dd] p-4">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 text-sm text-slate-800 shadow-sm">
              <p className="break-words">
                {before}
                <button
                  type="button"
                  data-tour="demo-share-link"
                  onClick={openLink}
                  className="break-all text-left text-sky-700 underline"
                >
                  {share?.url}
                </button>
                {after}
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                {time} <CheckCheck className="h-3 w-3 text-sky-500" />
              </p>
            </div>
            <p className="text-center text-xs text-slate-600">
              En la vida real esto abre WhatsApp con el mensaje listo para enviar. Toca el enlace para verlo como tu paciente.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewerUrl} onOpenChange={(open) => !open && setViewerUrl(null)}>
        <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3 p-4">
          <DialogHeader>
            <DialogTitle>{SHARE_VIEWER_TITLE}</DialogTitle>
            <DialogDescription>El paciente abre el enlace y ve su informe de inmediato, sin cuentas ni contraseñas.</DialogDescription>
          </DialogHeader>
          {viewerUrl && <iframe title="Informe del paciente" src={viewerUrl} className="w-full flex-1 rounded-md border" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
