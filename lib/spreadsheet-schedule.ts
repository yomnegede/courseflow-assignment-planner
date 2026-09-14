import { findDate } from "@/lib/schedule-parser";

const weekdayIndex: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nextWeekday(date: Date, target: number) {
  const result = new Date(date);
  const distance = (target - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + distance);
  return result.toISOString().slice(0, 10);
}

function splitAssignments(value: string) {
  return value
    .split(/\r?\n|\s+\+\s+|,\s*(?=[^,]*\bdue\b)/i)
    .map((item) => item.replace(/^[-•]\s*/, "").replace(/\s+due(?:\s+by\b.*)?[.!]?$/i, "").trim())
    .filter(Boolean);
}

export function spreadsheetRowsToSchedule(rows: unknown[][], fallbackYear = 2026) {
  const meaningfulRows = rows.filter((row) => row.some((cell) => text(cell)));
  const headerIndex = meaningfulRows.findIndex((row) => row.some((cell) => /\b(due|deadline)\b/i.test(text(cell))));
  if (headerIndex < 0) return meaningfulRows.map((row) => row.map(text).filter(Boolean).join(" | ")).join("\n");

  const header = meaningfulRows[headerIndex];
  const dueColumn = header.findIndex((cell) => /\b(due|deadline)\b/i.test(text(cell)));
  const dateColumn = header.findIndex((cell) => /^date$/i.test(text(cell)));
  const weekColumn = header.findIndex((cell) => /^week$/i.test(text(cell)));
  const dueHeader = text(header[dueColumn]);
  const weekdayMatch = dueHeader.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)s?\b/i);
  const dueWeekday = weekdayMatch ? weekdayIndex[weekdayMatch[1].toLowerCase()] : null;
  const hasTeamPreferenceException = /except\s+team\s+preference/i.test(dueHeader);
  const dataRows = meaningfulRows.slice(headerIndex + 1);
  const maxColumns = Math.max(header.length, ...dataRows.slice(0, 40).map((row) => row.length));
  const likelyDateColumns = Array.from({ length: maxColumns }, (_, column) => column).filter((column) =>
    column !== dueColumn && dataRows.slice(0, 36).filter((row) => findDate(text(row[column]), fallbackYear)).length >= 2
  );
  const lines = meaningfulRows.slice(0, headerIndex).map((row) => row.map(text).filter(Boolean).join(" | ")).filter(Boolean);

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const dueValue = text(dataRows[rowIndex][dueColumn]);
    const items = splitAssignments(dueValue);

    let blockStart = rowIndex;
    let blockEnd = rowIndex;
    if (weekColumn >= 0) {
      for (let cursor = rowIndex; cursor >= 0; cursor--) {
        if (text(dataRows[cursor][weekColumn])) { blockStart = cursor; break; }
      }
      blockEnd = dataRows.findIndex((row, cursor) => cursor > blockStart && text(row[weekColumn]));
      if (blockEnd < 0) blockEnd = dataRows.length;
      else blockEnd -= 1;
    }

    const rowDates = (dateColumn >= 0 ? [dateColumn] : likelyDateColumns)
      .map((column) => findDate(text(dataRows[rowIndex][column]), fallbackYear)).filter((date): date is string => Boolean(date));
    const blockDates = dataRows.slice(blockStart, blockEnd + 1).flatMap((row) => likelyDateColumns
      .map((column) => findDate(text(row[column]), fallbackYear)).filter((date): date is string => Boolean(date)));

    if (dateColumn >= 0 && rowDates[0]) {
      dataRows[rowIndex].forEach((cell, column) => {
        if (column === dueColumn) return;
        const value = text(cell);
        if (/\bdue\b/i.test(value) || (/^(?:exam|quiz|midterm)\s*#?\d+/i.test(value) && !/review|help/i.test(value))) {
          splitAssignments(value).forEach((item) => lines.push(`COURSEFLOW_DUE\t${rowDates[0]}\t${item}`));
        }
      });
    }

    if (!items.length) continue;

    for (const item of items) {
      const explicitDate = findDate(item, fallbackYear);
      let dueDate = explicitDate || rowDates[0] || blockDates.sort().at(-1) || null;
      if (!explicitDate && dueWeekday !== null && dueDate) {
        const isException = hasTeamPreferenceException && /team preference/i.test(item) && rowDates.length;
        const basis = isException ? rowDates.sort().at(-1)! : blockDates.sort().at(-1) || dueDate;
        dueDate = isException ? basis : nextWeekday(new Date(`${basis}T00:00:00`), dueWeekday);
      }
      if (dueDate) lines.push(`COURSEFLOW_DUE\t${dueDate}\t${item}`);
    }

  }

  return lines.join("\n");
}
