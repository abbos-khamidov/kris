import { listTemplatesAction } from "./actions";
import { TemplatesManager } from "./templates-manager";

export const metadata = { title: "Шаблоны" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const res = await listTemplatesAction();
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl">Шаблоны</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Обезличенные тексты и наборы, которые можно вставить в любую карту. Шаблон — только заготовка: рекомендации нужно проверять для каждого пациента заново.
        </p>
      </div>
      <TemplatesManager initial={res.ok ? res.data : []} />
    </div>
  );
}
