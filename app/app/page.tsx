import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "./Dashboard";

export const metadata = { title: "Tableau de bord — Confirmo" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getSession())) redirect("/login");
  return <Dashboard />;
}
