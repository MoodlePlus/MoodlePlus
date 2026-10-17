// Moodle+ popup entry point.
// TODO: wire up popup UI - calendar view, grade calculator entry point, dark-mode toggle.

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Moodle+] Popup loaded.');
});

//https://www.youtube.com/watch?v=OxSjCjVFegY
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

let isDarkModeToggle = document.getElementById('dark-mode-checkbox');

isDarkModeToggle.addEventListener('change', () => {
  if (isDarkModeToggle.checked) {
    applyDarkMode("enable");
  } else {
    applyDarkMode("disable");
  }
});
