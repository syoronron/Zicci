"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { TIME_OPTIONS } from "@/components/time-select";
import type { ImportPayload } from "@/lib/shift-import";
import { importShifts } from "../actions";

export type WizardWeek = { from: string; label: string; days: { date: string; label: string }[] };
export type WizardShift = { employeeId: string; date: string; start: string; end: string };
type Employee = { id: string; name: string; interviewer: boolean };

type Row = { start: string; end: string }; // start が "" なら休み
type Person = {
  key: string;
  employeeId: string | null;
  name: string;
  interviewer: boolean;
  days: Record<string, Row>;
};

const OFF: Row = { start: "", end: "" };

/** 既存のシフトから、その週の入力欄の初期値を作る（1日1件） */
function prefill(employeeId: string | null, week: WizardWeek, existing: WizardShift[]): Record<string, Row> {
  const days: Record<string, Row> = {};
  for (const d of week.days) {
    const s = employeeId ? existing.find((x) => x.employeeId === employeeId && x.date === d.date) : undefined;
    days[d.date] = s ? { start: s.start, end: s.end } : { ...OFF };
  }
  return days;
}

export function ImportWizard({
  weeks,
  employees,
  existing,
}: {
  weeks: WizardWeek[];
  employees: Employee[];
  existing: WizardShift[];
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [weekFrom, setWeekFrom] = useState(weeks[1]?.from ?? weeks[0].from); // 初期値は来週
  const week = weeks.find((w) => w.from === weekFrom) ?? weeks[0];
  const [photo, setPhoto] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [people, setPeople] = useState<Person[]>(() =>
    employees.map((e) => ({
      key: e.id,
      employeeId: e.id,
      name: e.name,
      interviewer: e.interviewer,
      days: prefill(e.id, week, existing),
    })),
  );
  const [newName, setNewName] = useState("");
  const [state, formAction, pending] = useActionState(importShifts, null);

  // 写真のメモリを解放する
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const changeWeek = (from: string) => {
    const w = weeks.find((x) => x.from === from);
    if (!w) return;
    setWeekFrom(from);
    setPeople((ps) => ps.map((p) => ({ ...p, days: prefill(p.employeeId, w, existing) })));
  };

  const selected = people.filter((p) => p.interviewer);
  const problems = useMemo(
    () =>
      selected.flatMap((p) =>
        week.days
          .filter((d) => {
            const r = p.days[d.date];
            return r && r.start !== "" && (r.end === "" || r.end <= r.start);
          })
          .map((d) => `${p.name}さん ${d.label}`),
      ),
    [selected, week],
  );
  const shiftCount = selected.reduce((n, p) => n + week.days.filter((d) => p.days[d.date]?.start).length, 0);

  const setRow = (key: string, date: string, patch: Partial<Row>) =>
    setPeople((ps) =>
      ps.map((p) => {
        if (p.key !== key) return p;
        const cur = p.days[date] ?? OFF;
        let next = { ...cur, ...patch };
        if (patch.start === "") next = { ...OFF };
        // 開始を選んだら、終了が未入力（または開始より前）なら仮で開始の6時間後にする
        if (patch.start && (next.end === "" || next.end <= next.start)) {
          const i = TIME_OPTIONS.indexOf(patch.start);
          next.end = TIME_OPTIONS[Math.min(i + 24, TIME_OPTIONS.length - 1)];
        }
        return { ...p, days: { ...p.days, [date]: next } };
      }),
    );

  const copyToAll = (key: string, date: string) =>
    setPeople((ps) =>
      ps.map((p) => {
        if (p.key !== key) return p;
        const src = p.days[date];
        return { ...p, days: Object.fromEntries(week.days.map((d) => [d.date, { ...src }])) };
      }),
    );

  const addPerson = () => {
    const name = newName.trim();
    if (!name || people.some((p) => p.name === name)) return;
    setPeople((ps) => [
      ...ps,
      { key: `new-${Date.now()}`, employeeId: null, name, interviewer: true, days: prefill(null, week, existing) },
    ]);
    setNewName("");
  };

  const save = () => {
    const payload: ImportPayload = {
      week: week.from,
      people: people.map((p) => ({
        employeeId: p.employeeId,
        name: p.name,
        interviewer: p.interviewer,
        entries: p.interviewer
          ? week.days
              .filter((d) => p.days[d.date]?.start)
              .map((d) => ({ date: d.date, start: p.days[d.date].start, end: p.days[d.date].end }))
          : [],
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  };

  // 登録できたら完了画面を出す
  const view: 1 | 2 | 3 | "done" = state?.ok ? "done" : step;

  return (
    <div className="space-y-4">
      {view !== "done" && <Steps current={view} />}

      {/* ---------- 1. 写真 ---------- */}
      {view === 1 && (
        <>
          <Card title="どの週のシフト表ですか？">
            <select className="field" value={week.from} onChange={(e) => changeWeek(e.target.value)} aria-label="対象の週">
              {weeks.map((w) => (
                <option key={w.from} value={w.from}>
                  {w.label}
                </option>
              ))}
            </select>
          </Card>

          <Card title="シフト表の写真">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink bg-paper p-4 text-center">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- 端末内の写真（blob URL）を表示するため
                <img src={photo} alt="選んだシフト表の写真" className="max-h-64 w-auto" />
              ) : (
                <>
                  <CameraIcon />
                  <span className="font-bold">撮影する／写真を選ぶ</span>
                  <span className="text-xs text-gray">紙のシフト表全体が入るように撮ってください</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPhoto(URL.createObjectURL(file));
                }}
              />
            </label>
            {photo && <p className="mt-2 text-xs text-gray">写真をタップすると選び直せます。</p>}
            <div className="mt-3 border border-dashed border-mist p-3 text-xs leading-relaxed text-gray">
              <span className="font-bold text-ink">AIによる自動読み取り（準備中）</span>
              <br />
              今は写真を見ながら入力します。AIを使えるようにすると、ここで名前と勤務時間を自動で読み取り、次の画面に入力された状態で始められます。
            </div>
          </Card>

          <Primary onClick={() => setStep(2)}>{photo ? "次へ：面接担当を選ぶ" : "写真なしで次へ"}</Primary>
        </>
      )}

      {/* ---------- 2. 面接担当 ---------- */}
      {view === 2 && (
        <>
          <Card title="誰が面接できますか？">
            <p className="mb-3 text-sm text-gray">
              シフト表にいる人のうち、面接を担当できる人を選んでください（複数可）。選んだ人のシフトだけを入力します。
            </p>
            {people.length === 0 && <p className="mb-3 text-sm text-gray">まだスタッフがいません。下から追加してください。</p>}
            <ul className="-mx-4 border-y border-line">
              {people.map((p) => (
                <li key={p.key} className="border-b border-line last:border-b-0">
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4">
                    <input
                      type="checkbox"
                      className="size-5 accent-ink"
                      checked={p.interviewer}
                      onChange={(e) =>
                        setPeople((ps) => ps.map((x) => (x.key === p.key ? { ...x, interviewer: e.target.checked } : x)))
                      }
                    />
                    <span className="flex-1 font-medium">{p.name}</span>
                    {p.employeeId === null && <span className="text-[10px] text-gray">新規</span>}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                className="field min-w-0 flex-1"
                placeholder="シフト表にいる人を追加"
                value={newName}
                maxLength={30}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPerson();
                  }
                }}
              />
              <button type="button" onClick={addPerson} className="min-h-11 shrink-0 border border-ink bg-white px-4 text-sm font-bold">
                追加
              </button>
            </div>
          </Card>
          <Primary onClick={() => setStep(3)} disabled={selected.length === 0}>
            次へ：{selected.length}人のシフトを入力
          </Primary>
          <Back onClick={() => setStep(1)} />
        </>
      )}

      {/* ---------- 3. シフト入力 ---------- */}
      {view === 3 && (
        <>
          {photo && (
            <div className="sticky top-14 z-[5] -mx-4 border-b border-ink bg-paper/95 px-4 py-2 backdrop-blur">
              <div className={`overflow-auto border border-ink bg-white ${zoom ? "h-[45svh]" : "h-[28svh]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 端末内の写真（blob URL）を表示するため */}
                <img src={photo} alt="シフト表の写真" className={zoom ? "w-[220%] max-w-none" : "h-full w-full object-contain"} />
              </div>
              <button type="button" onClick={() => setZoom((z) => !z)} className="mt-1 text-xs font-bold underline underline-offset-4">
                {zoom ? "写真を小さくする" : "写真を拡大する（指でスクロール）"}
              </button>
            </div>
          )}

          <p className="text-sm text-gray">{week.label.replace("　", "：")}</p>

          {selected.map((p) => (
            <Card key={p.key} title={`${p.name} さん`}>
              <ul className="space-y-2">
                {week.days.map((d) => {
                  const r = p.days[d.date] ?? OFF;
                  const off = r.start === "";
                  const bad = !off && (r.end === "" || r.end <= r.start);
                  return (
                    <li key={d.date} className="flex items-center gap-1.5">
                      <span className="num w-[4.6rem] shrink-0 text-[13px] font-semibold whitespace-nowrap">
                        {d.label.replace("（", "(").replace("）", ")")}
                      </span>
                      <select
                        aria-label={`${d.label} 開始`}
                        value={r.start}
                        onChange={(e) => setRow(p.key, d.date, { start: e.target.value })}
                        className={`field num min-w-0 flex-1 px-1.5! ${off ? "text-gray" : ""}`}
                      >
                        <option value="">休み</option>
                        {TIME_OPTIONS.slice(0, -1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray">〜</span>
                      <select
                        aria-label={`${d.label} 終了`}
                        value={r.end}
                        disabled={off}
                        onChange={(e) => setRow(p.key, d.date, { end: e.target.value })}
                        className={`field num min-w-0 flex-1 px-1.5! disabled:border-mist disabled:text-mist ${bad ? "border-danger! text-danger" : ""}`}
                      >
                        <option value="">−</option>
                        {TIME_OPTIONS.slice(1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
              {(() => {
                const first = week.days.find((d) => p.days[d.date]?.start);
                return first ? (
                  <button
                    type="button"
                    onClick={() => copyToAll(p.key, first.date)}
                    className="mt-3 text-xs font-bold underline underline-offset-4"
                  >
                    {first.label}の時間を全日にコピー
                  </button>
                ) : null;
              })()}
            </Card>
          ))}

          <div className="border border-ink bg-white p-4">
            <p className="text-sm">
              <span className="font-bold">確認：</span>
              {selected.map((p) => p.name).join("・")}さんの、この週のシフトを
              <span className="font-bold">{shiftCount}件</span>
              で登録します（すでに登録されているこの週のシフトは置き換わります）。
            </p>
            {problems.length > 0 && (
              <p className="mt-2 text-sm font-medium text-danger">
                終了時刻を確認してください：{problems.join("、")}
              </p>
            )}
            {state && !state.ok && (
              <p role="status" className="mt-2 text-sm font-medium text-danger">
                {state.message}
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending || problems.length > 0}
              className="mt-3 flex min-h-12 w-full items-center justify-between border border-ink bg-accent px-4 font-bold disabled:opacity-50"
            >
              {pending ? "登録しています…" : "この内容で登録する"}
              <span className="num">→</span>
            </button>
          </div>
          <Back onClick={() => setStep(2)} />
        </>
      )}

      {/* ---------- 完了 ---------- */}
      {view === "done" && (
        <div className="border border-ink bg-white p-4">
          <p className="flex items-center gap-2 text-lg font-bold">
            <span className="inline-block size-4 bg-ink" aria-hidden />
            登録しました
          </p>
          <p role="status" className="mt-1 text-sm text-gray">
            {state?.message}
          </p>
          <p className="mt-3 text-sm">次は、このシフトから面接枠を作りましょう。</p>
          <Link
            href={`/admin/slots?week=${week.from}`}
            className="mt-3 flex min-h-12 items-center justify-between border border-ink bg-accent px-4 font-bold"
          >
            面接枠を作る<span className="num">→</span>
          </Link>
          <Link
            href={`/admin/shifts?week=${week.from}`}
            className="mt-2 flex min-h-11 items-center justify-center border border-ink bg-white text-sm font-bold"
          >
            登録したシフトを確認する
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------- 小さな部品 ----------

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["写真", "面接担当", "シフト入力"];
  return (
    <ol className="grid grid-cols-3 border border-ink bg-white text-center text-xs">
      {labels.map((l, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === current;
        return (
          <li
            key={l}
            aria-current={active ? "step" : undefined}
            className={`border-r border-ink py-2 last:border-r-0 ${active ? "bg-ink font-bold text-white" : n < current ? "" : "text-gray"}`}
          >
            <span className="num mr-1">{n}</span>
            {l}
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-ink bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="inline-block size-1.5 bg-ink" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-between border border-ink bg-accent px-4 font-bold disabled:opacity-50"
    >
      {children}
      <span className="num">→</span>
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 w-full text-sm text-gray underline underline-offset-4">
      ← 戻る
    </button>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="32" viewBox="0 0 40 32" aria-hidden>
      <rect x="1" y="6" width="38" height="25" fill="#fff" stroke="#141414" strokeWidth="1.5" />
      <rect x="12" y="1" width="16" height="6" fill="#fff" stroke="#141414" strokeWidth="1.5" />
      <circle cx="20" cy="18" r="7.5" fill="#FFC800" stroke="#141414" strokeWidth="1.5" />
    </svg>
  );
}
