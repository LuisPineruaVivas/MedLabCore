import { findVisible } from "../guidedTask";

export type Target = string | (() => Element | null);

/** One narrated moment: the line is spoken while `run` acts on the page, and the beat ends when both finish. */
export interface Beat {
  say: string;
  /** Id of a recorded version of `say` (public/demo/voice/<id>.mp3); without one the browser voice reads it. */
  voice?: string;
  /** Element to spotlight while the beat plays. */
  focus?: Target;
  run?: (h: Helpers) => Promise<void>;
}

export interface Scene {
  title: string;
  beats: Beat[];
}

export interface Helpers {
  type(target: Target, text: string): Promise<void>;
  click(target: Target): Promise<void>;
  pickSelect(trigger: Target, optionText: string): Promise<void>;
  waitFor(target: Target, timeoutMs?: number): Promise<Element>;
  navigate(path: string): Promise<void>;
  pause(ms: number): Promise<void>;
}

export interface RunnerCallbacks {
  navigate: (path: string) => void;
  onCaption: (scene: number, text: string) => void;
  /** A scene that could not finish (an element never showed up); the runner moves on to the next one. */
  onSceneFailed: (scene: number, error: unknown) => void;
  isMuted: () => boolean;
  /** URL of the recording for a beat, or null to use the browser voice (no recording, or it is outdated). */
  voiceUrl?: (voice: string, text: string) => string | null;
}

export class SceneSkipped extends Error {}

const TYPE_DELAY_MS = 35;
const WAIT_TIMEOUT_MS = 8000;
const CURSOR_MOVE_MS = 550;
const SPOTLIGHT_CLASS = "demo-spotlight";

// A light, glowing spotlight instead of a dark overlay, plus the fake mouse pointer and its click ripple.
const PRESENTING_CSS = `
.${SPOTLIGHT_CLASS} {
  outline: 3px solid #14b8a6 !important;
  outline-offset: 4px;
  border-radius: 8px;
  box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.22) !important;
  transition: outline-color 0.2s, box-shadow 0.2s;
}
#demo-cursor {
  position: fixed; left: 0; top: 0; z-index: 10003; pointer-events: none;
  transition: transform ${CURSOR_MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
  filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.35));
}
#demo-cursor::after {
  content: ""; position: absolute; left: -14px; top: -14px; width: 28px; height: 28px;
  border-radius: 9999px; background: rgba(20, 184, 166, 0.45); transform: scale(0); opacity: 0;
}
#demo-cursor.clicking::after { animation: demo-cursor-click 0.45s ease-out; }
@keyframes demo-cursor-click { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
`;

const CURSOR_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.5 L14.6 20.2 L11.6 13.6 L18 13.6 Z" fill="#0f2d5c" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

function resolve(target: Target): Element | null {
  return typeof target === "string" ? findVisible(target) : target();
}

/** Value setter that React's controlled inputs listen to; assigning `.value` alone is ignored by React. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function spanishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = typeof speechSynthesis === "undefined" ? [] : speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet; try again on the next line
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const rank = (v: SpeechSynthesisVoice) =>
    (/natural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/es-(us|mx|419|ve|co)/i.test(v.lang) ? 1 : 0);
  cachedVoice = spanish.sort((a, b) => rank(b) - rank(a))[0] ?? null;
  return cachedVoice;
}

/** Reading time when there is no voice (muted, or the browser has none): about 2.6 words per second. */
export function readingTimeMs(text: string) {
  return Math.max(1500, text.split(/\s+/).length * 380);
}

/**
 * Plays scenes in order. Each beat speaks its line (a recording, the browser voice, or its reading time) while
 * its action runs. Pause holds between actions and pauses the voice; skip abandons the current scene.
 */
export class ScriptRunner {
  private paused = false;
  private resumeWaiters: Array<() => void> = [];
  private skipScene = false;
  private stopped = false;
  private spotlit: Element | null = null;
  private cursor: HTMLDivElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private endAudio: (() => void) | null = null;
  private preloaded = new Map<string, HTMLAudioElement>();

