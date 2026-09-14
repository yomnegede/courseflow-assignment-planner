"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, CirclePlus, Clock3, FileSpreadsheet, FileText, Link2, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Difficulty, parseScheduleText, ParsedAssignment } from "@/lib/schedule-parser";

type Course = { id: string; code: string; name: string; color: string; soft: string; source: string };
type Assignment = { id: number; title: string; courseId: string; dueDate: string; difficulty: Difficulty; done?: boolean };

const palette = [
  { color: "#6b5cff", soft: "#eeeaff" }, { color: "#f07149", soft: "#fff0e9" },
  { color: "#159c8c", soft: "#e5f8f4" }, { color: "#d14f8b", soft: "#fceaf3" },
  { color: "#3a79c9", soft: "#e9f2fc" }, { color: "#a06b20", soft: "#faf0dc" },
];

const initialCourses: Course[] = [
  { id: "cs4590", code: "CS 4590", name: "Computer Audio", ...palette[0], source: "Syllabus text" },
  { id: "cs4460", code: "CS 4460", name: "Intro Info Visualization", ...palette[1], source: "PDF syllabus" },
  { id: "cs2261", code: "CS 2261", name: "Living Schedule", ...palette[2], source: "Excel schedule" },
];

const make = (id: number, courseId: string, title: string, dueDate: string, difficulty: Difficulty): Assignment => ({ id, courseId, title, dueDate, difficulty });
const initialAssignments: Assignment[] = [
  make(101, "cs4590", "Homework 1: A Simple Synthesizer", "2026-09-10", "medium"),
  make(102, "cs4590", "Homework 2: Shaping Sounds with LFOs and Envelopes", "2026-09-29", "hard"),
  make(103, "cs4590", "Quiz 1", "2026-10-15", "hard"),
  make(104, "cs4590", "Homework 3: Shazam Lite", "2026-10-22", "hard"),
  make(105, "cs4590", "Homework 4: Movie Sound Effects", "2026-11-12", "hard"),
  make(106, "cs4590", "Quiz 2", "2026-12-03", "hard"),
  make(107, "cs4590", "Homework 5: Simple Autotuner", "2026-12-08", "hard"),
  make(201, "cs4460", "HW 1 (analog)", "2026-09-02", "medium"),
  make(202, "cs4460", "Lab 1 (HTML, CSS, SVG)", "2026-09-09", "medium"),
  make(203, "cs4460", "HW 2 (no vis)", "2026-09-23", "medium"),
  make(204, "cs4460", "Lab 2 (static vis)", "2026-09-30", "medium"),
  make(205, "cs4460", "Exam 1", "2026-10-14", "hard"),
  make(206, "cs4460", "HW 3 (Tableau)", "2026-10-14", "medium"),
  make(207, "cs4460", "Lab 3 (intro to D3)", "2026-10-21", "medium"),
  make(208, "cs4460", "Lab 4 (filtering)", "2026-11-04", "medium"),
  make(209, "cs4460", "HW 4 (Datawrapper)", "2026-11-11", "medium"),
  make(210, "cs4460", "Lab 5 (linking and brushing)", "2026-11-18", "hard"),
  make(211, "cs4460", "Exam 2", "2026-12-02", "hard"),
  make(212, "cs4460", "Final Project (Lab 6)", "2026-12-13", "hard"),
  make(301, "cs2261", "HW 1", "2026-09-16", "medium"),
  make(302, "cs2261", "HW 2", "2026-09-21", "medium"),
  make(303, "cs2261", "HW 3", "2026-09-28", "hard"),
  make(304, "cs2261", "Exam 1", "2026-10-07", "hard"),
  make(305, "cs2261", "HW 4", "2026-10-12", "hard"),
  make(306, "cs2261", "HW 5", "2026-10-26", "hard"),
  make(307, "cs2261", "Milestone 0", "2026-10-28", "medium"),
  make(308, "cs2261", "Exam 2", "2026-10-28", "hard"),
  make(309, "cs2261", "Exam 3", "2026-12-02", "hard"),
  make(310, "cs2261", "Final Project", "2026-12-11", "hard"),
];

