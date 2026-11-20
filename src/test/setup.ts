import "@testing-library/jest-dom";

if (typeof globalThis.localStorage === "undefined") {
  const storage = new Map<string, string>();

  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  };
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null as unknown,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// jsdom lacks ResizeObserver, which Radix components (Switch, Select…) use.
if (typeof window !== "undefined" && typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Tests share one process (vitest isolate: false), so Testing Library's automatic
// cleanup is registered only for the first file that imports it. Clean up after every
// test explicitly, including what Radix dialogs leave on <body> (aria-hidden, styles).
if (typeof document !== "undefined") {
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    document.body.innerHTML = "";
    for (const attribute of Array.from(document.body.attributes)) document.body.removeAttribute(attribute.name);
  });
}
