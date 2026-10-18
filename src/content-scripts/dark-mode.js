// Used code from https://www.youtube.com/watch?v=OxSjCjVFegY
// Runs code on a page to invert colors to apply dark mode

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "enable") {
    //inverts colors of everything except for images and videos
    document.documentElement.style.filter = "invert(1) hue-rotate(180deg)";
    const media = document.querySelectorAll("img, video, picture, canvas");
    media.forEach((el) => (el.style.filter = "invert(1) hue-rotate(180deg)"));
  } else if (message.action === "disable") {
    document.documentElement.style.filter = "";
    const media = document.querySelectorAll("img, video, picture, canvas");
    media.forEach((el) => (el.style.filter = ""));
  }
});
