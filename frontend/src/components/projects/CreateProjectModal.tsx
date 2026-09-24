import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import {
  X,
  Sparkles,
  GraduationCap,
  Award,
  FlaskConical,
  Zap,
  FolderPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
  Layers,
  Check,
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import type { ProjectTemplatePhase } from '../../services/projectApi';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TEMPLATE_BADGES: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  final_year: { icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  mini_project: { icon: FolderPlus, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  hackathon: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  research: { icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  software: { icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  custom: { icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
};

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { templates, loadTemplates, createProjectFromTemplate } = useProjectStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [memberEmailInput, setMemberEmailInput] = useState('');
  const [memberEmails, setMemberEmails] = useState<string[]>([]);

  // Selected Template & Customization State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('final_year');
  const [editablePhases, setEditablePhases] = useState<ProjectTemplatePhase[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  // Derive editable phases from selected template — useMemo avoids setState-in-effect
  const derivedPhases = useMemo<ProjectTemplatePhase[]>(() => {
    if (selectedTemplateId === 'custom') {
      return [
        {
          name: 'Phase 1 — Setup & Requirements',
          description: 'Project setup and initial requirements gathering.',
          tasks: [{ title: 'Initial Project Setup', description: 'Configure repository and environment.', priority: 'HIGH' }],
        },
        {
          name: 'Phase 2 — Core Execution',
          description: 'Main feature implementation phase.',
          tasks: [{ title: 'Develop Core Feature', description: 'Implement primary user value feature.', priority: 'CRITICAL' }],
        },
      ];
    }
    const found = templates.find((t) => t.id === selectedTemplateId);
    return found?.phases ? JSON.parse(JSON.stringify(found.phases)) : [];
  }, [selectedTemplateId, templates]);

  // Keep editablePhases in sync — only update when derivedPhases reference changes
  useEffect(() => {
    setEditablePhases(derivedPhases);
  }, [derivedPhases]);

  if (!isOpen) return null;

  const handleAddMember = () => {
    if (!memberEmailInput.trim()) return;
    if (memberEmails.includes(memberEmailInput.trim().toLowerCase())) return;
    setMemberEmails([...memberEmails, memberEmailInput.trim().toLowerCase()]);
    setMemberEmailInput('');
  };

  const handleRemoveMember = (email: string) => {
    setMemberEmails(memberEmails.filter((e) => e !== email));
  };

  const handleAddTaskToPhase = (phaseIndex: number) => {
    const title = prompt('Enter new task title:');
    if (!title || !title.trim()) return;

    const updated = [...editablePhases];
    updated[phaseIndex].tasks.push({
      title: title.trim(),
      description: 'Custom task created during template setup.',
      priority: 'MEDIUM',
    });
    setEditablePhases(updated);
  };

  const handleRemoveTask = (phaseIndex: number, taskIndex: number) => {
    const updated = [...editablePhases];
    updated[phaseIndex].tasks.splice(taskIndex, 1);
    setEditablePhases(updated);
  };

  const handleAddPhase = () => {
    const phaseName = prompt('Enter new phase title (e.g. Phase 5 — Deployment):');
    if (!phaseName || !phaseName.trim()) return;

    setEditablePhases([
      ...editablePhases,
      {
        name: phaseName.trim(),
        description: 'Custom milestone phase.',
        tasks: [{ title: `${phaseName.trim()} Task 1`, priority: 'MEDIUM' }],
      },
    ]);
  };

  const handleRemovePhase = (phaseIndex: number) => {
    if (editablePhases.length <= 1) {
      alert('Project must have at least one phase milestone.');
      return;
    }
    setEditablePhases(editablePhases.filter((_, idx) => idx !== phaseIndex));
  };

  const handleSubmitCreate = async () => {
    if (!projectName.trim()) {
      setError('Please provide a project name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createProjectFromTemplate({
        name: projectName.trim(),
        description: description.trim(),
        status: 'Planning',
        template_id: selectedTemplateId,
        project_type: selectedTemplateId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        initial_member_emails: memberEmails,
        custom_phases: editablePhases,
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      {/* Panel */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
      <div className="isolate w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-nx-border bg-nx-elevated px-6 py-4 text-nx-primary">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-600 border border-indigo-500/30">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-nx-primary">Academic Project Mode</h3>
              <p className="text-xs text-nx-muted">Initialize workspace with intelligent academic templates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-nx-muted hover:bg-nx-hover hover:text-nx-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="flex border-b border-nx-border bg-nx-elevated px-6 py-3 text-xs font-semibold text-nx-secondary">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-indigo-600 font-bold' : step > 1 ? 'text-emerald-600' : ''}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === 1 ? 'bg-indigo-600 text-white' : step > 1 ? 'bg-emerald-600 text-white' : 'bg-nx-hover text-nx-muted'}`}>1</span>
            <span>Basic Info</span>
          </div>
          <div className="mx-3 text-nx-muted">/</div>
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-indigo-600 font-bold' : step > 2 ? 'text-emerald-600' : ''}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === 2 ? 'bg-indigo-600 text-white' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-nx-hover text-nx-muted'}`}>2</span>
            <span>Select Template</span>
          </div>
          <div className="mx-3 text-nx-muted">/</div>
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-indigo-600 font-bold' : ''}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-nx-hover text-nx-muted'}`}>3</span>
            <span>Preview & Customize</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-nx-card text-nx-primary">
          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">
              {error}
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-nx-secondary">Project Title *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. AI-Based Traffic Prediction System"
                  className="mt-1 w-full rounded-xl border border-nx-border bg-nx-elevated p-3 text-sm font-medium text-nx-primary placeholder:text-nx-muted focus:border-indigo-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-nx-secondary">Project Objective / Synopsis</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the research problem, methodology, software goals, or evaluation metrics..."
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-nx-border bg-nx-elevated p-3 text-sm text-nx-primary placeholder:text-nx-muted focus:border-indigo-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-nx-secondary">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-nx-border bg-nx-elevated p-2.5 text-xs text-nx-primary focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-nx-secondary">Expected Submission Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-nx-border bg-nx-elevated p-2.5 text-xs text-nx-primary focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-nx-secondary">Invite Team Members (Optional)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="email"
                    value={memberEmailInput}
                    onChange={(e) => setMemberEmailInput(e.target.value)}
                    placeholder="student@university.edu"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMember())}
                    className="flex-1 rounded-xl border border-nx-border bg-nx-elevated p-2.5 text-xs text-nx-primary placeholder:text-nx-muted focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="rounded-xl bg-nx-hover px-4 py-2.5 text-xs font-semibold text-nx-primary hover:bg-nx-border transition-colors border border-nx-border"
                  >
                    Add
                  </button>
                </div>

                {memberEmails.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {memberEmails.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-200">
                        {email}
                        <button type="button" onClick={() => handleRemoveMember(email)}>
                          <X className="h-3 w-3 text-indigo-400 hover:text-indigo-600" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Choose Template */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Scratch Option */}
                <div
                  onClick={() => setSelectedTemplateId('custom')}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    selectedTemplateId === 'custom'
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-nx-border bg-nx-elevated hover:bg-nx-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nx-hover text-nx-primary border border-nx-border">
                        <Layers className="h-4 w-4" />
                      </div>
                      <h4 className="text-sm font-bold text-nx-primary">Start from Scratch</h4>
                    </div>
                    {selectedTemplateId === 'custom' && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                  </div>
                  <p className="mt-2 text-xs text-nx-muted">Empty project workspace without pre-populated milestones or tasks.</p>
                </div>

                {/* Academic Templates */}
                {templates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  const badgeConfig = TEMPLATE_BADGES[tpl.id] || TEMPLATE_BADGES.custom;
                  const IconComp = badgeConfig.icon;

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-nx-border bg-nx-elevated hover:bg-nx-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${badgeConfig.bg} ${badgeConfig.color} border`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-nx-primary">{tpl.name}</h4>
                            <span className="text-[10px] font-semibold text-nx-muted">{tpl.category}</span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                      </div>

                      <p className="mt-2 text-xs text-nx-secondary line-clamp-2">{tpl.description}</p>

                      <div className="mt-3 flex items-center justify-between border-t border-nx-border pt-2 text-[11px] font-medium text-nx-muted">
                        <span>{tpl.phases_count} Phases</span>
                        <span>{tpl.tasks_count} Suggested Tasks</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Customize */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-nx-elevated p-4 text-nx-primary border border-nx-border">
                <div>
                  <h4 className="text-sm font-bold text-nx-primary uppercase tracking-wider">
                    {selectedTemplateId === 'custom' ? 'Custom Structure' : `${selectedTemplateId.replace('_', ' ')} Template`}
                  </h4>
                  <p className="text-xs text-nx-muted">
                    {editablePhases.length} Milestones • {editablePhases.reduce((acc, p) => acc + p.tasks.length, 0)} Tasks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPhase}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Milestone Phase</span>
                </button>
              </div>

              {/* Interactive Milestones & Tasks Tree */}
              <div className="space-y-3">
                {editablePhases.map((phase, pIdx) => (
                  <div key={pIdx} className="rounded-xl border border-nx-border bg-nx-elevated p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-800 font-bold text-xs border">
                          {pIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) => {
                            const updated = [...editablePhases];
                            updated[pIdx].name = e.target.value;
                            setEditablePhases(updated);
                          }}
                          className="font-bold text-xs text-nx-primary bg-transparent border-b border-transparent hover:border-nx-border focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddTaskToPhase(pIdx)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Task</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhase(pIdx)}
                          className="rounded p-1 text-nx-muted hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-nx-muted pl-8">{phase.description}</p>

                    {/* Tasks List */}
                    <div className="pl-8 space-y-1.5">
                      {phase.tasks.map((task, tIdx) => (
                        <div
                          key={tIdx}
                          className="flex items-center justify-between rounded-lg border border-nx-border bg-nx-card px-3 py-2 text-xs shadow-2xs group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => {
                                const updated = [...editablePhases];
                                updated[pIdx].tasks[tIdx].title = e.target.value;
                                setEditablePhases(updated);
                              }}
                              className="font-medium text-nx-primary bg-transparent border-b border-transparent hover:border-nx-border focus:border-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                task.priority === 'CRITICAL'
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-nx-hover text-nx-secondary'
                              }`}
                            >
                              {task.priority || 'MEDIUM'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(pIdx, tIdx)}
                              className="opacity-0 group-hover:opacity-100 text-nx-muted hover:text-red-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-nx-border bg-nx-elevated px-6 py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 rounded-xl border border-nx-border bg-nx-card px-4 py-2 text-xs font-semibold text-nx-primary hover:bg-nx-hover"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !projectName.trim()) {
                  setError('Please enter a project name');
                  return;
                }
                setError(null);
                setStep((s) => (s + 1) as 1 | 2 | 3);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <span>Next: {step === 1 ? 'Choose Template' : 'Preview & Customize'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitCreate}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-all"
            >
              {submitting ? <Sparkles className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>{submitting ? 'Initializing Workspace...' : 'Create Academic Project'}</span>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
