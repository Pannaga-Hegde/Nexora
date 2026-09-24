import { create } from 'zustand';
import {
  type AvailabilityBlock,
  type MeetingSuggestion,
  fetchMyAvailability,
  updateMyAvailability,
  fetchProjectMeetingSuggestions,
} from '../services/schedulingApi';

interface SchedulingState {
  myAvailability: AvailabilityBlock[];
  suggestions: MeetingSuggestion[];
  loadingAvailability: boolean;
  loadingSuggestions: boolean;
  error: string | null;

  loadMyAvailability: () => Promise<void>;
  saveMyAvailability: (blocks: AvailabilityBlock[]) => Promise<void>;
  loadMeetingSuggestions: (projectId: string) => Promise<void>;
  clearError: () => void;
}

export const useSchedulingStore = create<SchedulingState>((set) => ({
  myAvailability: [],
  suggestions: [],
  loadingAvailability: false,
  loadingSuggestions: false,
  error: null,

  loadMyAvailability: async () => {
    set({ loadingAvailability: true, error: null });
    try {
      const blocks = await fetchMyAvailability();
      set({ myAvailability: blocks, loadingAvailability: false });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Error loading availability',
        loadingAvailability: false,
      });
    }
  },

  saveMyAvailability: async (blocks: AvailabilityBlock[]) => {
    set({ loadingAvailability: true, error: null });
    try {
      const updated = await updateMyAvailability(blocks);
      set({ myAvailability: updated, loadingAvailability: false });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Error saving availability schedule',
        loadingAvailability: false,
      });
      throw err;
    }
  },

  loadMeetingSuggestions: async (projectId: string) => {
    set({ loadingSuggestions: true, error: null });
    try {
      const suggestions = await fetchProjectMeetingSuggestions(projectId);
      set({ suggestions, loadingSuggestions: false });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Error loading meeting suggestions',
        loadingSuggestions: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
