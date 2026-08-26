import { create } from "zustand";
import type { Profile } from "@/types/profile";
import { profileRepository } from "@repositories/profileRepository";
import { useConnectionStore } from "@stores/useConnectionStore";
import { UNLOADED, createListLoader } from "./loadable";
import type { LoadState } from "./loadable";

export type ProfileDraft = Pick<Profile, "name" | "username">;

interface ProfileState extends LoadState {
  profiles: Profile[];

  load: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
  create: (draft: ProfileDraft, password: string | null) => Promise<Profile>;
  update: (
    id: string,
    draft: ProfileDraft,
    password: string | null,
  ) => Promise<Profile>;
  remove: (id: string) => Promise<void>;
  forgetPassword: (id: string) => Promise<void>;
}

const byName = (a: Profile, b: Profile) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export const useProfileStore = create<ProfileState>((set, get) => {
  const loader = createListLoader({
    fetch: () => profileRepository.list(),
    commit: (profiles: Profile[]) => set({ profiles }),
    patch: set,
    isLoaded: () => get().loaded,
  });

  return {
    profiles: [],
    ...UNLOADED,

    load: loader.load,
    ensureLoaded: loader.ensureLoaded,

    create: async (draft, password) => {
      const created = await profileRepository.create(draft, password);
      set((state) => ({ profiles: [...state.profiles, created].sort(byName) }));
      return created;
    },

    update: async (id, draft, password) => {
      const updated = await profileRepository.update(id, draft, password);
      set((state) => ({
        profiles: state.profiles.map((p) => (p.id === id ? updated : p)).sort(byName),
      }));
      useConnectionStore.getState().applyProfileUpdate(id, updated.username);
      return updated;
    },

    remove: async (id) => {
      await profileRepository.remove(id);
      set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id) }));
      useConnectionStore.getState().applyProfileRemoval(id);
    },

    forgetPassword: async (id) => {
      await profileRepository.deletePassword(id);
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.id === id ? { ...p, hasPassword: false } : p,
        ),
      }));
    },
  };
});
