"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CalendarSync, ChevronLeft, ChevronRight, CirclePlus, Clock3, Link2, Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Difficulty = "easy" | "medium" | "hard";
type CourseKey = "psych" | "stats" | "bio";
type Assignment = { id: number; title: string; course: CourseKey; dueOffset: number; difficulty: Difficulty; done?: boolean };

const courses = {
  psych: { name: "Social Psychology", code: "PSYC 221", color: "#6b5cff", soft: "#eeeaff" },
  stats: { name: "Applied Statistics", code: "STAT 210", color: "#f07149", soft: "#fff0e9" },
  bio: { name: "Human Biology", code: "BIOL 118", color: "#159c8c", soft: "#e5f8f4" },
};

const initialAssignments: Assignment[] = [
  { id: 1, title: "Research proposal", course: "psych", dueOffset: 3, difficulty: "hard" },
  { id: 2, title: "Problem set 4", course: "stats", dueOffset: 2, difficulty: "medium" },
  { id: 3, title: "Cell signaling quiz", course: "bio", dueOffset: 1, difficulty: "easy" },
  { id: 4, title: "Lab data write-up", course: "bio", dueOffset: 5, difficulty: "hard" },
  { id: 5, title: "Reading reflection", course: "psych", dueOffset: 6, difficulty: "easy" },
];

const leadDays: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 7 };
const effort: Record<Difficulty, string> = { easy: "30–60 min", medium: "1–2 hrs", hard: "3+ hrs" };

