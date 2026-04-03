import { describe, expect, it } from "vitest";
import { getUserFacingErrorMessage, toAppError } from "./errors";

describe("errors helpers", () => {
  it("maps native errors into app errors", () => {
    const error = new Error("Fallo controlado");

    expect(toAppError(error)).toEqual({
      message: "Fallo controlado",
      technicalCode: "Error",
    });
  });

  it("prefers payload message fields when present", () => {
    expect(
      toAppError({
        message: "Mensaje del backend",
        code: "ORDER_CREATE_FAILED",
        details: { orderId: "123" },
      })
    ).toEqual({
      message: "Mensaje del backend",
      technicalCode: "ORDER_CREATE_FAILED",
      details: { orderId: "123" },
    });
  });

  it("returns the fallback when there is no usable message", () => {
    expect(getUserFacingErrorMessage(null, "Fallback custom")).toBe("Fallback custom");
  });
});
