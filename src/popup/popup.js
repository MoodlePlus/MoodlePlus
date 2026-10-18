// Moodle+ popup entry point.
// TODO: wire up popup UI - calendar view, grade calculator entry point, dark-mode toggle.

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Moodle+] Popup loaded.');
});

// Dark-mode toggle implementation
// code from https://www.youtube.com/watch?v=OxSjCjVFegY
// Currently does not save user preference, and dark mode turns off when a new page is clicked

// This function finds the tab the user is on and runs the dark-mode.js file when called
function applyDarkMode(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;

    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: ["src/content-scripts/dark-mode.js"]
      },
      () => {
        chrome.tabs.sendMessage(tabId,{action:action});
      },
    );
  });
}

// checks to see if the state of the dark mode toggle and calls the applyDarkMode function
// Used some AI to debug this section

let isDarkModeToggle = document.getElementById('dark-mode-checkbox');

isDarkModeToggle.addEventListener('change', () => {
  if (isDarkModeToggle.checked) {
    applyDarkMode("enable");
  } else {
    applyDarkMode("disable");
  }
});
