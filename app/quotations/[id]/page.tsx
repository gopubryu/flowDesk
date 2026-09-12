import { QuotationForm } from "@/components/quotations/quotation-form";
export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <QuotationForm id={id} />; }
