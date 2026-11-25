import { listImportsAction } from "./actions";
import { ImportManager } from "./import-manager";

export const metadata = { title: "Импорт карт" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const res = await listImportsAction();
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl">Импорт карт</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Загрузите готовые PDF-карты: приложение разберёт их на 10 разделов и предложит тексты, средства и процедуры. Ничего не попадает в библиотеку, пока вы сами не отметите и не подтвердите.
        </p>
      </div>
      <ImportManager initial={res.ok ? res.data : []} />
    </div>
  );
}
