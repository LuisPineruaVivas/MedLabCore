import { describe, expect, it } from "vitest";
import { getUserFacingErrorMessage, isNonRetryableError, toAppError } from "./errors";

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

describe("isNonRetryableError", () => {
  it("does not retry errors that will fail the same way", () => {
    expect(isNonRetryableError({ code: "42501", message: "permission denied for table orders" })).toBe(true);
    expect(isNonRetryableError({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })).toBe(true);
    expect(isNonRetryableError({ code: "P0001", message: "ERP_PERMISSION_DENIED" })).toBe(true);
    expect(isNonRetryableError({ code: "23505", message: "duplicate key" })).toBe(true);
    expect(isNonRetryableError({ status: 403, message: "Forbidden" })).toBe(true);
  });

  it("retries transient failures", () => {
    expect(isNonRetryableError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isNonRetryableError({ status: 503 })).toBe(false);
    expect(isNonRetryableError({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
    expect(isNonRetryableError(null)).toBe(false);
  });
});
