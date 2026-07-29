export function buildShareText({ streakDays, totalSoberDays }) {
  return `I'm on a ${streakDays}-day sober streak (${totalSoberDays} alcohol-free days total) playing Sober Square, a solo game where you hunt a hidden AI-placed fleet one sober day at a time. Try it yourself (it's not multiplayer, you'd start your own game):`;
}

export async function shareProgress({ streakDays, totalSoberDays }) {
  const url = window.location.origin;
  const text = buildShareText({ streakDays, totalSoberDays });

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
