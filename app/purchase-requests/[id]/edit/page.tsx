"use client";

import { use } from "react";
import { PurchaseRequestForm } from "@/components/purchase-requests/purchase-request-form";

export default function PurchaseRequestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PurchaseRequestForm mode="edit" editId={id} />;
}
