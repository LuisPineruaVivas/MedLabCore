/**
 * Records the /demo narration with ElevenLabs into public/demo/voice/<id>.mp3 and writes manifest.json
 * (line id -> hash of the recorded text). Only new or changed lines are recorded again.
 *
 *   ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] npm run demo:voice
 *   npm run demo:voice -- --all     (record every line again, e.g. after changing the voice)
 *
 * The key stays in your shell; it is never written to the repo or sent to the browser.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { NARRATION, textHash, type LineId } from "../src/features/tour/presentation/narration.ts";

const OUT_DIR = new URL("../public/demo/voice/", import.meta.url);
const MANIFEST = new URL("manifest.json", OUT_DIR);
// Premade multilingual voice; swap it for any voice id from your ElevenLabs Voice Library.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
const all = process.argv.includes("--all");

if (!apiKey) {
  console.error("Falta ELEVENLABS_API_KEY. Ejemplo:  ELEVENLABS_API_KEY=sk_... npm run demo:voice");
  process.exit(1);
}

async function loadManifest(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

async function record(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      language_code: "es",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(OUT_DIR, { recursive: true });
const manifest = await loadManifest();
const ids = Object.keys(NARRATION) as LineId[];
// Keeps what is already recorded; lines that no longer exist in the script drop out.
const next: Record<string, string> = Object.fromEntries(ids.filter((id) => manifest[id]).map((id) => [id, manifest[id]]));
let recorded = 0;

for (const id of ids) {
  const text = NARRATION[id];
  const hash = textHash(text);
  if (!all && manifest[id] === hash) continue;
  process.stdout.write(`Grabando ${id}… `);
  try {
    await writeFile(new URL(`${id}.mp3`, OUT_DIR), await record(text));
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    console.log("falló");
    console.error(
      message.includes("paid_plan_required")
        ? "\nEsa voz es de la Voice Library, y el plan gratis de ElevenLabs no permite usarlas por API.\n" +
            "Usa una voz predeterminada (borra ELEVENLABS_VOICE_ID) o mejora tu plan."
        : `\n${message}`
    );
    // Not process.exit(): on Windows it can crash Node while the fetch socket is still closing.
    process.exitCode = 1;
    break;
  }
  next[id] = hash;
  recorded++;
  console.log("listo");
  // Save after each line so a failure halfway keeps what was already recorded.
  await writeFile(MANIFEST, JSON.stringify(next, null, 2) + "\n");
}

await writeFile(MANIFEST, JSON.stringify(next, null, 2) + "\n");
const chars = ids.reduce((sum, id) => sum + NARRATION[id].length, 0);
console.log(`\n${recorded} línea(s) grabadas de ${ids.length} (${chars} caracteres en el guion completo).`);
