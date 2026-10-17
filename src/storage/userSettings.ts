import browser from "webextension-polyfill";

export interface UserSettings {
  darkModeEnabled: boolean;
  compactViewEnabled: boolean;
  autoCalculateGrades: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  darkModeEnabled: false,
  compactViewEnabled: false,
  autoCalculateGrades: true,
};

/**
 * Retrieves persisted user settings from browser.storage.local, falling back to defaults.
 */
export async function getUserSettings(): Promise<UserSettings> {
  try {
    if (typeof browser === "undefined" || !browser.storage) {
      return DEFAULT_SETTINGS;
    }
    const result = await browser.storage.local.get("userSettings");
    return result.userSettings
      ? { ...DEFAULT_SETTINGS, ...result.userSettings }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persists updated user settings to browser.storage.local.
 */
export async function saveUserSettings(
  newSettings: Partial<UserSettings>
): Promise<UserSettings> {
  const currentSettings = await getUserSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };

  try {
    if (typeof browser !== "undefined" && browser.storage) {
      await browser.storage.local.set({ userSettings: updatedSettings });
    }
  } catch {
    // Fallback for test/non-extension environments
  }

  return updatedSettings;
}
