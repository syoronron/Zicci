import { redirect } from "next/navigation";

/** 以前の「予約・面接」のURL。ホームに統合したので移動する（?d= の日付は引き継ぐ） */
export default async function ReservationsRedirect({ searchParams }: PageProps<"/admin/reservations">) {
  const { d } = await searchParams;
  redirect(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `/admin?d=${d}` : "/admin");
}