const leadDays: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 7 };
const effort: Record<Difficulty, string> = { easy: "30–60 min", medium: "1–2 hrs", hard: "3+ hrs" };
function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function daysBetween(from: Date, date: string) { return Math.round((new Date(`${date}T00:00:00`).getTime() - from.getTime()) / 86400000); }
function dayLabel(date: Date) { return date.toLocaleDateString("en-US", { weekday: "short" }); }
function dateLabel(date: Date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export default function Home() {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [activeCourse, setActiveCourse] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importStage, setImportStage] = useState<"source" | "review">("source");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [draftItems, setDraftItems] = useState<ParsedAssignment[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selectedCourse, setSelectedCourse] = useState(initialCourses[0].id);
  const today = useMemo(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }, []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, weekOffset * 7 + index)), [today, weekOffset]);
  const courseMap = useMemo(() => Object.fromEntries(courses.map((course) => [course.id, course])), [courses]);
  const visibleAssignments = assignments.filter((item) => activeCourse === "all" || item.courseId === activeCourse);
  const scheduledByDay = weekDays.map((_, dayIndex) => {
    const absoluteOffset = weekOffset * 7 + dayIndex;
    return visibleAssignments.filter((item) => { const dueOffset = daysBetween(today, item.dueDate); return absoluteOffset >= dueOffset - leadDays[item.difficulty] && absoluteOffset <= dueOffset; });
  });
  const nextTask = visibleAssignments.filter((item) => !item.done && daysBetween(today, item.dueDate) >= 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  useEffect(() => {
    const saved = window.localStorage.getItem("courseflow-data-v2");
    if (saved) { try { const data = JSON.parse(saved); setCourses(data.courses); setAssignments(data.assignments); setSelectedCourse(data.courses[0]?.id || ""); } catch {} }
  }, []);
  useEffect(() => { window.localStorage.setItem("courseflow-data-v2", JSON.stringify({ courses, assignments })); }, [courses, assignments]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_assignment",
      title: "Add assignment",
      description: "Add a dated assignment to an existing Courseflow course and schedule its work window.",
      inputSchema: { type: "object", properties: { title: { type: "string" }, courseId: { type: "string" }, difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, dueDate: { type: "string", description: "YYYY-MM-DD" } }, required: ["title", "courseId", "difficulty", "dueDate"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { title?: string; courseId?: string; difficulty?: Difficulty; dueDate?: string };
        if (!value.title || !value.courseId || !courseMap[value.courseId] || !value.difficulty || !(value.difficulty in leadDays) || !value.dueDate || Number.isNaN(new Date(`${value.dueDate}T00:00:00`).getTime())) throw new Error("Invalid assignment details");
        const item = { id: Date.now(), title: value.title, courseId: value.courseId, difficulty: value.difficulty, dueDate: value.dueDate } as Assignment;
        setAssignments((items) => [...items, item]);
        return { status: "added", title: item.title, course: courseMap[item.courseId].code, startDate: addDays(new Date(`${item.dueDate}T00:00:00`), -leadDays[item.difficulty]).toISOString().slice(0, 10) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [courseMap]);

  function resetImport(open: boolean) {
    setImportOpen(open); setImportStage("source"); setImportError(""); setDraftItems([]); setCourseName(""); setCourseCode(""); setSourceName(""); setPasteText("");
  }

  function reviewText(text: string, name: string) {
    const parsed = parseScheduleText(text, name, 2026);
    if (!parsed.assignments.length) throw new Error("No assignments with dates were found. Try pasting the schedule table or course summary instead.");
    setCourseCode(parsed.courseCode);
    setCourseName(parsed.courseName || parsed.courseCode || "New course");
    setSourceName(name || "Pasted schedule");
    setDraftItems(parsed.assignments);
    setImportStage("review");
  }

  async function readPdf(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join(""));
    }
    return pages.join("\n");
  }

  async function readSpreadsheet(file: File) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: "mmmm d, yyyy" });
      const headerIndex = rows.findIndex((row) => row.some((cell) => /^date$/i.test(String(cell || ""))) && row.some((cell) => /^due/i.test(String(cell || ""))));
      const header = headerIndex >= 0 ? rows[headerIndex] : [];
      const dateColumn = header.findIndex((cell) => /^date$/i.test(String(cell || "")));
      const dueColumn = header.findIndex((cell) => /^due/i.test(String(cell || "")));
      if (headerIndex >= 0 && dateColumn >= 0 && dueColumn >= 0) {
        rows.slice(0, headerIndex).forEach((row) => lines.push(row.map((cell) => String(cell || "").trim()).filter(Boolean).join(" | ")));
        for (let index = headerIndex + 1; index < rows.length; index++) {
          const date = String(rows[index][dateColumn] || "").trim();
          if (!date) continue;
          const dueItems = String(rows[index][dueColumn] || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
          dueItems.forEach((item) => lines.push(`${date} | ${item} DUE`));
          rows[index].forEach((cell, column) => {
            const value = String(cell || "").trim();
            if (column === dueColumn) return;
            if (/\bdue\b/i.test(value) || (/^(?:exam|quiz|midterm)\s*#?\d+/i.test(value) && !/review|help/i.test(value))) lines.push(`${date} | ${value} DUE`);
          });
        }
      } else {
        rows.forEach((row) => { const values = row.map((cell) => String(cell || "").trim()).filter(Boolean); if (values.length) lines.push(values.join(" | ")); });
      }
    }
    return lines.join("\n");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setImporting(true); setImportError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const text = extension === "pdf" ? await readPdf(file) : extension === "xlsx" || extension === "xls" ? await readSpreadsheet(file) : await file.text();
      reviewText(text, file.name);
    } catch (error) { setImportError(error instanceof Error ? error.message : "That file could not be read."); }
    finally { setImporting(false); event.target.value = ""; }
  }

  async function importCalendarUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setImporting(true); setImportError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: data.get("calendarUrl") }) });
      if (!response.ok) throw new Error("That calendar link could not be read.");
      const payload = await response.json() as { events: { title: string; dueDate: string }[] };
      if (!payload.events.length) throw new Error("No dated events were found in that calendar.");
      setCourseName(String(data.get("feedName") || "New course")); setCourseCode(String(data.get("feedCode") || "")); setSourceName("iCal subscription");
      setDraftItems(payload.events.map((item, index) => ({ id: `ical-${index}`, title: item.title, dueDate: item.dueDate, difficulty: /project|exam|final/i.test(item.title) ? "hard" : "medium", included: true })));
      setImportStage("review");
    } catch (error) { setImportError(error instanceof Error ? error.message : "That calendar link could not be read."); }
    finally { setImporting(false); }
  }

  function confirmImport() {
    const included = draftItems.filter((item) => item.included && item.title && item.dueDate);
    if (!included.length || !courseName.trim()) { setImportError("Keep at least one dated item and add a course name."); return; }
    const id = `${(courseCode || courseName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
    const colors = palette[courses.length % palette.length];
    setCourses((items) => [...items, { id, code: courseCode.trim() || courseName.trim().slice(0, 12), name: courseName.trim(), source: sourceName, ...colors }]);
    setAssignments((items) => [...items, ...included.map((item, index) => ({ id: Date.now() + index, courseId: id, title: item.title, dueDate: item.dueDate, difficulty: item.difficulty }))]);
    setSelectedCourse(id); setActiveCourse(id); resetImport(false);
  }

  function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setAssignments((items) => [...items, { id: Date.now(), title: String(data.get("title")), courseId: selectedCourse, dueDate: String(data.get("due")), difficulty }]);
    setAssignmentOpen(false);
  }

  function toggleDone(id: number) { setAssignments((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item)); }
  function updateDraft(id: string, changes: Partial<ParsedAssignment>) { setDraftItems((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item)); }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#17203b]">
      <header className="sticky top-0 z-30 border-b border-[#dfe3ed] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 px-4 sm:px-7">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-[#1b2a5b] text-white shadow-[0_7px_18px_rgba(27,42,91,.22)]"><CalendarDays className="size-5" /></span><div><p className="font-display text-[1.15rem] font-bold leading-tight tracking-[-.02em]">Courseflow</p><p className="text-xs font-medium text-[#7e879f]">Fall 2026</p></div></div>
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={importOpen} onOpenChange={resetImport}>
              <DialogTrigger asChild><button aria-label="Import schedule" className="flex h-10 items-center gap-2 rounded-xl border border-[#dfe3ed] bg-white px-3 text-sm font-semibold shadow-sm transition hover:border-[#bfc6d8] sm:px-3.5"><UploadCloud className="size-4 text-[#637099]" /><span className="hidden sm:inline">Import schedule</span></button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-[#dfe3ed] bg-white sm:max-w-[720px]">
                {importStage === "source" ? <>
                  <DialogHeader><DialogTitle className="font-display text-2xl">Add a course schedule</DialogTitle><DialogDescription>Upload a syllabus or living schedule, paste its text, or connect an iCal feed. You will review everything before it reaches your plan.</DialogDescription></DialogHeader>
                  <Tabs defaultValue="file" className="mt-2">
                    <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="file"><FileText /> File</TabsTrigger><TabsTrigger value="paste"><FileSpreadsheet /> Paste</TabsTrigger><TabsTrigger value="link"><Link2 /> Calendar link</TabsTrigger></TabsList>
                    <TabsContent value="file" className="pt-3"><label className="group grid min-h-44 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#ccd2e2] bg-[#f8f9fc] p-6 text-center transition hover:border-[#8b81f6] hover:bg-[#f4f2ff]"><input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.ics" onChange={handleFile} className="sr-only" /><span><UploadCloud className="mx-auto mb-3 size-8 text-[#6b5cff]" /><strong className="block text-base">Choose a syllabus or schedule</strong><small className="mt-1 block text-sm text-[#7e879f]">PDF, Excel, CSV, text, Markdown, or iCal</small></span></label></TabsContent>
                    <TabsContent value="paste" className="space-y-3 pt-3"><Textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste the schedule table, course summary, or syllabus text here…" className="min-h-48 resize-y" /><Button type="button" onClick={() => { try { reviewText(pasteText, "Pasted schedule"); } catch (error) { setImportError(error instanceof Error ? error.message : "No schedule found."); } }} disabled={!pasteText.trim()} className="w-full bg-[#6b5cff] hover:bg-[#5d4fe8]">Find assignments</Button></TabsContent>
                    <TabsContent value="link" className="pt-3"><form onSubmit={importCalendarUrl} className="grid gap-4"><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="feedName">Course name</Label><Input id="feedName" name="feedName" placeholder="Computer Audio" required /></div><div className="grid gap-2"><Label htmlFor="feedCode">Course code</Label><Input id="feedCode" name="feedCode" placeholder="CS 4590" /></div></div><div className="grid gap-2"><Label htmlFor="calendarUrl">iCal subscription URL</Label><Input id="calendarUrl" name="calendarUrl" type="url" placeholder="https://…/calendar.ics" required /></div><Button type="submit" disabled={importing} className="bg-[#6b5cff] hover:bg-[#5d4fe8]">{importing && <Loader2 className="animate-spin" />} Read calendar</Button></form></TabsContent>
                  </Tabs>
                  {importing && <p className="flex items-center justify-center gap-2 text-sm font-semibold text-[#6b5cff]"><Loader2 className="size-4 animate-spin" /> Reading your schedule…</p>}
                  {importError && <p role="alert" className="rounded-xl bg-[#fff0f0] px-3 py-2 text-sm font-semibold text-[#b43d49]">{importError}</p>}
                </> : <>
                  <DialogHeader><DialogTitle className="font-display text-2xl">Review what Courseflow found</DialogTitle><DialogDescription>Keep only real due dates. You can correct names, dates, and difficulty before importing.</DialogDescription></DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="courseName">Course name</Label><Input id="courseName" value={courseName} onChange={(event) => setCourseName(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="courseCode">Course code</Label><Input id="courseCode" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} /></div></div>
                  <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">{draftItems.map((item) => <div key={item.id} className={`review-row ${item.included ? "" : "opacity-50"}`}><Checkbox checked={item.included} onCheckedChange={(checked) => updateDraft(item.id, { included: checked === true })} aria-label={`Include ${item.title}`} /><Input value={item.title} onChange={(event) => updateDraft(item.id, { title: event.target.value })} aria-label="Assignment title" className="h-9" /><Input type="date" value={item.dueDate} onChange={(event) => updateDraft(item.id, { dueDate: event.target.value })} aria-label="Due date" className="h-9 min-w-36" /><Select value={item.difficulty} onValueChange={(value) => updateDraft(item.id, { difficulty: value as Difficulty })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div>)}</div>
                  {importError && <p role="alert" className="rounded-xl bg-[#fff0f0] px-3 py-2 text-sm font-semibold text-[#b43d49]">{importError}</p>}
                  <DialogFooter><Button type="button" variant="outline" onClick={() => setImportStage("source")}>Back</Button><Button type="button" onClick={confirmImport} className="bg-[#6b5cff] hover:bg-[#5d4fe8]">Import {draftItems.filter((item) => item.included).length} assignments</Button></DialogFooter>
                </>}
              </DialogContent>
            </Dialog>

            <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
              <DialogTrigger asChild><Button disabled={!courses.length} className="h-10 rounded-xl bg-[#6b5cff] px-3 shadow-[0_7px_16px_rgba(107,92,255,.22)] hover:bg-[#5d4fe8] sm:px-4"><CirclePlus /><span className="hidden sm:inline">Add assignment</span></Button></DialogTrigger>
              <DialogContent className="rounded-2xl border-[#dfe3ed] bg-white sm:max-w-[460px]"><form onSubmit={addAssignment} className="contents"><DialogHeader><DialogTitle className="font-display text-2xl">Add an assignment</DialogTitle><DialogDescription>Courseflow will place it on your plan automatically.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="title">Assignment</Label><Input id="title" name="title" placeholder="e.g. Literature review" required /></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>Course</Label><Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{courses.map((item) => <SelectItem key={item.id} value={item.id}>{item.code}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy · 2 days</SelectItem><SelectItem value="medium">Medium · 4 days</SelectItem><SelectItem value="hard">Hard · 7 days</SelectItem></SelectContent></Select></div></div><div className="grid gap-2"><Label htmlFor="due">Due date</Label><Input id="due" name="due" type="date" required /></div></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" className="bg-[#6b5cff] hover:bg-[#5d4fe8]">Build my plan</Button></DialogFooter></form></DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[250px_minmax(0,1fr)] lg:py-7">
        <aside className="rounded-2xl border border-[#dfe3ed] bg-white p-3 shadow-[0_12px_40px_rgba(32,49,96,.06)] lg:sticky lg:top-[100px] lg:h-[calc(100vh-124px)]">
          <div className="flex items-center justify-between px-2 pb-3 pt-1"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b93a7]">My courses</p><button onClick={() => resetImport(true)} className="text-xs font-bold text-[#6b5cff]">+ Import</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1">
            <button onClick={() => setActiveCourse("all")} className={`course-filter ${activeCourse === "all" ? "active" : ""}`}><span className="grid size-8 place-items-center rounded-lg bg-[#edf0f8] text-[#34416b]"><BookOpen className="size-4" /></span><span className="whitespace-nowrap text-left"><strong>All courses</strong><small>{assignments.filter((item) => daysBetween(today, item.dueDate) >= 0).length} upcoming</small></span></button>
            {courses.map((item) => <button key={item.id} onClick={() => setActiveCourse(item.id)} className={`course-filter ${activeCourse === item.id ? "active" : ""}`}><span className="size-3 rounded-full" style={{ background: item.color }} /><span className="whitespace-nowrap text-left"><strong>{item.code}</strong><small>{item.name}</small></span></button>)}
          </div>
          <div className="mt-4 hidden border-t border-[#e8eaf0] px-2 pt-5 lg:block"><div className="rounded-xl bg-[#f2f0ff] p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-[#5749d7]"><Sparkles className="size-4" /> Smart timing</div><p className="text-sm leading-5 text-[#666f89]">Easy work starts 2 days early. Medium starts 4 days early. Hard starts 7 days early.</p></div></div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-sm font-semibold text-[#6b5cff]">{dateLabel(today)}</p><h1 className="font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-none tracking-[-.045em]">Your week, mapped out.</h1></div><div className="flex items-center gap-2 self-start rounded-xl border border-[#dfe3ed] bg-white p-1 shadow-sm sm:self-auto"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} className="nav-button"><ChevronLeft /></button><button onClick={() => setWeekOffset(0)} className="px-2 text-sm font-bold">{weekOffset === 0 ? "Next 7 days" : dateLabel(weekDays[0])}</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} className="nav-button"><ChevronRight /></button></div></div>
          {weekOffset === 0 && nextTask && courseMap[nextTask.courseId] && <div className="mb-5 grid gap-4 overflow-hidden rounded-2xl bg-[#1b2a5b] p-5 text-white shadow-[0_16px_45px_rgba(27,42,91,.2)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"><div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#b9c4ef]"><Clock3 className="size-4" /> Best thing to work on now</p><h2 className="font-display text-2xl font-bold tracking-[-.02em]">{nextTask.title}</h2><p className="mt-1 text-sm text-[#c8d0eb]">{courseMap[nextTask.courseId].code} · {effort[nextTask.difficulty]} today keeps you ahead.</p></div><button onClick={() => toggleDone(nextTask.id)} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#1b2a5b] transition hover:bg-[#f0f2fb]">Mark complete <ArrowRight className="size-4" /></button></div>}
          <div className="calendar-shell"><div className="calendar-grid min-w-[820px]">{weekDays.map((day, index) => <div key={day.toISOString()} className={`day-column ${weekOffset === 0 && index === 0 ? "today" : ""}`}><div className="day-heading"><span>{dayLabel(day)}</span><strong>{day.getDate()}</strong>{weekOffset === 0 && index === 0 && <small>Today</small>}</div><div className="min-h-[430px] space-y-3 p-2.5">{scheduledByDay[index].map((item) => { const courseInfo = courseMap[item.courseId]; if (!courseInfo) return null; const absoluteOffset = weekOffset * 7 + index; const dueOffset = daysBetween(today, item.dueDate); const isDue = absoluteOffset === dueOffset; const isStart = absoluteOffset === dueOffset - leadDays[item.difficulty]; return <article key={item.id} className={`assignment-card ${item.done ? "done" : ""}`} style={{ "--course": courseInfo.color, "--course-soft": courseInfo.soft } as React.CSSProperties}><div className="mb-2 flex items-center justify-between gap-1"><span className="course-code">{courseInfo.code}</span><Checkbox checked={item.done} onCheckedChange={() => toggleDone(item.id)} aria-label={`Mark ${item.title} complete`} className="border-[#c8cede] data-[state=checked]:border-[var(--course)] data-[state=checked]:bg-[var(--course)]" /></div><h3>{item.title}</h3><p>{isDue ? `Due ${dateLabel(new Date(`${item.dueDate}T00:00:00`))}` : isStart ? "Start today" : "Work session"}</p><div className="mt-3 flex gap-1">{Array.from({ length: leadDays[item.difficulty] + 1 }, (_, step) => <span key={step} className="h-1 flex-1 rounded-full bg-[var(--course)]" style={{ opacity: step <= absoluteOffset - (dueOffset - leadDays[item.difficulty]) ? 1 : .18 }} />)}</div></article>; })}{scheduledByDay[index].length === 0 && <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[#dfe3ed] text-sm font-medium text-[#a0a7b7]">Open space</div>}</div></div>)}</div></div>
          <p className="mt-3 text-center text-sm text-[#7e879f] lg:hidden">Swipe sideways to see the full week.</p>
        </section>
      </div>
    </main>
  );
}
