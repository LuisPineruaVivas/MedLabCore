// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ScriptRunner, readingTimeMs } from "./scriptRunner";

function ControlledInput() {
  const [value, setValue] = useState("");
  return (
    <>
      <input aria-label="nombre" value={value} onChange={(e) => setValue(e.target.value)} />
      <output data-testid="echo">{value}</output>
    </>
  );
}

describe("ScriptRunner", () => {
  it("types into a controlled React input and plays every beat's caption", async () => {
    // jsdom has no layout: report every element as on screen and scrollable.
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    // React only batches act() updates when this flag is set (no testing-library here).
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.body.appendChild(document.createElement("div"));
    act(() => createRoot(container).render(<ControlledInput />));
    const captions: string[] = [];
    const runner = new ScriptRunner(
      [{ title: "Prueba", beats: [{ say: "Escribe", run: (h) => h.type('input[aria-label="nombre"]', "Ana") }] }],
      { navigate: vi.fn(), isMuted: () => true, onCaption: (_s, text) => captions.push(text), onSceneFailed: vi.fn() }
    );

    let finished = false;
    await act(async () => {
      finished = await runner.play();
    });

    expect(finished).toBe(true);
    expect(captions).toEqual(["Escribe"]);
    expect(container.querySelector('[data-testid="echo"]')?.textContent).toBe("Ana");
  });

  it("skips a scene whose element never shows up and keeps going", async () => {
    const failed = vi.fn();
    const captions: string[] = [];
    const runner = new ScriptRunner(
      [
        { title: "Rota", beats: [{ say: "a", run: (h) => h.waitFor("#no-existe", 200).then(() => undefined) }] },
        { title: "Siguiente", beats: [{ say: "b" }] },
      ],
      { navigate: vi.fn(), isMuted: () => true, onCaption: (_s, text) => captions.push(text), onSceneFailed: failed }
    );

    await runner.play();

    expect(failed).toHaveBeenCalledWith(0, expect.any(Error));
    expect(captions).toEqual(["a", "b"]);
  });

  it("estimates reading time from word count, with a floor", () => {
    expect(readingTimeMs("hola")).toBe(1500);
    expect(readingTimeMs(Array(10).fill("palabra").join(" "))).toBe(3800);
  });
});
