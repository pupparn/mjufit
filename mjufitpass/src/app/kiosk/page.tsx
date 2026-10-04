import { requireArea } from "@/lib/auth/viewer";
import { KioskScanner } from "./kiosk-scanner";

export default async function KioskPage() {
  await requireArea("staff");
  return <KioskScanner />;
}
