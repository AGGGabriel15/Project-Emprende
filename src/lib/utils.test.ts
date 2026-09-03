import { describe, expect, it } from "vitest";
import { formatMoney, slugify } from "@/lib/utils";

describe("utilidades locales", () => {
  it("normaliza slugs sin tildes", () => {
    expect(slugify("  Artesanías Únicas  ")).toBe("artesanias-unicas");
  });

  it("formatea centavos en córdobas", () => {
    const formatted = formatMoney(125050);
    expect(formatted).toContain("1,250.50");
  });
});
