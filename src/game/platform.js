export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

export function detectPlatform() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
