/** True only for a well-formed absolute `http:`/`https:` URL — never `javascript:`, `data:`, `file:`, or a relative reference. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
