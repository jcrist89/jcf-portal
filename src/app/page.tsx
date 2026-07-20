import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/require";

export default async function RootPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  redirect(user.role === "coach" ? "/coach" : "/dashboard");
}
