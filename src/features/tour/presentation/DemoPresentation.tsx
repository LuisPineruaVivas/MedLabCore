import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { Compass, LogOut, Pause, Play, RotateCcw, SkipForward, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_DB_KEY, DEMO_TOUR_KEY, exitDemo } from "@/lib/demo/isDemo";
import { resetDemoStore } from "@/lib/demo/demoFetch";
import { DemoShareSimulator } from "../DemoShareSimulator";
import { DEMO_SCRIPT } from "./demoScript";
import { ScriptRunner } from "./scriptRunner";

type Phase = "intro" | "playing" | "done" | "exploring";

const SIGNUP_PATH = "/registro";

function loadPhase(): Phase {
  try {
    const saved = sessionStorage.getItem(DEMO_TOUR_KEY);
    // A reload in the middle of the presentation starts over from the intro (audio needs a new click).
    return saved === "done" || saved === "exploring" ? saved : "intro";
  } catch {
    return "intro";
  }
}

function savePhase(phase: Phase) {
  try {
    sessionStorage.setItem(DEMO_TOUR_KEY, phase);
  } catch {
    // Only decides which screen shows after a reload.
  }
}

/** Swallows clicks so the visitor can't knock the presentation off course; scripted clicks don't hit-test. */
function ClickShield() {
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return <div aria-hidden className="fixed inset-0 z-[10001]" onPointerDown={stop} onClick={stop} onMouseDown={stop} />;
}

export default function DemoPresentation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhaseState] = useState<Phase>(loadPhase);
  const [scene, setScene] = useState(0);
  const [caption, setCaption] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const runnerRef = useRef<ScriptRunner | null>(null);
  const mutedRef = useRef(false);

  const setPhase = useCallback((next: Phase) => {
    savePhase(next);
    setPhaseState(next);
  }, []);

  // Voices load asynchronously in Chrome; asking early has them ready when the presentation starts.
  useEffect(() => {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
    return () => runnerRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    runnerRef.current?.stop();
    // Fresh data each run, so the scripted patient and order are always the newest ones.
    sessionStorage.removeItem(DEMO_DB_KEY);
    resetDemoStore();
    await queryClient.resetQueries();
    navigate("/dashboard");

    setScene(0);
    setCaption("");
    setPaused(false);
    setPhase("playing");
    const runner = new ScriptRunner(DEMO_SCRIPT, {
      navigate,
      isMuted: () => mutedRef.current,
      onCaption: (s, text) => {
        setScene(s);
        setCaption(text);
      },
      onSceneFailed: (s, error) =>
        Sentry.captureMessage(`Demo presentation scene failed: ${DEMO_SCRIPT[s].title}`, {
          level: "warning",
          extra: { error: String(error) },
        }),
    });
    runnerRef.current = runner;
    // Let the dashboard render before the first spotlight.
    await new Promise((r) => setTimeout(r, 800));
    const finished = await runner.play();
    if (runnerRef.current === runner) {
      runnerRef.current = null;
      if (finished) setPhase("done");
    }
  }, [navigate, queryClient, setPhase]);

  const togglePause = () => {
    const runner = runnerRef.current;
    if (!runner) return;
    if (paused) runner.resume();
    else runner.pause();
    setPaused(!paused);
  };

  const toggleMute = () => {
    mutedRef.current = !muted;
    setMuted(!muted);
    if (!muted) runnerRef.current?.silenceNow();
  };

  const exitPresentation = () => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    setPhase("exploring");
  };

  const goToSignup = () => {
    // /registro runs against the real backend, so the tab leaves demo mode first.
    exitDemo();
    window.location.assign(SIGNUP_PATH);
  };

  const restartDemo = () => {
    sessionStorage.removeItem(DEMO_DB_KEY);
    sessionStorage.removeItem(DEMO_TOUR_KEY);
    window.location.replace("/dashboard");
  };

  const leaveDemo = () => {
    exitDemo();
    window.location.replace("/login");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sky-600 px-4 py-1.5 text-xs text-white sm:text-sm">
        <span>
          <strong>Modo demo:</strong> los datos son ficticios y nada de lo que hagas se guarda.
        </span>
        <button type="button" onClick={restartDemo} className="inline-flex items-center gap-1 underline underline-offset-2">
          <RotateCcw className="h-3 w-3" /> Reiniciar
        </button>
        <button type="button" onClick={leaveDemo} className="inline-flex items-center gap-1 underline underline-offset-2">
          <LogOut className="h-3 w-3" /> Salir
        </button>
      </div>

      <DemoShareSimulator onOpenLink={() => undefined} />

      {phase === "intro" && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl bg-card p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Mira MedLabCore en acción</h2>
              <p className="text-sm text-muted-foreground">
                En menos de 2 minutos: registra un paciente, crea su orden, carga sus resultados y compártelos por WhatsApp.
                Tú solo mira; todo se hace solo.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={() => void start()}>
              <Play className="mr-2 h-5 w-5" /> Ver presentación
            </Button>
            <p className="text-xs text-muted-foreground">Con narración: sube el volumen 🔊</p>
            <button type="button" onClick={() => setPhase("exploring")} className="text-sm text-muted-foreground underline underline-offset-2">
              Prefiero explorar por mi cuenta
            </button>
          </div>
        </div>
      )}

      {phase === "playing" && (
        <>
          <ClickShield />
          <div className="fixed inset-x-0 bottom-0 z-[10002] p-3 sm:p-4">
            <div className="mx-auto max-w-3xl space-y-3 rounded-2xl bg-slate-900/95 p-4 text-white shadow-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold uppercase tracking-wide">{DEMO_SCRIPT[scene]?.title}</span>
                <span className="ml-auto">
                  {scene + 1}/{DEMO_SCRIPT.length}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((scene + 1) / DEMO_SCRIPT.length) * 100}%` }} />
              </div>
              <p aria-live="polite" className="min-h-[3rem] text-base leading-snug sm:text-lg">
                {caption}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={togglePause}>
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">{paused ? "Continuar" : "Pausa"}</span>
                </Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={toggleMute}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">{muted ? "Activar voz" : "Silenciar"}</span>
                </Button>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => runnerRef.current?.skip()}>
                  <SkipForward className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Siguiente</span>
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-white hover:bg-white/10 hover:text-white" onClick={exitPresentation}>
                  <X className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Salir</span>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {phase === "done" && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl bg-card p-6 text-center shadow-2xl sm:p-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Así de fácil funciona tu laboratorio con MedLabCore</h2>
              <p className="text-sm text-muted-foreground">
                Pacientes, órdenes, resultados, informes con tu logo y envío por WhatsApp. Empieza hoy, sin tarjeta.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={goToSignup}>
              Comienza tu prueba gratis de 7 días
            </Button>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void start()}>
                <RotateCcw className="mr-2 h-4 w-4" /> Ver de nuevo
              </Button>
              <Button variant="outline" onClick={() => setPhase("exploring")}>
                <Compass className="mr-2 h-4 w-4" /> Explorar el demo
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === "exploring" && (
        <div className="fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2 md:bottom-4">
          <Button variant="outline" size="sm" className="bg-card shadow" onClick={() => void start()}>
            <Play className="mr-1.5 h-4 w-4" /> Ver presentación
          </Button>
          <Button size="lg" className="shadow-lg" onClick={goToSignup}>
            Prueba gratis 7 días
          </Button>
        </div>
      )}
    </>
  );
}
