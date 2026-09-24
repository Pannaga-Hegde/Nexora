import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MessageSquare,
  CheckSquare,
  Sparkles,
  HeartPulse,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Award,
  FlaskConical,
  Zap,
  Layers,
  AlertTriangle,
  Ban,
  Clock,
  TrendingUp,
  Users,
  BarChart2,
  CalendarDays,
  FileText,
} from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import StickyMobileCTA from '../components/common/StickyMobileCTA';

/* ─── Shared style tokens ──────────────────────────────────────────────── */
const C = {
  bg:        '#050607',
  surface:   '#0A0B0C',
  elevated:  '#101213',
  border:    '#1B1D1E',
  borderMid: '#27292A',
  textPri:   '#F2F2F0',
  textSec:   '#A3A5A6',
  textMut:   '#6F7274',
  textDim:   '#4F5253',
  indigoLt:  '#818cf8',
};

const ACADEMIC_TYPES = [
  {
    id: 'capstone',
    label: 'Final Year Capstone',
    icon: GraduationCap,
    color: 'text-indigo-400',
    bg:    'bg-indigo-500/10 border-indigo-500/30',
    desc:  'End-to-end lifecycle for major research or engineering deliverables. Milestones, presentations, and documentation all connected.',
  },
  {
    id: 'hackathon',
    label: 'Hackathon Sprint',
    icon: Award,
    color: 'text-amber-400',
    bg:    'bg-amber-500/10 border-amber-500/30',
    desc:  'Fast-paced collaboration with shared task boards, real-time discussion, and instant health signals under time pressure.',
  },
  {
    id: 'research',
    label: 'Research Project',
    icon: FlaskConical,
    color: 'text-purple-400',
    bg:    'bg-purple-500/10 border-purple-500/30',
    desc:  'Structured phases for literature review, experiment tracking, data milestones, and documentation review cycles.',
  },
  {
    id: 'software',
    label: 'Software Engineering',
    icon: Zap,
    color: 'text-emerald-400',
    bg:    'bg-emerald-500/10 border-emerald-500/30',
    desc:  'Sprint-based execution with Kanban boards, blockers, code review links, and contribution visibility for each member.',
  },
  {
    id: 'mini',
    label: 'Mini Project',
    icon: Layers,
    color: 'text-sky-400',
    bg:    'bg-sky-500/10 border-sky-500/30',
    desc:  'Scoped short-term work with focused task lists, team assignments, and milestone check-ins for semester coursework.',
  },
];

const HEALTH_STATES = [
  { label: 'On Track', dot: 'bg-emerald-500', text: 'text-emerald-400', desc: 'All tasks progressing on schedule with no blockers detected.' },
  { label: 'At Risk',  dot: 'bg-amber-500',   text: 'text-amber-400',   desc: 'One or more tasks approaching deadline with unresolved dependencies.' },
  { label: 'Overdue',  dot: 'bg-orange-500',  text: 'text-orange-400',  desc: 'Tasks have missed their target dates and require immediate attention.' },
  { label: 'Blocked',  dot: 'bg-rose-500',    text: 'text-rose-400',    desc: 'Prerequisite tasks are incomplete; execution cannot continue.' },
  { label: 'Stalled',  dot: 'bg-zinc-500',    text: 'text-zinc-400',    desc: 'No activity or progress recorded for an extended period.' },
];

const HOW_IT_WORKS = [
  { n: '01', title: 'Create a project',   body: 'Choose an academic template or build a custom workspace. Define milestones and phases from day one.' },
  { n: '02', title: 'Build the team',     body: 'Invite collaborators by email. Each member sees their role, tasks, and contribution metrics.' },
  { n: '03', title: 'Organise the work',  body: 'Structure tasks across Kanban columns, assign owners, set deadlines, and link to milestones.' },
  { n: '04', title: 'Discuss in context', body: 'Chat lives inside the project. Every conversation stays permanently attached to its source work.' },
  { n: '05', title: 'Track progress',     body: 'Project Health surfaces signals in real time. See what is on track, at risk, blocked, or stalled.' },
  { n: '06', title: 'Finish the project', body: 'Export contribution reports, archive milestones, and carry the full project history forward.' },
];

