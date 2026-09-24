import { create } from 'zustand';
import {
  fetchProjectTemplates,
  fetchMyProjectsAPI,
  createProjectAPI,
  leaveProjectAPI,
  fetchProjectMembersAPI,
} from '../services/projectApi';
import type {
  ProjectTemplate,
  ProjectCreatePayload,
  ProjectMember,
} from '../services/projectApi';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;
}

export type { ProjectMember };

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  templates: ProjectTemplate[];
  loadingTemplates: boolean;
  loadingProjects: boolean;
  error: string | null;

  members: ProjectMember[];
  loadingMembers: boolean;
  fetchMembers: (projectId?: string) => Promise<ProjectMember[]>;

  loadProjects: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  setActiveProject: (id: string) => void;
  createProjectFromTemplate: (payload: ProjectCreatePayload) => Promise<Project>;
  leaveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  templates: [],
  loadingTemplates: false,
  loadingProjects: false,
  error: null,
  members: [],
  loadingMembers: false,

  fetchMembers: async (projectId?: string) => {
    const targetId = projectId || get().activeProject?.id;
    if (!targetId) {
      set({ members: [], loadingMembers: false });
      return [];
    }

    set({ loadingMembers: true });
    try {
      const fetched = await fetchProjectMembersAPI(targetId);
      // Only set if still looking at the same target project
      if (get().activeProject?.id === targetId || projectId === targetId) {
        set({ members: fetched, loadingMembers: false });
      }
      return fetched;
    } catch (err) {
      console.warn('Backend fetchMembers failed:', err);
      set({ members: [], loadingMembers: false });
      return [];
    }
  },

  loadProjects: async () => {
    set({ loadingProjects: true, error: null });
    try {
      const fetched = await fetchMyProjectsAPI();
      const mappedProjects: Project[] = (fetched || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        status: p.status || 'Planning',
        project_type: p.project_type || 'custom',
        start_date: p.start_date,
        end_date: p.end_date,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      const currentActive =
        mappedProjects.length > 0
          ? mappedProjects.find((x) => x.id === get().activeProject?.id) || mappedProjects[0]
          : null;

      set({
        projects: mappedProjects,
        activeProject: currentActive,
      });

      if (currentActive) {
        void get().fetchMembers(currentActive.id);
      } else {
        set({ members: [] });
      }
    } catch (err) {
      console.warn('Backend loadProjects failed:', err);
    } finally {
      set({ loadingProjects: false });
    }
  },

  loadTemplates: async () => {
    set({ loadingTemplates: true, error: null });
    try {
      const tpls = await fetchProjectTemplates();
      set({ templates: tpls });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load project templates';
      set({ error: message });
    } finally {
      set({ loadingTemplates: false });
    }
  },

  setActiveProject: (id) => {
    const found = get().projects.find((p) => p.id === id) ?? null;
    set({ activeProject: found, members: [] });
    if (found) {
      void get().fetchMembers(found.id);
    }
  },

  createProjectFromTemplate: async (payload: ProjectCreatePayload) => {
    set({ error: null });
    try {
      const created = await createProjectAPI(payload);
      const newProj: Project = {
        id: created.id,
        name: created.name,
        description: created.description || '',
        status: created.status || 'Planning',
        project_type: created.project_type || payload.project_type || 'custom',
        start_date: created.start_date,
        end_date: created.end_date,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };

      const currentProjects = get().projects;
      const updatedList = [newProj, ...currentProjects.filter((p) => p.id !== newProj.id)];

      set({
        projects: updatedList,
        activeProject: newProj,
      });

      return newProj;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      set({ error: message });
      throw err;
    }
  },

  leaveProject: async (id: string) => {
    try {
      await leaveProjectAPI(id);
    } catch (err) {
      console.warn('Backend leaveProjectAPI warning:', err);
    }
    const currentProjects = get().projects;
    const updatedProjects = currentProjects.filter((p) => p.id !== id);

    let newActive = get().activeProject;
    if (newActive?.id === id) {
      newActive = updatedProjects.length > 0 ? updatedProjects[0] : null;
    }

    set({
      projects: updatedProjects,
      activeProject: newActive,
    });
  },

  deleteProject: (id: string) => {
    get().leaveProject(id);
  },
}));

