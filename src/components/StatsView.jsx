import { useState } from "react";
import { todayKey } from "../game/utils";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dateToKey(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function getMondayBefore(d) {
  const out = new Date(d);
  const dow = out.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  out.setDate(out.getDate() - diff);
  return out;
}

function buildCalendarData(checkInHistory) {
  const historyMap = new Map();
  for (const entry of checkInHistory) {
    historyMap.set(entry.date, entry);
  }

  const today = new Date(todayKey() + "T00:00:00");
  const dates = [...historyMap.keys()].sort();
  const firstDate = dates.length > 0
    ? new Date(dates[0] + "T00:00:00")
    : today;

  const startMonday = getMondayBefore(firstDate);
  const endDate = today;

  const weeks = [];
  let cursor = new Date(startMonday);

  while (cursor <= endDate) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const key = dateToKey(cursor);
      const entry = historyMap.get(key);
      const isFuture = cursor > today;
      const isBeforeStart = cursor < firstDate;

      let status = "empty";
      if (entry) {
        status = entry.sober ? "sober" : "drank";
      } else if (!isFuture && !isBeforeStart && dates.length > 0) {
        status = "missed";
      }

      week.push({ key, status, isFuture, isBeforeStart });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { weeks, historyMap };
}

function getMonthMarkers(weeks) {
  const markers = [];
  let lastMonth = null;
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstDay = weeks[wi][0];
    const d = new Date(firstDay.key + "T00:00:00");
    const month = d.getMonth();
    if (month !== lastMonth) {
      markers.push({ weekIdx: wi, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  }
  return markers;
}

export default function StatsView({ state, onBack, onFillDay }) {
  const [fillPrompt, setFillPrompt] = useState(null);
  const history = state.checkInHistory || [];
  const { weeks } = buildCalendarData(history);
  const monthMarkers = getMonthMarkers(weeks);

  const soberCount = history.filter((e) => e.sober).length;
  const drankCount = history.filter((e) => !e.sober).length;
  const totalDays = history.length;
  const soberPct = totalDays > 0 ? Math.round((soberCount / totalDays) * 100) : 0;

  function handleDayClick(day) {
    if (day.status !== "missed") return;
    setFillPrompt(day.key);
  }

  function submitFill(sober) {
    if (!fillPrompt) return;
    onFillDay(fillPrompt, sober);
    setFillPrompt(null);
  }

  return (
    <div className="statsScreen">
      <div className="statsScreenHeader">
        <button className="statsBackBtn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="statsScreenTitle">PROGRESS</div>
      </div>

      <div className="statsHeroRow">
        <div className="statsHeroCard accent">
          <span className="statsHeroValue">{soberPct}%</span>
          <span className="statsHeroLabel">Sober rate</span>
        </div>
        <div className="statsHeroCard">
          <span className="statsHeroValue">{state.streakDays}</span>
          <span className="statsHeroLabel">Current streak</span>
        </div>
        <div className="statsHeroCard">
          <span className="statsHeroValue">{state.highestStreak}</span>
          <span className="statsHeroLabel">Best streak</span>
        </div>
      </div>

      <div className="statsSection">
        <div className="statsSectionTitle">Your journey</div>
        {totalDays === 0 ? (
          <p className="statsEmpty">No check-ins yet. Come back after your first daily debrief.</p>
        ) : (
          <>
            <div className="calendarWrap">
              <div className="calDayHeaders">
                {DAY_LABELS.map((l, i) => (
                  <span key={i} className="calDayHeader">{l}</span>
                ))}
              </div>
              <div className="calGrid">
                {monthMarkers.length > 0 && (
                  <div className="calMonthTrack">
                    {monthMarkers.map((m, i) => (
                      <span
                        key={i}
                        className="calMonthLabel"
                        style={{ gridRow: m.weekIdx + 1 }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="calWeeks">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="calWeek">
                      {week.map((day) => (
                        <button
                          key={day.key}
                          className={`calBlob ${day.status}`}
                          onClick={() => handleDayClick(day)}
                          disabled={day.status !== "missed"}
                          title={
                            day.status === "sober" ? `${day.key}: Sober`
                            : day.status === "drank" ? `${day.key}: Drank`
                            : day.status === "missed" ? `${day.key}: Tap to fill in`
                            : ""
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="calLegend">
              <span><i className="calLegendDot sober" />Sober</span>
              <span><i className="calLegendDot drank" />Drank</span>
              <span><i className="calLegendDot missed" />Missed — tap to fill</span>
            </div>
          </>
        )}
      </div>

      <div className="statsSection">
        <div className="statsSectionTitle">Totals</div>
        <div className="statsTotalsRow">
          <div className="statsTotalItem">
            <span className="statsTotalValue sober">{soberCount}</span>
            <span className="statsTotalLabel">Sober days</span>
          </div>
          <div className="statsTotalItem">
            <span className="statsTotalValue drank">{drankCount}</span>
            <span className="statsTotalLabel">Drinking days</span>
          </div>
          <div className="statsTotalItem">
            <span className="statsTotalValue">{state.totalSoberDays}</span>
            <span className="statsTotalLabel">Lifetime sober</span>
          </div>
        </div>
      </div>

      {fillPrompt && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>Fill in {fillPrompt}</h2>
            <p>Were you sober on this day?</p>
            <div className="modalActions">
              <button className="secondary" onClick={() => submitFill(false)}>
                Drank
              </button>
              <button className="primary" onClick={() => submitFill(true)}>
                Sober
              </button>
            </div>
            <div className="modalActions" style={{ marginTop: 6 }}>
              <button className="secondary" onClick={() => setFillPrompt(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
