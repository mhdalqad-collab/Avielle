"use client";
import { createContext, useContext } from "react";
import type { Snapshot } from "@/lib/snapshot";
export type Mutation = {
  kind: string;
  id?: string;
  action?: string;
  data?: Record<string, unknown>;
};
export type AppContext = {
  state: Snapshot;
  actor: Snapshot["users"][number];
  setActor: (id: string) => void;
  mutate: (input: Mutation) => Promise<unknown>;
  busy: boolean;
  refresh: () => Promise<void>;
};
export const Context = createContext<AppContext | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app context");
  return value;
}
