export default function HowToPlay() {
  return (
    <div className="howToPlay">
      <section>
        <h3>The aim</h3>
        <p>
          A fleet is hidden across a 15&times;15 ocean: 1 Plane Transporter (5
          squares), 2 Battle Cruisers (3 squares each), and 4 Small Subs (2
          squares each) &mdash; 19 ship squares in total, plus scattered sandy
          islands. Find and sink the entire fleet within 60 days.
        </p>
      </section>

      <section>
        <h3>Daily check-in</h3>
        <p>Once a day you'll be asked whether you drank yesterday.</p>
        <ul>
          <li>
            <strong>No, stayed sober</strong> &mdash; your streak grows by 1,
            you earn today's shot, and the 60-day countdown moves forward.
          </li>
          <li>
            <strong>Yes, I drank</strong> &mdash; your streak resets to 0. The
            60-day countdown still moves forward either way &mdash; the game
            doesn't pause for a drinking day. You can also jot down an
            optional note, saved to your History.
          </li>
        </ul>
      </section>

      <section>
        <h3>Firing shots</h3>
        <p>
          Each sober day gives you 1 shot at a hidden square. Land a hit and
          you get another shot immediately, free &mdash; a lucky run can chain
          through several hits before you finally miss.
        </p>
      </section>

      <section>
        <h3>What streaks get you</h3>
        <ul>
          <li>Every 7-day streak &rarr; +1 Bomb (damages a 5-square cross).</li>
          <li>
            Every 21-day streak &rarr; +1 Intel charge (reveals a 3&times;3
            area &mdash; shows what's there, no damage).
          </li>
          <li>Beat your personal best streak &rarr; +1 bonus shot, that day only.</li>
          <li>Share your progress &rarr; +1 shot, once per day.</li>
          <li>Add this app to your home screen &rarr; a one-time +1 shot.</li>
        </ul>
      </section>

      <section>
        <h3>The risk</h3>
        <p>
          A sober day never disturbs the board &mdash; anything you've found
          stays exactly as you left it. But if you drink, a patch of fog
          rolls back in and deliberately hunts down any ship you've damaged
          but not sunk yet, re-hiding it somewhere else with its damage
          cleared. So an unfinished ship is only truly safe as long as you
          stay sober. There are also random "supply drops" on sober days
          &mdash; a surprise shot, bomb, intel charge, or even a free
          confirmed hit somewhere on the fleet.
        </p>
      </section>

      <section>
        <h3>Winning and losing</h3>
        <p>
          Sink every ship before day 60 and you win &mdash; a fresh board and
          fleet start right away, and your streaks and lifetime stats carry
          over. If day 60 arrives with ships still afloat, that game ends and
          you can start a new 60-day hunt any time.
        </p>
      </section>

      <section>
        <h3>Turn this into an App on your homescreen</h3>

        <h4>If you're on an iPhone</h4>
        <ol>
          <li>Open this page in Safari (not Chrome &mdash; it has to be Safari).</li>
          <li>
            Tap the Share icon &mdash; the square with an arrow pointing up,
            in the toolbar.
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
