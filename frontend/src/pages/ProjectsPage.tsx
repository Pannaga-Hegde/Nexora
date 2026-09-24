import { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useNavigate } from 'react-router-dom';
import { Plus, GraduationCap, Award, FlaskConical, Zap, Layers } from 'lucide-react';
import CreateProjectModal from '../components/projects/CreateProjectModal';
import SEOHead from '../components/common/SEOHead';

const BADGES: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  final_year: { label: 'Final Year Project', icon: GraduationCap, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  mini_project: { label: 'Mini Project', icon: Layers, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  hackathon: { label: 'Hackathon', icon: Award, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  research: { label: 'Research Project', icon: FlaskConical, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  software: { label: 'Software Project', icon: Zap, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  custom: { label: 'Custom Project', icon: Layers, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
};

export default function ProjectsPage() {
  const { projects, activeProject, setActiveProject, loadProjects } = useProjectStore();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSelectProject = (id: string) => {
    setActiveProject(id);
    navigate('/tasks'); // Instantly jump to the Kanban board for this project
  };

  return (
    <div className="p-8 space-y-6">
      <SEOHead
        title="Workspace Projects"
        description="Browse and manage all team projects, academic templates, and milestone progress."
      />
      <div className="flex items-center justify-between border-b border-nx-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-nx-primary">Projects</h1>
          <p className="mt-1 text-sm text-nx-muted">
            Manage academic capstones, hackathons, and software engineering workspaces.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>New Academic Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const isActive = activeProject?.id === project.id;
          const pType = project.project_type || 'custom';
          const badgeConfig = BADGES[pType] || BADGES.custom;
          const BadgeIcon = badgeConfig.icon;

          return (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className={`cursor-pointer rounded-xl border p-6 transition-all hover:shadow-md space-y-3 ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20'
                  : 'border-nx-border bg-nx-card hover:border-nx-border-strong'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold border ${badgeConfig.bg} ${badgeConfig.color}`}>
                  <BadgeIcon className="h-3.5 w-3.5" />
                  {badgeConfig.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${
                    project.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {project.status}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-nx-primary">{project.name}</h3>
                <p className="mt-1 text-xs text-nx-secondary line-clamp-2">{project.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-nx-muted border-t border-nx-border pt-3">
                <span className="text-[11px]">ID: {project.id.slice(0, 8)}...</span>
                <span className="font-semibold text-indigo-600 hover:underline">
                  {isActive ? 'Active Workspace →' : 'Switch to Project →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
