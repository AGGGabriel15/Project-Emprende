import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "./dialog";

// jsdom no tiene visualViewport: lo simulamos con un teclado que tapa la mitad.
class FakeViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
  scale = 1;
}

let viewport: FakeViewport;
const scrollIntoView = vi.fn();

beforeEach(() => {
  viewport = new FakeViewport();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.stubGlobal("visualViewport", viewport);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width"), media: query }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function openKeyboard(height: number, offsetTop = 0) {
  act(() => {
    viewport.height = height;
    viewport.offsetTop = offsetTop;
    viewport.dispatchEvent(new Event("resize"));
  });
}

const dialog = (side?: "sheet") =>
  render(
    <Dialog open>
      <DialogContent title="Registrar visita" side={side}>
        <textarea aria-label="Notas" />
      </DialogContent>
    </Dialog>,
  );

describe("modales con el teclado del celular", () => {
  it("sin teclado no cambia la posición", () => {
    dialog("sheet");
    expect(screen.getByRole("dialog").style.top).toBe("");
  });

  it("el panel inferior se apoya sobre el teclado y muestra el campo", async () => {
    dialog("sheet");
    openKeyboard(420, 30);
    const panel = screen.getByRole("dialog");
    expect(panel.style.top).toBe("450px");
    expect(panel.style.bottom).toBe("auto");
    expect(panel.style.maxHeight).toBe("412px");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByLabelText("Notas"));
  });

  it("el modal centrado se centra en el área visible", () => {
    dialog();
    openKeyboard(400);
    expect(screen.getByRole("dialog").style.top).toBe("200px");
  });

  it("vuelve a su lugar al cerrar el teclado", () => {
    dialog("sheet");
    openKeyboard(420);
    openKeyboard(800);
    expect(screen.getByRole("dialog").style.top).toBe("");
  });
});
