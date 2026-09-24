import { Link } from 'react-router-dom';
import {
  ArrowRight,
  GraduationCap,
  HeartPulse,
  Award,
} from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PublicNavbar from '../components/layout/PublicNavbar';
import PublicFooter from '../components/layout/PublicFooter';
import StickyMobileCTA from '../components/common/StickyMobileCTA';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white pb-16 md:pb-0">
      <SEOHead
        title="Features — Projects, Tasks & Collaboration"
        description="Explore the full capabilities of Nexora: Academic templates, deterministic task risk detection, smart timetable sync, and verifiable contribution records."
      />

      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24 text-center border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
              Engineered for Modern Project Collaboration
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              Built to solve the real problems student teams and software engineers face — from project tracking to college grade evaluations.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 transition-all"
              >
                <span>Try Nexora Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Feature 1: Academic Project Mode */}
        <section id="academic" className="py-20 border-b border-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-400 mb-4">
                  <GraduationCap className="h-4 w-4" />
                  <span>Academic Project Mode</span>
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Pre-configured templates for college capstones & hackathons
                </h2>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-400">
                  Never start with a blank board. Choose from Final Year Capstone, Mini Project, Research Project, or 48-hour Hackathon templates with pre-populated milestones and task checklists.
                </p>
                <ul className="mt-6 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ Automated milestone timelines</li>
                  <li className="flex items-center gap-2">✓ Sprint deliverable checkpoints</li>
                  <li className="flex items-center gap-2">✓ Built-in team role delegation</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
                <div className="space-y-3">
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-xs">
                    <p className="font-bold text-indigo-300">🎓 Final Year Capstone Template</p>
                    <p className="text-slate-400 mt-1">Literature Review → System Design → Implementation → Final Defense</p>
                  </div>
                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/40 p-4 text-xs">
                    <p className="font-bold text-purple-300">⚡ 48-Hour Hackathon Sprint</p>
                    <p className="text-slate-400 mt-1">Idea Pitch → MVP Scaffold → Core Features → Demo Polish</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 2: Task Risk Detection */}
        <section id="risk-detection" className="py-20 border-b border-slate-900 bg-slate-900/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
                <div className="space-y-3">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-xs">
                    <span className="font-bold text-rose-400">🔴 BLOCKED — Database Schema Incomplete</span>
                    <p className="text-slate-400 mt-1">Prerequisite task 'Setup PostgreSQL' has not been completed.</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-xs">
                    <span className="font-bold text-amber-400">🟡 AT RISK — Deadline Approaching</span>
                    <p className="text-slate-400 mt-1">Due in 2 days with no recorded activity for 5 days.</p>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400 mb-4">
                  <HeartPulse className="h-4 w-4" />
                  <span>Deterministic Risk Engine</span>
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Know exactly why work is stalled before deadlines slip
                </h2>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-400">
                  No opaque scores or guesswork. Nexora evaluates observable project metrics to diagnose blocked prerequisites, upcoming deadlines, stalled tasks, and missing assignees.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 3: Verifiable Contributions */}
        <section className="py-20 border-b border-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-4">
                  <Award className="h-4 w-4" />
                  <span>Contribution Proofs</span>
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  Evidence-based records for college evaluations
                </h2>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-400">
                  Transparent breakdown of completed tasks, discussion reviews, milestone contributions, and event audit trails. Export formatted GradeSaver PDF reports directly to professors.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white">Team Activity Record</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">100% Verifiable</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-950 p-3">
                    <p className="text-slate-400">Tasks Completed</p>
                    <p className="text-base font-bold text-white mt-0.5">18</p>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-3">
                    <p className="text-slate-400">Milestones Hit</p>
                    <p className="text-base font-bold text-white mt-0.5">4</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      <StickyMobileCTA label="Start Free" />
    </div>
  );
}
