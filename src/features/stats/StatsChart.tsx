export function StatsChart(props: {
  title: string;
  points: { key: string; label: string; value: number }[];
}) {
  const max = Math.max(1, ...props.points.map((p) => p.value));

  return (
    <div className="panel">
      <div className="panel-title"><span>{props.title}</span></div>

      <div role="img" aria-label={props.title} className="stats-chart">
        {props.points.map((p) => {
          const heightPct = Math.round((p.value / max) * 100);
          return (
            <div key={p.key} className="stats-chart-col" title={`${p.label}: ${p.value}`}>
              <div className="stats-chart-bar" style={{ height: `${heightPct}%` }} />
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{props.title}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Completions</th></tr></thead>
        <tbody>
          {props.points.map((p) => (
            <tr key={p.key}><th scope="row">{p.label}</th><td>{p.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
