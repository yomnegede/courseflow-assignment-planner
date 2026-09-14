export type Difficulty = "easy" | "medium" | "hard";

export type ParsedAssignment = {
  id: string;
  title: string;
  dueDate: string;
  difficulty: Difficulty;
  included: boolean;
};

export type ParsedSchedule = {
  courseCode: string;
  courseName: string;
  assignments: ParsedAssignment[];
};

const monthIndex: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const assignmentWords = /\b(homework|hw\s*\d+|lab\s*\d+|project|exam|quiz|assignment|milestone|survey|paper|report|presentation|midterm|final)\b/i;
const nonDueWords = /\b(help|review|preview|intro(?:duction)?|practicum|recitation|q\s*&\s*a|tutorial|assigned|released)\b/i;
const taskStart = /\b(?:homework\s*#?\d+|hw\s*#?\d+|lab\s*#?\d+|exam\s*#?\d+|quiz\s*#?\d+|milestone\s*#?\d+|final\s+project|midterm|survey|paper|report|presentation|project)\b/gi;

function isoDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function findDate(text: string, fallbackYear = new Date().getFullYear()) {
  const named = text.match(/\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?[,.\s]*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/i);
  if (named) return isoDate(Number(named[3] || fallbackYear), monthIndex[named[1].toLowerCase()], Number(named[2]));
  const numeric = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/) || text.match(/^\s*(\d{1,2})[\/-](\d{1,2})\b/);
  if (numeric) {
    const suppliedYear = numeric[3] ? Number(numeric[3]) : fallbackYear;
    const year = suppliedYear < 100 ? 2000 + suppliedYear : suppliedYear;
    return isoDate(year, Number(numeric[1]) - 1, Number(numeric[2]));
  }
  const compact = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (compact) return isoDate(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]));
  return null;
}

function inferDifficulty(title: string): Difficulty {
  if (/\b(final|project|exam|midterm|research|proposal)\b/i.test(title)) return "hard";
  if (/\b(homework|hw|lab|paper|report|presentation|milestone)\b/i.test(title)) return "medium";
  return "easy";
}

function cleanTitle(line: string) {
  let value = line
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^.*?\b(?:20\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b[\s|,:-]*/i, "")
    .replace(/\b(?:due(?:\s+by)?|assigned|released)\b.*$/i, "")
    .replace(/^\s*(?:assignment\s*)?/i, "")
    .replace(/[!*_#|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = value.match(/((?:homework|hw|lab|project|exam|quiz|assignment|milestone|survey|paper|report|presentation|midterm|final)\b.*)/i);
  if (match) value = match[1].trim();
  return value.replace(/[:\-–—]+$/, "").trim();
}

function inferCourse(text: string, sourceName = "") {
  const combined = `${sourceName}\n${text.slice(0, 5000)}`;
  const codeMatch = combined.match(/\b([A-Z]{2,5})[\s_-]?(\d{3,4}[A-Z]?)\b/i);
  const courseCode = codeMatch ? `${codeMatch[1].toUpperCase()} ${codeMatch[2].toUpperCase()}` : "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
  const nameLine = lines.find((line) => courseCode && line.toUpperCase().includes(courseCode)) || lines.find((line) => /syllabus|schedule/i.test(line) && line.length < 120) || lines.find((line) => line.length > 8 && line.length < 90) || "";
  const courseName = nameLine.replace(/\b(?:fall|spring|summer)\s+20\d{2}\b/ig, "").replace(/\b(?:syllabus|schedule)\b/ig, "").replace(courseCode, "").replace(/[|_-]+/g, " ").replace(/\s+/g, " ").trim();
  return { courseCode, courseName };
}

export function parseScheduleText(text: string, sourceName = "", fallbackYear = 2026): ParsedSchedule {
  const normalized = text.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n").map((line) => line.trim()).filter((line) => line && !/^\|?\s*:?-{2,}/.test(line));
  const candidates: { title: string; dueDate: string }[] = [];
  let currentDate: string | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("COURSEFLOW_DUE\t")) {
      const [, dueDate, ...titleParts] = line.split("\t");
      const title = titleParts.join(" ").trim();
      if (dueDate && title) candidates.push({ title, dueDate });
      continue;
    }
    const date = findDate(line, fallbackYear);
    if (date) currentDate = date;
    if (!assignmentWords.test(line)) continue;
    const dueDate = date || currentDate;
    if (!dueDate) continue;
    const explicitDue = /\bdue\b/i.test(line);
    const matches = [...line.matchAll(taskStart)];
    if (!matches.length) continue;
    for (let taskIndex = 0; taskIndex < matches.length; taskIndex++) {
      const start = matches[taskIndex].index ?? 0;
      const end = matches[taskIndex + 1]?.index ?? line.length;
      const segment = line.slice(start, end);
      if (!explicitDue && nonDueWords.test(segment)) continue;
      if (!explicitDue && /^project\b/i.test(segment.trim())) continue;
      const title = cleanTitle(segment);
      if (!title || title.length < 3 || title.length > 140) continue;
      candidates.push({ title, dueDate });
    }
  }

  const unique = new Map<string, ParsedAssignment>();
  for (const candidate of candidates) {
    const key = `${candidate.title.toLowerCase().replace(/\W/g, "")}|${candidate.dueDate}`;
    if (!unique.has(key)) unique.set(key, {
      id: `${candidate.dueDate}-${unique.size}`,
      title: candidate.title,
      dueDate: candidate.dueDate,
      difficulty: inferDifficulty(candidate.title),
      included: true,
    });
  }

  return { ...inferCourse(normalized, sourceName), assignments: [...unique.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) };
}
