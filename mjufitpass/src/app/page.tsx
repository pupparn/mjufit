import { redirect } from "next/navigation";
import { AREA_PATHS, homeArea } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";

export default async function Home() {
  redirect(AREA_PATHS[homeArea(await getViewer())]);
}
