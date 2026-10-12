/**
 * Receives a report when a page breaks in someone's browser (see
 * components/Recover.tsx) and writes it to the server log as "[client]",
 * where it can be read without asking the person to open their browser's
 * console. Nothing is stored.
 */
export async function POST(request: Request) {
  const text = (await request.text().catch(() => "")).slice(0, 2000);
  let report: { message?: unknown; stack?: unknown; digest?: unknown; path?: unknown } = {};
  try {
    report = JSON.parse(text) as typeof report;
  } catch {}
  const line = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").slice(0, max) : "");
  console.error(`[client] ${line(report.path, 80)} ${line(report.message, 300)} | ${line(report.stack, 900)}${report.digest ? ` | digest ${line(report.digest, 40)}` : ""}`);
  return new Response(null, { status: 204 });
}
