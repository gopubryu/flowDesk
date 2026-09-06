import { redirect } from "next/navigation";

export default function PurchasePlansLegacyRedirect() {
  redirect("/sales-plans/new");
}
