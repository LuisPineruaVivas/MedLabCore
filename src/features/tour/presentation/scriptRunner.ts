import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { PASSIVE_CLASS, ensureStyles, findVisible } from "../guidedTask";

export type Target = string | (() => Element | null);

/** One narrated moment: the caption is spoken while `run` acts on the page, and the beat ends when both finish. */
export interface Beat {
  say: string;
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
}

export class SceneSkipped extends Error {}

const TYPE_DELAY_MS = 45;
const WAIT_TIMEOUT_MS = 8000;

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
 * Plays scenes in order. Each beat speaks its line (or waits its reading time) while its action runs.
 * Pause holds between actions and pauses the voice; skip abandons the current scene.
 */
export class ScriptRunner {
  private paused = false;
  private resumeWaiters: Array<() => void> = [];
  private skipScene = false;
  private stopped = false;
  private tour: Driver | null = null;

  constructor(private scenes: Scene[], private cb: RunnerCallbacks) {}

  async play(fromScene = 0) {
    ensureStyles();
    document.documentElement.classList.add(PASSIVE_CLASS);
    this.tour = driver({ allowClose: false, allowKeyboardControl: false, overlayOpacity: 0.4, stagePadding: 6, stageRadius: 8 });
    try {
      for (let s = fromScene; s < this.scenes.length && !this.stopped; s++) {
        this.skipScene = false;
        try {
          for (const beat of this.scenes[s].beats) {
            await this.gate();
            this.cb.onCaption(s, beat.say);
            await Promise.all([this.speak(beat.say), this.act(beat)]);
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
    if (typeof speechSynthesis !== "undefined") speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.resume();
    this.resumeWaiters.splice(0).forEach((wake) => wake());
  }

  skip() {
    this.skipScene = true;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (this.paused) this.resume();
  }

  stop() {
    this.stopped = true;
    this.skip();
  }

  /** Muting mid-line cuts the voice; the beat then waits out its reading time. */
  silenceNow() {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  private cleanup() {
    this.tour?.destroy();
    this.tour = null;
    document.documentElement.classList.remove(PASSIVE_CLASS);
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

  private speak(text: string): Promise<void> {
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

  private async act(beat: Beat) {
    if (beat.focus) this.spotlight(await this.waitFor(beat.focus));
    if (beat.run) await beat.run(this.helpers);
    // Keep the spotlight on the element even if a dialog animation moved it.
    this.tour?.refresh();
  }

  private spotlight(el: Element) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    this.tour?.highlight({ element: el });
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
      await this.sleep(450);
      el.click();
      await this.sleep(350);
    },
    type: async (target, text) => {
      const el = (await this.waitFor(target)) as HTMLInputElement;
      this.spotlight(el);
      el.focus();
      setNativeValue(el, "");
      for (let i = 1; i <= text.length; i++) {
        await this.sleep(TYPE_DELAY_MS);
        setNativeValue(el, text.slice(0, i));
      }
      await this.sleep(250);
    },
    pickSelect: async (trigger, optionText) => {
      const el = (await this.waitFor(trigger)) as HTMLElement;
      this.spotlight(el);
      await this.sleep(400);
      // Radix Select opens on a primary-button mouse pointerdown, not on click.
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      const option = (await this.waitFor(
        () => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.trim() === optionText) ?? null,
        3000
      )) as HTMLElement;
      await this.sleep(500);
      option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      option.click();
      await this.sleep(350);
    },
  };
}
