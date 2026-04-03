import { describe, expect, it } from "vitest";
import { buildCreateTeamMemberPayload } from "./useTeamSettings";

describe("team settings helpers", () => {
  it("builds the create team member payload", () => {
    expect(
      buildCreateTeamMemberPayload({
        email: "ana@example.com",
        password: "secret123",
        full_name: "Ana Perez",
        role: "bioanalyst",
      })
    ).toEqual({
      email: "ana@example.com",
      password: "secret123",
      full_name: "Ana Perez",
      role: "bioanalyst",
    });
  });
});
