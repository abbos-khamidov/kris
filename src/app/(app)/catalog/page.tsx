import { ensureCategories, listProductsAction } from "./actions";
import { CatalogManager } from "./catalog-manager";

export const metadata = { title: "Каталог средств" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const categories = await ensureCategories();
  const res = await listProductsAction({ includeArchived: true });
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl">Каталог средств</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Изменение каталога не затрагивает уже утверждённые карты: в карту средство копируется вместе с ценами в момент добавления.
        </p>
      </div>
      <CatalogManager categories={categories} initial={res.ok ? res.data : []} />
    </div>
  );
}
