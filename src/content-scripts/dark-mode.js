//https://www.youtube.com/watch?v=OxSjCjVFegY
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "enable") {
    document.documentElement.style.filter = "invert(1) hue-rotate(180deg)";
    const media = document.querySelectorAll("img, video, picture, canvas");
    media.forEach((el) => (el.style.filter = "invert(1) hue-rotate(180deg)"));
  } else if (message.action === "disable") {
    document.documentElement.style.filter = "";
    const media = document.querySelectorAll("img, video, picture, canvas");
    media.forEach((el) => (el.style.filter = ""));
  }
});
