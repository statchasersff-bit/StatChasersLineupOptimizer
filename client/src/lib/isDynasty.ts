export function isDynastyLeague(lg: any): boolean {
  // Check type field
  const t = String(lg?.settings?.type ?? lg?.type ?? "").toLowerCase();
  if (t.includes("dynasty") || t === "dynasty" || t === "keeper") return true;

  // Check name and description
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  if (/\bdynasty\b/i.test(name) || /\bkeeper(s)?\b/i.test(name)) return true;

  return false;
}