  constructor(private scenes: Scene[], private cb: RunnerCallbacks) {}

  async play(fromScene = 0) {
    this.ensurePresentingStyles();
    this.showCursor();
    const beats = this.scenes.flatMap((scene) => scene.beats);
    try {
      for (let s = fromScene; s < this.scenes.length && !this.stopped; s++) {
        this.skipScene = false;
        try {
          for (const beat of this.scenes[s].beats) {
            await this.gate();
            this.preload(beats[beats.indexOf(beat) + 1]);
            this.cb.onCaption(s, beat.say);
            await Promise.all([this.speak(beat), this.act(beat)]);
          }
        } catch (error) {
          if (this.stopped) break;
          if (!(error instanceof SceneSkipped)) this.cb.onSceneFailed(s, error);
        }
      }
    } finally {
      this.cleanup();
    }
    return !this.stopped;
  }

  pause() {
    this.paused = true;
    this.audio?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    void this.audio?.play().catch(() => this.endAudio?.());
    if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
    this.resumeWaiters.splice(0).forEach((wake) => wake());
  }

  skip() {
    this.skipScene = true;
    this.endAudio?.();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (this.paused) this.resume();
  }

  stop() {
    this.stopped = true;
    this.skip();
  }

  /** Recordings keep playing silently so the timing holds; the browser voice is cut and its reading time waited out. */
  setMuted(muted: boolean) {
    if (this.audio) this.audio.muted = muted;
    if (muted && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  private ensurePresentingStyles() {
    if (document.getElementById("medlab-presenting-styles")) return;
    const style = document.createElement("style");
    style.id = "medlab-presenting-styles";
    style.textContent = PRESENTING_CSS;
    document.head.appendChild(style);
  }

  private cleanup() {
    this.spotlit?.classList.remove(SPOTLIGHT_CLASS);
    this.spotlit = null;
    this.cursor?.remove();
    this.cursor = null;
    this.endAudio?.();
    this.preloaded.clear();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  private async gate() {
    if (this.skipScene || this.stopped) throw new SceneSkipped();
    if (this.paused) await new Promise<void>((wake) => this.resumeWaiters.push(wake));
    if (this.skipScene || this.stopped) throw new SceneSkipped();
  }

  private async sleep(ms: number) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await this.gate();
      await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
    }
  }

  // ── Voice ──────────────────────────────────────────────────────────

  private recordingFor(beat: Beat | undefined): string | null {
    return beat?.voice ? this.cb.voiceUrl?.(beat.voice, beat.say) ?? null : null;
  }

  private preload(beat: Beat | undefined) {
    const url = this.recordingFor(beat);
    if (!url || this.preloaded.has(url)) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    this.preloaded.set(url, audio);
  }

  private speak(beat: Beat): Promise<void> {
    const url = this.recordingFor(beat);
    return url ? this.playRecording(url, beat.say) : this.speakWithBrowser(beat.say);
  }

  private playRecording(url: string, text: string): Promise<void> {
    return new Promise((done) => {
      const audio = this.preloaded.get(url) ?? new Audio(url);
      this.preloaded.delete(url);
      audio.muted = this.cb.isMuted();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        audio.pause();
        if (this.audio === audio) this.audio = null;
        this.endAudio = null;
        done();
      };
      this.audio = audio;
      this.endAudio = finish;
      audio.onended = finish;
      // A missing or broken file: read the line with the browser voice instead.
      const fallback = () => {
        if (finished) return;
        finished = true;
        this.audio = null;
        this.endAudio = null;
        void this.speakWithBrowser(text).then(done, done);
      };
      audio.onerror = fallback;
      if (this.paused) return;
      audio.play().catch(fallback);
    });
  }

