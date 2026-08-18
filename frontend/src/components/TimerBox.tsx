export function TimerBox({ timer }: { timer: { label: string; display: string } | null }) {
  if (!timer) return null;
  return (
    <div className="card timer-box">
      <div className="timer-label">{timer.label}</div>
      <div className="timer-display">{timer.display}</div>
    </div>
  );
}
