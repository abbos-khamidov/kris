import { notFound } from "next/navigation";
import { getImportAction } from "../actions";
import { ReviewImport } from "./review";

export const metadata = { title: "Проверка импорта" };
export const dynamic = "force-dynamic";

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getImportAction(id);
  if (!res.ok) notFound();
  return <ReviewImport id={id} data={res.data} />;
}
