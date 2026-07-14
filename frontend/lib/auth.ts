"use client";
import { useSyncExternalStore } from "react";
import Cookies from "js-cookie";
import type { User } from "./api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return Cookies.get("token") || localStorage.getItem("token");
}

export function setToken(token: string): void {
  Cookies.set("token", token, { expires: 1, sameSite: "strict" });
  localStorage.setItem("token", token);
}

export function clearAuth(): void {
  Cookies.remove("token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function setUser(user: User): void {
  localStorage.setItem("user", JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Memoized so getSnapshot returns a stable reference — useSyncExternalStore needs
// that to avoid a re-render loop from JSON.parse() making a new object each call.
let cachedRawUser: string | null = null;
let cachedUser: User | null = null;

function getUserSnapshot(): User | null {
  const raw = typeof window === "undefined" ? null : localStorage.getItem("user");
  if (raw !== cachedRawUser) {
    cachedRawUser = raw;
    try {
      cachedUser = raw ? JSON.parse(raw) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function getUserServerSnapshot(): User | null {
  return null;
}

function subscribeToUser(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Server and first client render both see null, avoiding a hydration mismatch.
export function useUser(): User | null {
  return useSyncExternalStore(subscribeToUser, getUserSnapshot, getUserServerSnapshot);
}
