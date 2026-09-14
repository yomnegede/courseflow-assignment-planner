import { NextRequest, NextResponse } from "next/server";

function isSafeCalendarUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    return true;
  } catch { return false; }
}

function cleanIcsText(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseIcs(source: string) {
  const unfolded = source.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  return blocks.flatMap((block) => {
    const summary = block.match(/^SUMMARY(?:;[^:]*)?:(.*)$/m)?.[1];
    const rawDate = block.match(/^DTSTART(?:;[^:]*)?:(\d{8})/m)?.[1];
    if (!summary || !rawDate) return [];
    const dueDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    return [{ title: cleanIcsText(summary), dueDate }];
  });
}

export async function POST(request: NextRequest) {
  let url = "";
  try { url = String((await request.json()).url || ""); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!isSafeCalendarUrl(url)) return NextResponse.json({ error: "Use a secure public calendar URL" }, { status: 400 });
  try {
    const response = await fetch(url, { redirect: "follow", headers: { accept: "text/calendar,text/plain" } });
    if (!response.ok) throw new Error("Calendar request failed");
    const source = await response.text();
    if (source.length > 2_000_000 || !source.includes("BEGIN:VCALENDAR")) throw new Error("Invalid calendar");
    const events = parseIcs(source).slice(0, 250);
    return NextResponse.json({ events });
  } catch { return NextResponse.json({ error: "Calendar could not be imported" }, { status: 422 }); }
}