  private speakWithBrowser(text: string): Promise<void> {
    const voice = this.cb.isMuted() ? null : spanishVoice();
    if (!voice) return this.sleep(readingTimeMs(text));
    return new Promise((done) => {
      const started = Date.now();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 1.05;
      // Some voices never fire onend (or the user muted mid-line): finish no earlier than the reading time.
      const finish = () => {
        const left = readingTimeMs(text) * 0.6 - (Date.now() - started);
        if (left > 0 && !this.skipScene) setTimeout(done, left);
        else done();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      speechSynthesis.speak(utterance);
    });
  }

  // ── Page actions ───────────────────────────────────────────────────

  private async act(beat: Beat) {
    if (beat.focus) this.spotlight(await this.waitFor(beat.focus));
    if (beat.run) await beat.run(this.helpers);
  }

  /** Glows one element at a time (the class moves with it) and scrolls it into view. */
  private spotlight(el: Element) {
    if (this.spotlit !== el) {
      this.spotlit?.classList.remove(SPOTLIGHT_CLASS);
      el.classList.add(SPOTLIGHT_CLASS);
      this.spotlit = el;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  private showCursor() {
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.innerHTML = CURSOR_SVG;
    cursor.style.transform = `translate(${window.innerWidth * 0.6}px, ${window.innerHeight * 0.55}px)`;
    document.body.appendChild(cursor);
    this.cursor = cursor;
  }

  /** Glides the pointer to the element (after it scrolled into view) and plays the click ripple. */
  private async pointAt(el: Element, click = true) {
    await this.sleep(300); // let the smooth scroll settle before measuring
    const rect = el.getBoundingClientRect();
    const x = rect.left + Math.min(rect.width / 2, 60);
    const y = rect.top + rect.height / 2;
    if (this.cursor) this.cursor.style.transform = `translate(${x}px, ${y}px)`;
    await this.sleep(CURSOR_MOVE_MS);
    if (!click || !this.cursor) return;
    this.cursor.classList.remove("clicking");
    void this.cursor.offsetWidth; // restart the animation
    this.cursor.classList.add("clicking");
  }

  private async waitFor(target: Target, timeoutMs = WAIT_TIMEOUT_MS): Promise<Element> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      await this.gate();
      const el = resolve(target);
      if (el) return el;
      if (Date.now() > end) throw new Error(`Presentation: element not found: ${typeof target === "string" ? target : "custom finder"}`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  private helpers: Helpers = {
    waitFor: (target, timeoutMs) => this.waitFor(target, timeoutMs),
    pause: (ms) => this.sleep(ms),
    navigate: async (path) => {
      await this.gate();
      this.cb.navigate(path);
      await this.sleep(700);
    },
    click: async (target) => {
      const el = (await this.waitFor(target)) as HTMLElement;
      this.spotlight(el);
      await this.pointAt(el);
      // Lists that re-render while the pointer travels (e.g. a debounced search) replace the element.
      const current = el.isConnected ? el : ((await this.waitFor(target)) as HTMLElement);
      current.click();
      await this.sleep(300);
    },
    type: async (target, text) => {
      const el = (await this.waitFor(target)) as HTMLInputElement;
      this.spotlight(el);
      await this.pointAt(el);
      el.focus();
      setNativeValue(el, "");
      for (let i = 1; i <= text.length; i++) {
        await this.sleep(TYPE_DELAY_MS);
        setNativeValue(el, text.slice(0, i));
      }
      await this.sleep(200);
    },
    pickSelect: async (trigger, optionText) => {
      const el = (await this.waitFor(trigger)) as HTMLElement;
      this.spotlight(el);
      await this.pointAt(el);
      // Radix Select opens on a primary-button mouse pointerdown, not on click.
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      const option = (await this.waitFor(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.trim() === optionText) ?? null,
        3000
      )) as HTMLElement;
      await this.pointAt(option);
      option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      option.click();
      await this.sleep(300);
    },
  };
}
