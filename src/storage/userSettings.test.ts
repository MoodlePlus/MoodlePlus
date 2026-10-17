import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage memory for Vitest execution
const mockStore = new Map<string, any>();

// Mock webextension-polyfill so Vitest doesn't throw extension runtime errors in Node
vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: mockStore.get(key),
        })),
        set: vi.fn(async (items: Record<string, any>) => {
          Object.entries(items).forEach(([k, v]) => mockStore.set(k, v));
        }),
      },
    },
  },
}));

import { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } from "./userSettings";

describe("userSettings storage utility", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("returns default settings when storage is empty or uninitialized", async () => {
    const settings = await getUserSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.darkModeEnabled).toBe(false);
  });

  it("updates partial settings correctly and persists them", async () => {
    const updated = await saveUserSettings({ darkModeEnabled: true });
    expect(updated.darkModeEnabled).toBe(true);
    expect(updated.autoCalculateGrades).toBe(true);

    const reloaded = await getUserSettings();
    expect(reloaded.darkModeEnabled).toBe(true);
  });
});