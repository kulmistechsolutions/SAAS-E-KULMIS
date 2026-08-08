/**
 * Safe `Content-Disposition` header values for file downloads.
 *
 * HTTP header values must be Latin-1/ASCII — Node's `res.setHeader` throws
 * `ERR_INVALID_CHAR` the instant a filename contains a raw non-ASCII byte.
 * Every downloadable file here is named from user data (exam name, class
 * name, document title, ...), and schools routinely use Arabic or Somali
 * names, so a naive `filename="${name}.pdf"` reliably 500s for exactly the
 * schools this product serves. Strip to an ASCII-safe fallback for the plain
 * `filename=` parameter, and carry the real name via the RFC 5987
 * `filename*=UTF-8''...` extension so browsers that support it (all modern
 * ones) still show the proper name.
 */
export function contentDispositionHeader(
  filename: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "") || "download";
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
