import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthForm from "../AuthForm";

export const metadata = { title: "Connexion — Confirmo" };

export default async function Page() {
  if (await getSession()) redirect("/app");
  return <AuthForm mode="login" />;
}
