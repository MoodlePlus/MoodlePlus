import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for browser.storage.local.
const mockStore = new Map();

const pick = (keys) => {
  const list = keys === null || keys === undefined ? [...mockStore.keys()] : [].concat(keys);
  return Object.fromEntries(list.filter((k) => mockStore.has(k)).map((k) => [k, mockStore.get(k)]));
};

const storageLocal = {
  get: vi.fn(async (keys) => pick(keys)),
  set: vi.fn(async (items) => {
    // Yield first so concurrent saves interleave like the real async API.
    await Promise.resolve();
    Object.entries(items).forEach(([k, v]) => mockStore.set(k, v));
  }),
  remove: vi.fn(async (keys) => [].concat(keys).forEach((k) => mockStore.delete(k))),
};

// Mock webextension-polyfill so Vitest doesn't throw extension runtime errors in Node
vi.mock("webextension-polyfill", () => ({
  default: { storage: { local: storageLocal } },
}));

const { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } = await import("./userSettings.js");

describe("userSettings storage utility", () => {
  beforeEach(() => {
    mockStore.clear();
    vi.clearAllMocks();
  });

  it("returns default settings when storage is empty", async () => {
    expect(await getUserSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns a copy, so mutating the result doesn't change the defaults", async () => {
    const settings = await getUserSettings();
    settings.darkModeEnabled = true;

    expect(DEFAULT_SETTINGS.darkModeEnabled).toBe(false);
    expect((await getUserSettings()).darkModeEnabled).toBe(false);
  });

  it("updates partial settings correctly and persists them", async () => {
    const updated = await saveUserSettings({ darkModeEnabled: true });
    expect(updated).toEqual({ ...DEFAULT_SETTINGS, darkModeEnabled: true });

    const reloaded = await getUserSettings();
    expect(reloaded.darkModeEnabled).toBe(true);
  });

  it("keeps both changes when two settings are saved at the same time", async () => {
    await Promise.all([
      saveUserSettings({ darkModeEnabled: true }),
      saveUserSettings({ calendarViewMode: "week" }),
    ]);

    const reloaded = await getUserSettings();
    expect(reloaded.darkModeEnabled).toBe(true);
    expect(reloaded.calendarViewMode).toBe("week");
  });

  it("falls back to the default for stored values that are invalid", async () => {
    mockStore.set("settings.darkModeEnabled", "yes");
    mockStore.set("settings.calendarViewMode", "week");

    const settings = await getUserSettings();
    expect(settings.darkModeEnabled).toBe(DEFAULT_SETTINGS.darkModeEnabled);
    expect(settings.calendarViewMode).toBe("week");
  });

  it("returns defaults when reading storage fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    storageLocal.get.mockRejectedValueOnce(new Error("storage unavailable"));

    expect(await getUserSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects when writing storage fails", async () => {
    storageLocal.set.mockRejectedValueOnce(new Error("quota exceeded"));

    await expect(saveUserSettings({ darkModeEnabled: true })).rejects.toThrow("quota exceeded");
    expect((await getUserSettings()).darkModeEnabled).toBe(false);
  });

  it("rejects unknown settings and invalid values without writing anything", async () => {
    await expect(saveUserSettings({ notARealSetting: true })).rejects.toThrow(TypeError);
    await expect(saveUserSettings({ calendarViewMode: "year" })).rejects.toThrow(TypeError);
    expect(storageLocal.set).not.toHaveBeenCalled();
  });
});
