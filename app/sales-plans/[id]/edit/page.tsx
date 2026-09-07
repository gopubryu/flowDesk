"use client";

import { use } from "react";
import { SalesPlanForm } from "@/components/sales-plans/sales-plan-form";

export default function SalesPlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SalesPlanForm mode="edit" editId={id} />;
}
