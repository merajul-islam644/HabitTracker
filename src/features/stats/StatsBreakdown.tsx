import type { BreakdownRow } from "./statsCompute";

export function StatsBreakdown(props: {
  rows: BreakdownRow[];
  onSelectHabit: (habitId: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-title"><span>Habits</span></div>

      <div className="stats-breakdown" role="table" aria-label="Habits breakdown">
        <div className="stats-breakdown-head" role="row">
          <span role="columnheader">Habit</span>
          <span role="columnheader">Done/Scheduled</span>
          <span role="columnheader">Rate</span>
        </div>

        {props.rows.map((row) => (
          <button
            key={row.habitId}
            type="button"
            className="stats-breakdown-row"
            role="row"
            onClick={() => props.onSelectHabit(row.habitId)}
          >
            <span role="cell" className="stats-breakdown-name">{row.habitName}</span>
            <span role="cell" className="stats-breakdown-count">{row.done}/{row.scheduled}</span>
            <span role="cell" className="stats-breakdown-rate">{row.ratePercent}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
