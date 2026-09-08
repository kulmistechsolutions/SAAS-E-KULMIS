import { csvCell, csvRow, looksLikeFormula } from "@ekulmis/shared";

/**
 * A school exports "who owes us" and mails the file on. By the time it is
 * opened, nobody remembers what was on screen — so the file has to be right on
 * its own, and both ways it goes wrong are silent: a misquoted cell shifts
 * every column after it, and a cell a spreadsheet reads as a formula stops
 * being the name that was typed.
 */
describe("writing a CSV a spreadsheet will not rewrite", () => {
  it("keeps a comma inside its own cell", () => {
    // Without the quotes this is two columns and every heading after it is
    // describing the wrong data.
    expect(csvRow(["Ali, Yusuf", 50])).toBe('"Ali, Yusuf",50');
  });

  it("keeps a quote in a name", () => {
    expect(csvCell('Sa"id')).toBe('"Sa""id"');
  });

  it("refuses to hand a spreadsheet a formula", () => {
    // Cells here hold names a school typed. Excel runs anything starting =,
    // +, - or @, so the value is marked as text instead.
    expect(csvCell("=SUM(A1:A9)")).toBe("\"'=SUM(A1:A9)\"");
    expect(csvCell("+1 615")).toBe("\"'+1 615\"");
    expect(csvCell("-Ahmed")).toBe("\"'-Ahmed\"");
    expect(csvCell("@name")).toBe("\"'@name\"");
  });

  it("leaves an ordinary name alone", () => {
    expect(csvCell("Abdi Mohamed")).toBe('"Abdi Mohamed"');
    expect(looksLikeFormula("Abdi Mohamed")).toBe(false);
  });

  it("writes money as a number, not as text", () => {
    // Quoted, a total is a string and the column will not sum.
    expect(csvCell(7005)).toBe("7005");
    expect(csvCell(0.5)).toBe("0.5");
  });

  it("writes an empty cell for nothing at all", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it("treats a tab or a carriage return as needing the same guard", () => {
    expect(looksLikeFormula("\tvalue")).toBe(true);
    expect(looksLikeFormula("\rvalue")).toBe(true);
  });
});
