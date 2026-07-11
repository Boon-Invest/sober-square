import { BOMB_MILESTONES, INTEL_MILESTONES } from "../game/milestones";

export default function HowToPlay() {
  return (
    <div className="howToPlay">
      <section>
        <h3>The mission</h3>
        <p>
          A fleet is hidden across a 15&times;15 ocean: 1 Plane Transporter (5
          squares), 2 Battle Cruisers (3 squares each), and 4 Small Subs (2
          squares each) - 19 target squares, plus scattered islands. Neutralize
          the fleet within 60 days.
        </p>
        <p>
          This is a solo game, not multiplayer - there's no other player and
          no one else to compete against. A hidden, computer-placed fleet is
          waiting for you alone to find, using your own sobriety streak to
          fuel the hunt.
        </p>
      </section>

      <section>
        <h3>Daily debrief</h3>
        <p>Once a day you'll be asked whether you drank yesterday.</p>
        <ul>
          <li>
            <strong>Stayed sober</strong> - streak +1, you earn today's shot,
            clock advances.
          </li>
          <li>
            <strong>Drank</strong> - streak resets to 0. Clock still advances
            either way, the mission doesn't pause for a drinking day. You can
            also log an optional private note.
          </li>
        </ul>
      </section>

      <section>
        <h3>Fire control</h3>
        <p>
          Each sober day gives you 1 shot at a hidden square. A hit refunds
          the shot immediately - chain hits until you finally miss.
        </p>
      </section>

      <section>
        <h3>Streak rewards</h3>
        <ul>
          <li>
            Bomb charges at streak days {BOMB_MILESTONES.join(", ")}{" "}
            (damages a 5-square cross).
          </li>
          <li>
            Intel charges at streak days {INTEL_MILESTONES.join(", ")}{" "}
            (reveals a 3&times;3 area - shows what's there, no damage).
          </li>
          <li>Beat your best streak &rarr; +1 bonus shot, that day only.</li>
          <li>Broadcast progress &rarr; +1 shot, once per day.</li>
          <li>Install to home screen &rarr; a one-time +1 shot.</li>
        </ul>
      </section>

      <section>
        <h3>The risk</h3>
        <p>
          A sober day never disturbs the board - anything you've found stays
          exactly as you left it. A relapse day rolls fog back over any ship
          you've damaged but not sunk, re-hiding it elsewhere, undamaged. So
          an unfinished ship is only truly safe as long as you stay sober.
          Random supply drops also happen on sober days - a surprise shot,
          bomb, intel charge, or even a free confirmed hit on the fleet.
        </p>
      </section>

      <section>
        <h3>Win / loss</h3>
        <p>
          Sink every ship before day 60 to win - a new mission starts right
          away, and your streaks and lifetime stats carry over. If day 60
          arrives with ships still afloat, that mission ends and you can
          deploy a new one any time.
        </p>
      </section>

      <section>
        <h3>Turn this into an app on your homescreen</h3>

        <h4>If you're on an iPhone</h4>
        <ol>
          <li>Open this page in Safari (not Chrome - it has to be Safari).</li>
          <li>
            Tap the Share icon - the square with an arrow pointing up, in the
            toolbar.
          </li>
          <li>Scroll down the menu and tap &ldquo;Add to Home Screen&rdquo;.</li>
          <li>Tap &ldquo;Add&rdquo; in the top-right corner to confirm.</li>
        </ol>

        <h4>If you're on Android</h4>
        <ol>
          <li>Open this page in Chrome.</li>
          <li>Tap the three-dot menu (&#8942;) in the top-right corner.</li>
          <li>
            Tap &ldquo;Add to Home screen&rdquo; (or &ldquo;Install
            app&rdquo;, depending on your version of Chrome).
          </li>
          <li>Tap &ldquo;Add&rdquo; (or &ldquo;Install&rdquo;) to confirm.</li>
        </ol>
      </section>
    </div>
  );
}
