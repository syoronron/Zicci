import { formatTime } from "@/lib/time";

type Bar = { start: number; end: number };

/**
 * 1日のタイムライン。
 * 繁忙・休憩（斜線）と、面接担当者ごとの勤務（灰色の帯）を横に並べる。
 */
export function DayTimeline({
  blocks,
  rows,
  from = 9 * 60,
  to = 23 * 60,
}: {
  blocks: Bar[];
  rows: { label: string; bars: Bar[] }[];
  from?: number;
  to?: number;
}) {
  // 表示範囲を勤務に合わせて広げる
  const all = [...blocks, ...rows.flatMap((r) => r.bars)];
  const start = Math.min(from, ...all.map((b) => Math.floor(b.start / 60) * 60));
  const end = Math.max(to, ...all.map((b) => Math.ceil(b.end / 60) * 60));
  const span = end - start;
  const pos = (b: Bar) => ({
    left: `${((Math.max(b.start, start) - start) / span) * 100}%`,
    width: `${((Math.min(b.end, end) - Math.max(b.start, start)) / span) * 100}%`,
  });
  const ticks: number[] = [];
  for (let t = start; t <= end; t += 180) ticks.push(t);

  return (
    <div className="text-[11px]">
      <div className="grid grid-cols-[3.5rem_1fr] gap-2">
        <span />
        <div className="relative h-4 text-gray">
          {ticks.map((t) => (
            <span
              key={t}
              className="num absolute -translate-x-1/2"
              style={{ left: `${((t - start) / span) * 100}%` }}
            >
              {formatTime(t).replace(/^0/, "").replace(":00", "")}
            </span>
          ))}
        </div>
      </div>
      <TimelineRow label="繁忙・休憩" muted>
        {blocks.map((b, i) => (
          <span key={i} className="stripe absolute inset-y-0 border border-ink bg-white" style={pos(b)} />
        ))}
      </TimelineRow>
      {rows.map((r) => (
        <TimelineRow key={r.label} label={r.label}>
          {r.bars.map((b, i) => (
            <span
              key={i}
              className="absolute inset-y-0 border border-ink bg-[#ededE8]"
              style={pos(b)}
              title={`${formatTime(b.start)}〜${formatTime(b.end)}`}
            />
          ))}
        </TimelineRow>
      ))}
    </div>
  );
}

function TimelineRow({ label, muted, children }: { label: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 grid grid-cols-[3.5rem_1fr] items-center gap-2">
      <span className={`truncate font-medium ${muted ? "text-gray" : ""}`}>{label}</span>
      <div className="relative h-4 border-x border-line">{children}</div>
    </div>
  );
}