export default function LandingPage() {
  const [activeAcademicType, setActiveAcademicType] = useState<string>('capstone');
  const activeAcademic = ACADEMIC_TYPES.find((t) => t.id === activeAcademicType) ?? ACADEMIC_TYPES[0];
  const AcademicIcon = activeAcademic.icon;

  // Refs for smooth scroll parallax on landscape image layers
  const highMountainBgRef = useRef<HTMLImageElement>(null);
  const slopeBgRef = useRef<HTMLImageElement>(null);
  const deepForestBgRef = useRef<HTMLImageElement>(null);
  const lowerForestBgRef = useRef<HTMLImageElement>(null);
  const valleyBgRef = useRef<HTMLImageElement>(null);
  const lakeBgRef = useRef<HTMLImageElement>(null);

  // Native scroll-linked parallax effect (respects prefers-reduced-motion, no scroll hijacking)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animationFrameId: number;

    const handleScroll = () => {
      animationFrameId = requestAnimationFrame(() => {
        const viewportHeight = window.innerHeight;

        const updateParallax = (ref: React.RefObject<HTMLImageElement | null>, factor = 0.08) => {
          if (!ref.current) return;
          const rect = ref.current.getBoundingClientRect();
          // Check if element is around the viewport
          if (rect.bottom >= -100 && rect.top <= viewportHeight + 100) {
            const centerY = rect.top + rect.height / 2;
            const offset = (centerY - viewportHeight / 2) * factor;
            ref.current.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.08)`;
          }
        };

        updateParallax(highMountainBgRef, 0.07);
        updateParallax(slopeBgRef, 0.08);
        updateParallax(deepForestBgRef, 0.09);
        updateParallax(lowerForestBgRef, 0.06);
        updateParallax(valleyBgRef, 0.08);
        updateParallax(lakeBgRef, 0.07);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden font-sans selection:bg-indigo-950 selection:text-white"
      style={{ backgroundColor: C.bg, color: C.textPri }}
    >
      <SEOHead
        title="Nexora — Connected Project Work"
        description="Nexora connects your team's conversations, tasks, milestones, files, and project activity in one workspace—so decisions stay attached to the work they create."
      />

      {/* NAVBAR */}
      <PublicNavbar />

      <main className="flex-1 pb-16 md:pb-0">

        {/* ════════════════════════════════════════════════
            1. EXISTING HERO — SUMMIT (Highest Point of Journey)
            [Protected: Kept exactly as existing]
        ════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
          {/* Background landscape */}
          <div className="absolute inset-0 z-0">
            <img
              src="/image/nexora-cinematic-hero.jpg"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover object-center"
              loading="eager"
            />
            {/* Multi-layer gradient for legibility */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,0.60) 0%,
                  rgba(5,6,7,0.12) 30%,
                  rgba(5,6,7,0.18) 55%,
                  rgba(5,6,7,0.78) 78%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,6,7,0.55) 100%)' }}
            />
          </div>

          {/* Hero content */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-24 md:pb-36 pt-44 md:pt-0">
            {/* Eyebrow badge */}
            <div
              className="mb-7 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest backdrop-blur-sm"
              style={{
                borderColor: 'rgba(99,102,241,0.3)',
                backgroundColor: 'rgba(99,102,241,0.09)',
                color: C.indigoLt,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Nexora — Workspace OS
            </div>

            {/* Main headline */}
            <h1
              className="max-w-4xl text-5xl sm:text-7xl md:text-8xl font-light tracking-tight leading-[1.03]"
              style={{ color: C.textPri, textShadow: '0 2px 40px rgba(0,0,0,0.5)' }}
            >
              Where projects
              <br />
              <span className="font-normal text-white">move forward.</span>
            </h1>

            {/* Supporting copy */}
            <p
              className="mt-7 max-w-xl text-base sm:text-lg leading-relaxed font-light"
              style={{ color: 'rgba(163,165,166,0.92)', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}
            >
              Connect conversations, tasks, milestones, and project health
              in one unified workspace — so every decision stays attached
              to the work it creates.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to="/register"
                id="hero-get-started"
                className="inline-flex items-center justify-center gap-2 rounded-md px-7 py-3.5 text-sm font-semibold tracking-wide transition-all active:scale-95 hover:bg-white"
                style={{ backgroundColor: C.textPri, color: C.bg }}
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                id="hero-how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-7 py-3.5 text-sm font-medium tracking-wide backdrop-blur-sm transition-colors hover:text-[#F2F2F0]"
                style={{
                  borderColor: 'rgba(242,242,240,0.2)',
                  backgroundColor: 'rgba(5,6,7,0.38)',
                  color: C.textSec,
                }}
              >
                See How It Works
              </a>
            </div>

            {/* Value markers */}
            <div
              className="mt-12 pt-8 border-t flex flex-wrap items-center gap-y-2 gap-x-7 text-xs font-mono"
              style={{ borderColor: 'rgba(27,29,30,0.8)', color: C.textMut }}
            >
              {['Task ↔ Conversation Sync', 'Deterministic Risk Signals', 'Academic Milestone Ready'].map((v) => (
                <span key={v} className="flex items-center gap-2">
                  <span className="h-px w-4 bg-current opacity-50" />
                  {v}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            2. HIGH MOUNTAINS — Jagged Mountain Range
            Descent Stage: Leaving Summit → High Rocky Terrain
            Role: 01 Problem & Foundation / "See the work taking shape."
        ════════════════════════════════════════════════ */}
        <section id="problem" className="relative py-28 md:py-36 overflow-hidden">
          {/* Background image layer with subtle parallax & filmic desaturation */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={highMountainBgRef}
              src="/image/descent-1-high-mountain.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.82) brightness(0.78) contrast(1.08)' }}
              loading="lazy"
            />
            {/* Continuous seamless vertical dissolve gradients */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.72) 15%,
                  rgba(5,6,7,0.48) 35%,
                  rgba(5,6,7,0.52) 65%,
                  rgba(5,6,7,0.85) 88%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(15,23,42,0.15) 0%, rgba(5,6,7,0.75) 100%)' }}
            />
          </div>

          {/* High Mountain Content */}
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-20">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block h-px w-6 bg-indigo-500/60" />
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                  High Mountains · Elevation 01
                </span>
              </div>
              <h2
                className="text-4xl sm:text-6xl font-light tracking-tight leading-tight"
                style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
              >
                See the work<br />
                <span className="font-normal text-white">taking shape.</span>
              </h2>
              <p
                className="mt-5 text-base leading-relaxed max-w-2xl"
                style={{ color: 'rgba(210,212,214,0.92)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
              >
                When discussions are disconnected from task management, teams waste hours searching
                for context. Nexora keeps projects, tasks, milestones, and ownership permanently connected.
              </p>
            </div>

            <div
              className="divide-y rounded-2xl border backdrop-blur-md p-2 sm:p-6"
              style={{
                borderColor: 'rgba(255,255,255,0.07)',
                backgroundColor: 'rgba(7,9,10,0.65)',
              }}
            >
              {[
                { n: '01', title: 'Disconnected conversations', body: 'Decisions agreed in chat channels are never translated into structured tasks. Action items remain unassigned and forgotten.' },
                { n: '02', title: 'Lost decisions',             body: 'API specs, constraints, and file links sink beneath daily messages. New members restart from zero every time they join.' },
                { n: '03', title: 'Unclear progress',           body: 'Project health becomes guesswork. Leads discover blockers only after a critical deadline has already passed.' },
              ].map((row) => (
                <div
                  key={row.n}
                  className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-start px-4"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="md:col-span-2 text-xs font-mono" style={{ color: C.indigoLt }}>{row.n} / 03</div>
                  <div className="md:col-span-4">
                    <h3 className="text-lg font-medium" style={{ color: C.textPri }}>{row.title}</h3>
                  </div>
                  <div className="md:col-span-6">
                    <p className="text-sm leading-relaxed" style={{ color: C.textSec }}>{row.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-12 rounded-xl border p-8 md:p-10 backdrop-blur-md"
              style={{
                borderColor: 'rgba(99,102,241,0.3)',
                backgroundColor: 'rgba(10,14,26,0.68)',
              }}
            >
              <span className="block mb-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                The Nexora Approach
              </span>
              <h3 className="text-xl sm:text-2xl font-medium" style={{ color: C.textPri }}>
                Every task remembers where it originated.
              </h3>
              <p className="mt-3 text-sm leading-relaxed max-w-2xl" style={{ color: 'rgba(180,184,188,0.92)' }}>
                Discussions connect directly to verifiable execution. Decisions and context stay permanently
                attached to the deliverables they create — not buried in a scrolling feed.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            3. MOUNTAIN SLOPE — Forested Mountain Slope in Mist
            Descent Stage: Upper / Mid Mountain
            Role: 02 Connected Work / "Context stays with the work."
        ════════════════════════════════════════════════ */}
        <section
          id="connection"
          className="relative py-28 md:py-36 overflow-hidden"
        >
          {/* Background image layer with subtle parallax & misty atmosphere */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={slopeBgRef}
              src="/image/descent-2-mountain-slope.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.80) brightness(0.76) contrast(1.05)' }}
              loading="lazy"
            />
            {/* Multi-layer dissolver gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.70) 12%,
                  rgba(5,6,7,0.42) 30%,
                  rgba(5,6,7,0.46) 65%,
                  rgba(5,6,7,0.80) 86%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(15,23,42,0.18) 0%, rgba(5,6,7,0.72) 100%)' }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-20">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block h-px w-6 bg-indigo-500/60" />
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                  Mountain Slope · Elevation 02
                </span>
              </div>
              <h2
                className="text-4xl sm:text-6xl font-light tracking-tight leading-tight"
                style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
              >
                Context stays<br />
                <span className="font-normal text-white">with the work.</span>
              </h2>
              <p
                className="mt-5 text-base leading-relaxed max-w-2xl"
                style={{ color: 'rgba(210,212,214,0.92)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
              >
                Move from team discussion to structured deliverables without losing the
                original rationale, constraints, or decisions.
              </p>
            </div>

            {/* Conversation ↔ Task mockup panel with glassmorphism */}
            <div
              className="rounded-2xl border overflow-hidden backdrop-blur-md shadow-2xl"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(6,8,10,0.75)',
              }}
            >
              {/* Panel header bar */}
              <div
                className="flex items-center justify-between border-b px-6 py-4 text-xs font-mono"
                style={{
                  borderColor: 'rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(15,18,20,0.85)',
                  color: C.textMut,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: C.borderMid }} />
                    ))}
                  </div>
                  <span style={{ color: C.textSec }}>Nexora Workspace · Distributed Cloud Core</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <HeartPulse className="h-3.5 w-3.5" />
                  <span>Health: On Track</span>
                </div>
              </div>

              {/* Two-panel split */}
              <div
                className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                {/* Left: Conversation */}
                <div className="p-6 sm:p-8 flex flex-col gap-5">
                  <div className="flex items-center gap-2 text-xs font-mono" style={{ color: C.textSec }}>
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                    <span>#api-architecture</span>
                    <span className="ml-auto" style={{ color: C.textMut }}>3 active</span>
                  </div>

                  <div className="space-y-3">
                    <div
                      className="rounded-lg border p-4 backdrop-blur-sm"
                      style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(16,18,20,0.80)' }}
                    >
                      <div className="flex items-center justify-between mb-2 text-[11px]">
                        <span className="font-medium" style={{ color: C.textPri }}>Marcus V.</span>
                        <span className="font-mono" style={{ color: C.textMut }}>10:14 AM</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: C.textSec }}>
                        &quot;Can someone update the auth API before Friday? We need JWT rotation tested before the demo.&quot;
                      </p>
                    </div>

                    <div
                      className="rounded-lg border p-4 backdrop-blur-sm"
                      style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(16,18,20,0.80)' }}
                    >
                      <div className="flex items-center justify-between mb-2 text-[11px]">
                        <span className="font-medium" style={{ color: C.textPri }}>Priya S.</span>
                        <span className="font-mono" style={{ color: C.textMut }}>10:22 AM</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: C.textSec }}>
                        &quot;On it — creating the task now. Linking back to this thread so context is preserved.&quot;
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-2 rounded-lg border px-3.5 py-2.5 backdrop-blur-sm"
                      style={{ borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.12)' }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="text-xs font-mono" style={{ color: C.indigoLt }}>⚡ Actionable item identified — Convert to Task</span>
                    </div>
                  </div>
                </div>

                {/* Right: Task record */}
                <div className="p-6 sm:p-8 flex flex-col gap-5">
                  <div className="flex items-center gap-2 text-xs font-mono" style={{ color: C.textSec }}>
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Task #T-104</span>
                    <span
                      className="ml-auto rounded border px-2 py-0.5 text-[10px]"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(16,18,20,0.8)', color: C.textSec }}
                    >
                      In Progress
                    </span>
                  </div>

                  <div
                    className="rounded-lg border p-5 space-y-4 backdrop-blur-sm"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(16,18,20,0.80)' }}
                  >
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: C.textPri }}>
                        Update Authentication API &amp; Token Rotation
                      </h4>
                      <p className="text-[11px] font-mono" style={{ color: C.textMut }}>
                        Source: #api-architecture (Preserved)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {[
                        { label: 'Assignee', value: 'Priya S.' },
                        { label: 'Deadline', value: 'Friday, 5:00 PM' },
                        { label: 'Priority',  value: 'HIGH' },
                        { label: 'Status',   value: 'In Progress' },
                      ].map((f) => (
                        <div
                          key={f.label}
                          className="rounded border p-2.5"
                          style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(6,8,10,0.7)' }}
                        >
                          <span className="block text-[10px] font-mono uppercase mb-0.5" style={{ color: C.textMut }}>{f.label}</span>
                          <span className="font-medium" style={{ color: C.textPri }}>{f.value}</span>
                        </div>
                      ))}
                    </div>

                    <div
                      className="flex items-center gap-2 text-[11px] text-emerald-400 pt-1 border-t"
                      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Bidirectional context permanently attached</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            4. DEEP FOREST — Dark Pine Trees in Fog (Longest Portion)
            Descent Stage: Inside the Deep Dense Pine Canopy
            Role: 03 Features + 04 Academic Projects / "Keep every conversation connected."
        ════════════════════════════════════════════════ */}
        <section
          id="features"
          className="relative py-32 md:py-44 overflow-hidden"
        >
          {/* Background image layer with subtle parallax & deep pine mist */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={deepForestBgRef}
              src="/image/descent-3-deep-forest.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.78) brightness(0.75) contrast(1.08)' }}
              loading="lazy"
            />
            {/* Continuous seamless vertical dissolve gradients */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.75) 8%,
                  rgba(5,6,7,0.45) 22%,
                  rgba(5,6,7,0.42) 50%,
                  rgba(5,6,7,0.48) 78%,
                  rgba(5,6,7,0.85) 92%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(15,23,42,0.18) 0%, rgba(5,6,7,0.78) 100%)' }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-32">
            {/* Part A: Features Overview */}
            <div>
              <div className="max-w-3xl mb-16">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-block h-px w-6 bg-indigo-500/60" />
                  <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                    Deep Forest · Elevation 03
                  </span>
                </div>
                <h2
                  className="text-4xl sm:text-6xl font-light tracking-tight leading-tight"
                  style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
                >
                  Keep every conversation<br />
                  <span className="font-normal text-white">connected.</span>
                </h2>
                <p
                  className="mt-5 text-base leading-relaxed max-w-2xl"
                  style={{ color: 'rgba(210,212,214,0.92)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
                >
                  Decisions and discussions stay attached to the work they affect.
                  One unified system for your team’s chats, tasks, milestones, and signals.
                </p>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {[
                  { icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10', title: 'Project Chat',         body: 'Conversations scoped to your project. Messages are permanently linked to tasks, files, and milestones.' },
                  { icon: CheckSquare,   color: 'text-sky-400',    bg: 'bg-sky-500/10',    title: 'Kanban Tasks',         body: 'Drag-and-drop task boards with priority, assignee, due date, and risk signal on every card.' },
                  { icon: HeartPulse,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Project Health',      body: 'Deterministic signals surface On Track, At Risk, Blocked, Overdue, and Stalled states in real time.' },
                  { icon: BarChart2,    color: 'text-purple-400',  bg: 'bg-purple-500/10',  title: 'Contribution Tracking', body: 'Transparent activity across tasks, discussions, milestones, and files — not leaderboards.' },
                  { icon: CalendarDays, color: 'text-amber-400',   bg: 'bg-amber-500/10',  title: 'Scheduling',           body: 'Coordinate availability across the team. Find shared windows and manage shared deadlines.' },
                  { icon: ShieldCheck,  color: 'text-rose-400',    bg: 'bg-rose-500/10',   title: 'Risk Intelligence',    body: 'Blocked dependencies, overdue prerequisites, and stalled tasks surface automatically.' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="p-7 rounded-xl border backdrop-blur-md transition-all duration-300 cursor-default hover:border-white/20"
                      style={{
                        borderColor: 'rgba(255,255,255,0.07)',
                        backgroundColor: 'rgba(7,9,11,0.65)',
                      }}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-4 ${f.bg}`}>
                        <Icon className={`h-5 w-5 ${f.color}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold mb-1.5" style={{ color: C.textPri }}>{f.title}</h3>
                        <p className="text-xs leading-relaxed" style={{ color: C.textSec }}>{f.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Part B: Academic Projects Templates (in Deep Forest) */}
            <div id="academic" className="pt-8">
              <div className="max-w-3xl mb-12">
                <span className="block mb-3 text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                  Academic Workspaces
                </span>
                <h3
                  className="text-3xl sm:text-5xl font-light tracking-tight leading-tight"
                  style={{ color: C.textPri, textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}
                >
                  From college idea<br />
                  <span className="font-normal text-white">to completed deliverable.</span>
                </h3>
                <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: 'rgba(190,192,194,0.92)' }}>
                  Nexora is built for academic project teams. Choose a template matched to your project type
                  and get a structured workspace from day one.
                </p>
              </div>

              {/* Type tabs */}
              <div className="flex flex-wrap gap-2 mb-8">
                {ACADEMIC_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isActive = t.id === activeAcademicType;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveAcademicType(t.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-sm transition-all ${isActive ? `${t.bg} ${t.color}` : ''}`}
                      style={isActive ? {} : { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(10,12,14,0.7)', color: C.textSec }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Active type panel */}
              <div
                className="rounded-2xl border p-8 md:p-10 backdrop-blur-md shadow-2xl"
                style={{ borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(7,9,12,0.75)' }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                  <div>
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl mb-5 border ${activeAcademic.bg}`}>
                      <AcademicIcon className={`h-6 w-6 ${activeAcademic.color}`} />
                    </div>
                    <h4 className="text-2xl font-semibold mb-3" style={{ color: C.textPri }}>{activeAcademic.label}</h4>
                    <p className="text-sm leading-relaxed mb-6" style={{ color: C.textSec }}>{activeAcademic.desc}</p>

                    <div className="flex flex-wrap gap-2">
                      {['Idea', 'Team', 'Tasks', 'Execution', 'Documentation', 'Completion'].map((step, i) => (
                        <span key={step} className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span
                            className="rounded border px-2.5 py-1"
                            style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(15,18,22,0.8)', color: C.textSec }}
                          >
                            {step}
                          </span>
                          {i < 5 && <span style={{ color: C.textMut }}>→</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Milestone checklist */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-mono uppercase tracking-wider mb-4" style={{ color: C.textMut }}>
                      Academic Milestones
                    </div>
                    {[
                      { label: 'Project proposal submitted',    done: true },
                      { label: 'Literature review complete',    done: true },
                      { label: 'Prototype v1 functional',       done: true },
                      { label: 'Midterm evaluation passed',     done: false },
                      { label: 'Final documentation submitted', done: false },
                      { label: 'Viva / Presentation complete',  done: false },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3 text-xs"
                        style={{
                          borderColor: m.done ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
                          backgroundColor: m.done ? 'rgba(16,185,129,0.08)' : 'rgba(12,14,16,0.6)',
                          color: m.done ? '#10b981' : C.textSec,
                        }}
                      >
                        <CheckCircle2
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: m.done ? '#10b981' : C.textDim }}
                        />
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            5. LOWER FOREST / TRANSITION — Forest into Heavy White Fog
            Descent Stage: Lower Forest Canopy transitioning to Valley
            Role: Atmospheric Transition / Milestone Momentum
        ════════════════════════════════════════════════ */}
        <section
          className="relative py-24 md:py-32 overflow-hidden"
        >
          {/* Background image layer with subtle parallax & foggy atmosphere */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={lowerForestBgRef}
              src="/image/descent-4-lower-forest.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.82) brightness(0.80) contrast(1.04)' }}
              loading="lazy"
            />
            {/* Seamless dissolve gradients connecting dense forest to valley */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.68) 15%,
                  rgba(5,6,7,0.38) 40%,
                  rgba(5,6,7,0.42) 60%,
                  rgba(5,6,7,0.75) 85%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, rgba(5,6,7,0.7) 100%)' }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                Lower Forest · Elevation 04
              </span>
            </div>
            <h2
              className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight leading-tight mb-6"
              style={{ color: C.textPri, textShadow: '0 2px 30px rgba(0,0,0,0.8)' }}
            >
              The mist clears into clarity.
            </h2>
            <p
              className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-light"
              style={{ color: 'rgba(215,218,220,0.92)', textShadow: '0 1px 12px rgba(0,0,0,0.7)' }}
            >
              Every discussion logged, every deliverable tracked, and every blocker visible.
              As the terrain opens into the valley below, your project trajectory becomes undeniable.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            6. DEEP VALLEY — Valley with Water Visible through Fog
            Descent Stage: Approaching the Valley Basin
            Role: 05 Project Health / "Know where the project stands."
        ════════════════════════════════════════════════ */}
        <section
          id="health"
          className="relative py-28 md:py-36 overflow-hidden"
        >
          {/* Background image layer with subtle parallax */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={valleyBgRef}
              src="/image/descent-5-valley.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.82) brightness(0.78) contrast(1.06)' }}
              loading="lazy"
            />
            {/* Seamless dissolve gradients connecting lower forest to valley floor */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.70) 12%,
                  rgba(5,6,7,0.44) 30%,
                  rgba(5,6,7,0.48) 65%,
                  rgba(5,6,7,0.82) 86%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(15,23,42,0.18) 0%, rgba(5,6,7,0.75) 100%)' }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-20">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block h-px w-6 bg-indigo-500/60" />
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                  Deep Valley · Elevation 05
                </span>
              </div>
              <h2
                className="text-4xl sm:text-6xl font-light tracking-tight leading-tight"
                style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
              >
                Know where the<br />
                <span className="font-normal text-white">project stands.</span>
              </h2>
              <p
                className="mt-5 text-base leading-relaxed max-w-2xl"
                style={{ color: 'rgba(210,212,214,0.92)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
              >
                Progress, risks, milestones and project health become visible. Project Health surfaces deterministic
                signals based on actual task state — not estimates or manual reports.
              </p>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
            >
              {HEALTH_STATES.map((h, i) => {
                const icons = [CheckCircle2, AlertTriangle, Clock, Ban, TrendingUp];
                const Icon = icons[i] ?? CheckCircle2;
                return (
                  <div
                    key={h.label}
                    className="p-6 rounded-xl border backdrop-blur-md flex flex-col gap-4 transition-all duration-300 cursor-default hover:border-white/20"
                    style={{
                      borderColor: 'rgba(255,255,255,0.07)',
                      backgroundColor: 'rgba(7,9,11,0.68)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${h.dot}`} />
                      <span className={`text-xs font-semibold font-mono uppercase tracking-wider ${h.text}`}>{h.label}</span>
                    </div>
                    <p className="text-xs leading-relaxed flex-1" style={{ color: C.textSec }}>{h.desc}</p>
                    <Icon className={`h-4 w-4 ${h.text} opacity-30`} />
                  </div>
                );
              })}
            </div>

            <div
              className="mt-8 rounded-xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 backdrop-blur-md"
              style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(10,13,18,0.75)' }}
            >
              <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
              <p className="text-sm leading-relaxed" style={{ color: C.textSec }}>
                <span style={{ color: C.textPri }}>Every health signal is explainable.</span>{' '}
                Nexora never assigns a black-box score. Each status is derived from verifiable
                task conditions your team can inspect and act on directly.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            7. VALLEY FLOOR — Dark Still Lake in Forest & Mist
            Descent Stage: Lowest Point of Journey (Calm, Still, Complete)
            Role: 06 Contribution + 07 How It Works / "Everything, finally in view."
        ════════════════════════════════════════════════ */}
        <section
          id="contribution"
          className="relative py-32 md:py-44 overflow-hidden"
        >
          {/* Background image layer with subtle parallax & still lake serenity */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <img
              ref={lakeBgRef}
              src="/image/descent-6-lake.png"
              alt=""
              aria-hidden="true"
              className="w-full h-[120%] -top-[10%] absolute object-cover object-center will-change-transform"
              style={{ filter: 'saturate(0.82) brightness(0.80) contrast(1.04)' }}
              loading="lazy"
            />
            {/* Seamless dissolve gradients connecting valley to existing pre-footer */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,1.00) 0%,
                  rgba(5,6,7,0.72) 8%,
                  rgba(5,6,7,0.45) 20%,
                  rgba(5,6,7,0.40) 50%,
                  rgba(5,6,7,0.50) 80%,
                  rgba(5,6,7,0.85) 92%,
                  rgba(5,6,7,1.00) 100%
                )`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(15,23,42,0.18) 0%, rgba(5,6,7,0.75) 100%)' }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-32">
            {/* Part A: Contribution & Accountability */}
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block h-px w-6 bg-indigo-500/60" />
                    <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                      Valley Floor · Elevation 06
                    </span>
                  </div>
                  <h2
                    className="text-4xl sm:text-5xl font-light tracking-tight leading-tight mb-5"
                    style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
                  >
                    Everything, finally<br />
                    <span className="font-normal text-white">in view.</span>
                  </h2>
                  <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(210,212,214,0.92)' }}>
                    Contribution tracking shows actual activity — tasks completed, discussions
                    contributed to, milestones reached, and files shared. No arbitrary scores.
                    No competitive pressure.
                  </p>
                  <div className="space-y-3.5">
                    {[
                      { icon: CheckSquare,   label: 'Tasks completed',          sub: 'Every task closed is recorded against its owner.' },
                      { icon: MessageSquare, label: 'Discussions contributed',  sub: 'Messages in project channels are linked to deliverables.' },
                      { icon: FileText,      label: 'Milestones reached',       sub: 'Academic milestone completions tracked per member.' },
                      { icon: Users,         label: 'Team accountability',      sub: 'Each team member sees their own activity clearly.' },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-start gap-3 p-3 rounded-lg border backdrop-blur-sm"
                          style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(10,13,16,0.6)' }}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5"
                            style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
                          >
                            <Icon className="h-3.5 w-3.5 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold mb-0.5" style={{ color: C.textPri }}>{item.label}</p>
                            <p className="text-xs" style={{ color: C.textMut }}>{item.sub}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Contribution visual mockup with glassmorphism */}
                <div
                  className="rounded-2xl border overflow-hidden backdrop-blur-md shadow-2xl"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(8,10,13,0.75)' }}
                >
                  <div
                    className="border-b px-5 py-3.5 text-xs font-mono flex items-center justify-between"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', color: C.textMut }}
                  >
                    <span>Contribution Report</span>
                    <span style={{ color: C.indigoLt }}>Current Sprint</span>
                  </div>
                  <div className="p-5 space-y-4">
                    {[
                      { name: 'Priya S.',   tasks: 8, disc: 14, color: 'bg-indigo-500', w: '82%' },
                      { name: 'Marcus V.',  tasks: 6, disc: 9,  color: 'bg-sky-500',    w: '65%' },
                      { name: 'Ananya K.', tasks: 5, disc: 11, color: 'bg-purple-500',  w: '58%' },
                      { name: 'Dev P.',    tasks: 7, disc: 6,  color: 'bg-emerald-500', w: '70%' },
                    ].map((m) => (
                      <div key={m.name}>
                        <div className="flex items-center justify-between text-xs mb-2" style={{ color: C.textSec }}>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: 'rgba(99,102,241,0.35)' }}
                            >
                              {m.name[0]}
                            </div>
                            <span className="font-medium" style={{ color: C.textPri }}>{m.name}</span>
                          </div>
                          <span className="font-mono text-[11px]" style={{ color: C.textMut }}>
                            {m.tasks} tasks · {m.disc} msgs
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <div className={`h-full rounded-full ${m.color}`} style={{ width: m.w }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className="border-t px-5 py-3 text-[11px] font-mono"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', color: C.textMut }}
                  >
                    Activity-based — no arbitrary scoring
                  </div>
                </div>
              </div>
            </div>

            {/* Part B: How It Works */}
            <div id="how-it-works" className="pt-8">
              <div className="max-w-3xl mb-16">
                <span className="block mb-4 text-[11px] font-mono uppercase tracking-widest" style={{ color: C.indigoLt }}>
                  07 — How It Works
                </span>
                <h2
                  className="text-4xl sm:text-6xl font-light tracking-tight leading-tight"
                  style={{ color: C.textPri, textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}
                >
                  Six steps.<br />
                  <span className="font-normal text-white">One workspace.</span>
                </h2>
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {HOW_IT_WORKS.map((step) => (
                  <div
                    key={step.n}
                    className="p-8 rounded-xl border backdrop-blur-md flex flex-col gap-3 transition-all duration-300 cursor-default hover:border-white/20"
                    style={{
                      borderColor: 'rgba(255,255,255,0.07)',
                      backgroundColor: 'rgba(7,9,12,0.68)',
                    }}
                  >
                    <span
                      className="text-4xl sm:text-5xl font-light font-mono leading-none"
                      style={{ color: 'rgba(255,255,255,0.18)' }}
                    >
                      {step.n}
                    </span>
                    <h3 className="text-sm font-semibold" style={{ color: C.textPri }}>{step.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: C.textSec }}>{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            8. EXISTING PRE-FOOTER LANDSCAPE SECTION
            [Protected: Kept exactly as existing - do not modify or replace]
        ════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-t" style={{ borderColor: C.border, minHeight: '70vh' }}>
          <div className="absolute inset-0 z-0">
            <img
              src="/image/nexora-cinematic-hero.jpg"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom,
                  rgba(5,6,7,0.88) 0%,
                  rgba(5,6,7,0.70) 40%,
                  rgba(5,6,7,0.90) 100%
                )`,
              }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-center min-h-[70vh]">
            <div className="text-center mx-auto max-w-4xl px-4 py-28 sm:py-40">
              <span className="block mb-6 text-[11px] font-mono uppercase tracking-widest" style={{ color: C.textMut }}>
                Ready to begin
              </span>
              <h2
                className="text-5xl sm:text-7xl md:text-8xl font-light tracking-tight leading-[1.04] mb-8"
                style={{ color: C.textPri, textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}
              >
                Your next project
                <br />
                <span className="font-normal text-white">starts here.</span>
              </h2>
              <p
                className="text-base sm:text-lg leading-relaxed mb-12 max-w-xl mx-auto"
                style={{ color: C.textSec }}
              >
                Nexora is free to start. Create a project, invite your team,
                and connect your work from day one.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  id="cta-get-started"
                  className="inline-flex items-center gap-2 rounded-md px-8 py-4 text-sm font-semibold tracking-wide transition-all active:scale-95 hover:bg-white"
                  style={{ backgroundColor: C.textPri, color: C.bg }}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  id="cta-sign-in"
                  className="inline-flex items-center gap-2 rounded-md border px-8 py-4 text-sm font-medium tracking-wide transition-colors backdrop-blur-sm hover:text-[#F2F2F0]"
                  style={{
                    borderColor: 'rgba(242,242,240,0.22)',
                    backgroundColor: 'rgba(5,6,7,0.42)',
                    color: C.textSec,
                  }}
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ════════════════════════════════════════════════
          9. EXISTING FOOTER
          [Protected: Kept exactly as existing]
      ════════════════════════════════════════════════ */}
      <PublicFooter />

      {/* Mobile sticky CTA */}
      <StickyMobileCTA />
    </div>
  );
}
