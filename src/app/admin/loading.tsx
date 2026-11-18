/**
 * 管理画面の読み込み中の表示。
 * タブを押した瞬間にこの骨組みを出し、データが届いたら中身に置き換わる（体感の待ち時間を減らす）。
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="読み込み中" className="animate-pulse">
      <div className="h-3 w-16 bg-line" />
      <div className="mt-2 h-7 w-48 bg-line" />
      <div className="mt-3 h-4 w-64 bg-line" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-line bg-white p-4">
            <div className="h-4 w-28 bg-line" />
            <div className="mt-3 h-10 w-full bg-paper" />
            <div className="mt-2 h-10 w-full bg-paper" />
          </div>
        ))}
      </div>
    </div>
  );
}
