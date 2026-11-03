// Tab-switching for the topbar/tabs/views markup shared by the popup and the on-page
// overlay (src/popup/popup.html's structure, reused inside overlay.js's shadow root).
// Scoped through `root` rather than the global document so it works in both places.

/**
 * Wires click-to-switch behavior for a `[role="tab"]` group. Expects each tab's
 * `aria-controls` to name a sibling panel's id within the same `root`.
 * @param {ParentNode} root
 */
export function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
        root.querySelector(`#${other.getAttribute('aria-controls')}`).hidden = !selected;
      }
    });
  }
}
