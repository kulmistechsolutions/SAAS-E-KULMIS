import { mapBodyParserError } from "./all-exceptions.filter";

/**
 * A browser closing the connection mid-upload, or a body over the limit, is
 * not a server fault. The error log showed both as 500s with no school.
 */
const parserError = (type: string, status: number, message: string) =>
  Object.assign(new Error(message), { type, status, statusCode: status, expose: true });

describe("errors from the body parser", () => {
  it("keeps an aborted upload a 400, out of the error log", () => {
    expect(mapBodyParserError(parserError("request.aborted", 400, "request aborted"))?.status).toBe(400);
  });

  it("answers an oversized body with 413 and a sentence", () => {
    const r = mapBodyParserError(parserError("entity.too.large", 413, "request entity too large"));
    expect(r?.status).toBe(413);
    expect(r?.message).toContain("too large");
  });

  it("leaves ordinary errors alone, so real bugs still log as 500", () => {
    expect(mapBodyParserError(new Error("boom"))).toBeNull();
    expect(mapBodyParserError(Object.assign(new Error("x"), { type: "t", status: 500, expose: true }))).toBeNull();
  });
});
