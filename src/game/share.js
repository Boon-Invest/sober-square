export function buildShareText({ highestStreak, totalSoberDays }) {
  return `I'm on a ${highestStreak}-day sober streak (${totalSoberDays} alcohol-free days total) playing Sober Square, hunting a hidden fleet one sober day at a time. Come play with me:`;
}

// Uses the page's own origin so the shared link always points at wherever
// this build is actually hosted, without hardcoding a URL anywhere.
export async function shareProgress({ highestStreak, totalSoberDays }) {
  const url = window.location.origin;
  const text = buildShareText({ highestStreak, totalSoberDays });

  if (navigator.share) {
    try {
      await navigator.share({ title: "Sober Square", text, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return "copied";
    } catch {
      return "unsupported";
    }
  }

  return "unsupported";
}
