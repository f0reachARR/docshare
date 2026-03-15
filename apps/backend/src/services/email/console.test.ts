import { describe, expect, it } from "vitest";
import { ConsoleEmailService } from "./console";

describe("ConsoleEmailService", () => {
  it("returns success", async () => {
    const service = new ConsoleEmailService();
    const result = await service.sendEmail({
      to: "foo@example.com",
      subject: "test",
      html: "<p>hello</p>",
    });

    expect(result.success).toBe(true);
  });
});
