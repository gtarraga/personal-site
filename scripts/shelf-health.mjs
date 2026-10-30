const MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function shelfHealth(snapshot, now = Date.now()) {
  const errors = [...(snapshot.errors ?? [])];
  for (const source of ["film", "book"]) {
    const timestamp = snapshot.refreshedAt?.[source] ?? snapshot.generatedAt;
    const age = now - Date.parse(timestamp);
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      errors.push({ source, message: "last successful refresh is older than 36 hours or unknown" });
    }
  }
  return { ok: errors.length === 0, refreshedAt: snapshot.refreshedAt ?? null, errors };
}