function addDays(date: Date, days: number) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function dayLabel(date: Date) { return date.toLocaleDateString("en-US", { weekday: "short" }); }
function dateLabel(date: Date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export default function Home() {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeCourse, setActiveCourse] = useState<"all" | CourseKey>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectCourse, setConnectCourse] = useState<CourseKey>("psych");
  const [connectDifficulty, setConnectDifficulty] = useState<Difficulty>("medium");
  const [connectStatus, setConnectStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [course, setCourse] = useState<CourseKey>("psych");
  const today = useMemo(() => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }, []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, weekOffset * 7 + index)), [today, weekOffset]);
  const visibleAssignments = assignments.filter((item) => activeCourse === "all" || item.course === activeCourse);
  const scheduledByDay = weekDays.map((_, dayIndex) => {
    const absoluteOffset = weekOffset * 7 + dayIndex;
    return visibleAssignments.filter((item) => absoluteOffset >= item.dueOffset - leadDays[item.difficulty] && absoluteOffset <= item.dueOffset);
  });
  const nextTask = visibleAssignments.filter((item) => !item.done).sort((a, b) => a.dueOffset - b.dueOffset)[0];

  useEffect(() => {
    const saved = window.localStorage.getItem("courseflow-assignments-v1");
    if (saved) {
      try { setAssignments(JSON.parse(saved)); } catch { /* Keep the starter plan if saved data is invalid. */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("courseflow-assignments-v1", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_assignment",
      title: "Add assignment",
      description: "Add an assignment to Courseflow and automatically schedule its work window.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          course: { type: "string", enum: ["psych", "stats", "bio"] },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        },
        required: ["title", "course", "difficulty", "dueDate"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { title?: string; course?: CourseKey; difficulty?: Difficulty; dueDate?: string };
        if (!value.title || !value.course || !value.difficulty || !value.dueDate || !(value.course in courses) || !(value.difficulty in leadDays)) throw new Error("Invalid assignment details");
        const dueDate = new Date(`${value.dueDate}T00:00:00`);
        if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid due date");
        const item = { id: Date.now(), title: value.title, course: value.course, difficulty: value.difficulty, dueOffset: Math.max(0, Math.round((dueDate.getTime() - today.getTime()) / 86400000)) };
        setAssignments((items) => [...items, item]);
        return { status: "added", title: item.title, startsInDays: Math.max(0, item.dueOffset - leadDays[item.difficulty]) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [today]);

  function toggleDone(id: number) {
    setAssignments((items) => items.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  }

  function addAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "New assignment");
    const due = String(data.get("due"));
    const dueDate = due ? new Date(`${due}T00:00:00`) : addDays(today, 5);
    const dueOffset = Math.max(0, Math.round((dueDate.getTime() - today.getTime()) / 86400000));
    setAssignments((items) => [...items, { id: Date.now(), title, course, difficulty, dueOffset }]);
    setDialogOpen(false);
  }

  async function connectSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectStatus("loading");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: data.get("calendarUrl") }) });
      if (!response.ok) throw new Error("Unable to read calendar");
      const payload = await response.json() as { events: { title: string; dueDate: string }[] };
      const imported = payload.events.map((event, index) => {
        const dueDate = new Date(`${event.dueDate}T00:00:00`);
        return { id: Date.now() + index, title: event.title, course: connectCourse, difficulty: connectDifficulty, dueOffset: Math.max(0, Math.round((dueDate.getTime() - today.getTime()) / 86400000)) };
      });
      setAssignments((items) => [...items, ...imported]);
      setConnectStatus("success");
      window.setTimeout(() => setConnectOpen(false), 800);
    } catch {
      setConnectStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#17203b]">
      <header className="sticky top-0 z-30 border-b border-[#dfe3ed] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[13px] bg-[#1b2a5b] text-white shadow-[0_7px_18px_rgba(27,42,91,.22)]"><CalendarDays className="size-5" /></span>
            <div><p className="font-display text-[1.15rem] font-bold leading-tight tracking-[-.02em]">Courseflow</p><p className="text-xs font-medium text-[#7e879f]">Fall semester</p></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={connectOpen} onOpenChange={(open) => { setConnectOpen(open); if (open) setConnectStatus("idle"); }}>
              <DialogTrigger asChild><button aria-label="Connect schedules" className="flex h-10 items-center gap-2 rounded-xl border border-[#dfe3ed] bg-white px-3 text-sm font-semibold shadow-sm transition hover:border-[#bfc6d8] sm:px-3.5"><Link2 className="size-4 text-[#637099]" /><span className="hidden sm:inline">Connect schedules</span></button></DialogTrigger>
              <DialogContent className="rounded-2xl border-[#dfe3ed] bg-white sm:max-w-[500px]">
                <form onSubmit={connectSchedule} className="contents">
                  <DialogHeader><div className="mb-1 grid size-11 place-items-center rounded-xl bg-[#eef0ff] text-[#6254e8]"><CalendarSync className="size-5" /></div><DialogTitle className="font-display text-2xl">Connect a course schedule</DialogTitle><DialogDescription>Paste the private iCal subscription link from Canvas, Blackboard, Moodle, or your calendar. Courseflow imports assignment dates and keeps the link off the page.</DialogDescription></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2"><Label htmlFor="calendarUrl">iCal schedule URL</Label><Input id="calendarUrl" name="calendarUrl" type="url" placeholder="https://…/calendar.ics" required /></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2"><Label>Import into</Label><Select value={connectCourse} onValueChange={(value) => setConnectCourse(value as CourseKey)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(courses).map(([key, value]) => <SelectItem key={key} value={key}>{value.code}</SelectItem>)}</SelectContent></Select></div>
                      <div className="grid gap-2"><Label>Default difficulty</Label><Select value={connectDifficulty} onValueChange={(value) => setConnectDifficulty(value as Difficulty)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy · 2 days</SelectItem><SelectItem value="medium">Medium · 4 days</SelectItem><SelectItem value="hard">Hard · 7 days</SelectItem></SelectContent></Select></div>
                    </div>
                    {connectStatus === "error" && <p role="alert" className="rounded-lg bg-[#fff0f0] px-3 py-2 text-sm font-semibold text-[#b43d49]">That schedule could not be read. Check that it is a public iCal subscription link.</p>}
                    {connectStatus === "success" && <p className="rounded-lg bg-[#e8f8f2] px-3 py-2 text-sm font-semibold text-[#157b68]">Schedule connected — your plan is updated.</p>}
                  </div>
                  <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={connectStatus === "loading"} className="bg-[#6b5cff] hover:bg-[#5d4fe8]">{connectStatus === "loading" && <Loader2 className="animate-spin" />} Import schedule</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button className="h-10 rounded-xl bg-[#6b5cff] px-4 shadow-[0_7px_16px_rgba(107,92,255,.22)] hover:bg-[#5d4fe8]"><CirclePlus /> Add assignment</Button></DialogTrigger>
              <DialogContent className="rounded-2xl border-[#dfe3ed] bg-white sm:max-w-[460px]">
                <form onSubmit={addAssignment} className="contents">
                  <DialogHeader><DialogTitle className="font-display text-2xl">Add an assignment</DialogTitle><DialogDescription>Courseflow will place it on your plan automatically.</DialogDescription></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2"><Label htmlFor="title">Assignment</Label><Input id="title" name="title" placeholder="e.g. Literature review" required /></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2"><Label>Course</Label><Select value={course} onValueChange={(value) => setCourse(value as CourseKey)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(courses).map(([key, value]) => <SelectItem key={key} value={key}>{value.code}</SelectItem>)}</SelectContent></Select></div>
                      <div className="grid gap-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy · start 2 days early</SelectItem><SelectItem value="medium">Medium · start 4 days early</SelectItem><SelectItem value="hard">Hard · start 7 days early</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="due">Due date</Label><Input id="due" name="due" type="date" required /></div>
                  </div>
                  <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" className="bg-[#6b5cff] hover:bg-[#5d4fe8]">Build my plan</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-7">
        <aside className="rounded-2xl border border-[#dfe3ed] bg-white p-3 shadow-[0_12px_40px_rgba(32,49,96,.06)] lg:sticky lg:top-[100px] lg:h-[calc(100vh-124px)]">
          <div className="flex items-center justify-between px-2 pb-3 pt-1"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b93a7]">My courses</p><button aria-label="Course options" className="rounded-lg p-1.5 text-[#8b93a7] hover:bg-[#f3f4f8]"><MoreHorizontal className="size-4" /></button></div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1">
            <button onClick={() => setActiveCourse("all")} className={`course-filter ${activeCourse === "all" ? "active" : ""}`}><span className="grid size-8 place-items-center rounded-lg bg-[#edf0f8] text-[#34416b]"><BookOpen className="size-4" /></span><span className="whitespace-nowrap text-left"><strong>All courses</strong><small>{assignments.length} assignments</small></span></button>
            {Object.entries(courses).map(([key, item]) => <button key={key} onClick={() => setActiveCourse(key as CourseKey)} className={`course-filter ${activeCourse === key ? "active" : ""}`}><span className="size-3 rounded-full" style={{ background: item.color }} /><span className="whitespace-nowrap text-left"><strong>{item.code}</strong><small>{item.name}</small></span></button>)}
          </div>
          <div className="mt-4 hidden border-t border-[#e8eaf0] px-2 pt-5 lg:block"><div className="rounded-xl bg-[#f2f0ff] p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-[#5749d7]"><Sparkles className="size-4" /> Smart timing</div><p className="text-sm leading-5 text-[#666f89]">Every assignment starts at least 2 days early. Harder work gets a longer runway.</p></div></div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="mb-1 text-sm font-semibold text-[#6b5cff]">{dateLabel(today)}</p><h1 className="font-display text-[clamp(1.9rem,4vw,3.2rem)] font-bold leading-none tracking-[-.045em]">Your week, mapped out.</h1></div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-[#dfe3ed] bg-white p-1 shadow-sm sm:self-auto"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} className="nav-button"><ChevronLeft /></button><button onClick={() => setWeekOffset(0)} className="px-2 text-sm font-bold">{weekOffset === 0 ? "This week" : dateLabel(weekDays[0])}</button><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} className="nav-button"><ChevronRight /></button></div>
          </div>

          {weekOffset === 0 && nextTask && <div className="mb-5 grid gap-4 overflow-hidden rounded-2xl bg-[#1b2a5b] p-5 text-white shadow-[0_16px_45px_rgba(27,42,91,.2)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"><div className="relative z-10"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#b9c4ef]"><Clock3 className="size-4" /> Best thing to work on now</p><h2 className="font-display text-2xl font-bold tracking-[-.02em]">{nextTask.title}</h2><p className="mt-1 text-sm text-[#c8d0eb]">{courses[nextTask.course].code} · {effort[nextTask.difficulty]} today keeps you comfortably ahead.</p></div><button onClick={() => toggleDone(nextTask.id)} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#1b2a5b] transition hover:bg-[#f0f2fb]">Mark complete <ArrowRight className="size-4" /></button></div>}

          <div className="calendar-shell"><div className="calendar-grid min-w-[820px]">
            {weekDays.map((day, index) => <div key={day.toISOString()} className={`day-column ${weekOffset === 0 && index === 0 ? "today" : ""}`}>
              <div className="day-heading"><span>{dayLabel(day)}</span><strong>{day.getDate()}</strong>{weekOffset === 0 && index === 0 && <small>Today</small>}</div>
              <div className="min-h-[430px] space-y-3 p-2.5">
                {scheduledByDay[index].map((item) => {
                  const courseInfo = courses[item.course]; const absoluteOffset = weekOffset * 7 + index; const isDue = absoluteOffset === item.dueOffset; const isStart = absoluteOffset === item.dueOffset - leadDays[item.difficulty];
                  return <article key={item.id} className={`assignment-card ${item.done ? "done" : ""}`} style={{ "--course": courseInfo.color, "--course-soft": courseInfo.soft } as React.CSSProperties}><div className="mb-2 flex items-center justify-between gap-1"><span className="course-code">{courseInfo.code}</span><Checkbox checked={item.done} onCheckedChange={() => toggleDone(item.id)} aria-label={`Mark ${item.title} complete`} className="border-[#c8cede] data-[state=checked]:border-[var(--course)] data-[state=checked]:bg-[var(--course)]" /></div><h3>{item.title}</h3><p>{isDue ? "Due today" : isStart ? "Start today" : "Work session"}</p><div className="mt-3 flex gap-1">{Array.from({ length: leadDays[item.difficulty] + 1 }, (_, step) => <span key={step} className="h-1 flex-1 rounded-full bg-[var(--course)]" style={{ opacity: step <= absoluteOffset - (item.dueOffset - leadDays[item.difficulty]) ? 1 : .18 }} />)}</div></article>;
                })}
                {scheduledByDay[index].length === 0 && <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[#dfe3ed] text-sm font-medium text-[#a0a7b7]">Open space</div>}
              </div>
            </div>)}
          </div></div>
          <p className="mt-3 text-center text-sm text-[#7e879f] lg:hidden">Swipe sideways to see the full week.</p>
        </section>
      </div>
    </main>
  );
}
