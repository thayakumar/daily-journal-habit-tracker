import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Card,
  Empty,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
} from "../workspace/ui";
import type { SkinProduct } from "./model";

export function SkinProductsTab({
  products,
  onNewProduct,
  onEditProduct,
  onToggleArchive,
}: {
  products: SkinProduct[];
  onNewProduct: () => void;
  onEditProduct: (product: SkinProduct) => void;
  onToggleArchive: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);

  const filtered = products.filter(
    (pr) =>
      (archived || pr.active) &&
      `${pr.name} ${pr.brand} ${pr.type}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <div
      role="tabpanel"
      id="skincare-products"
      aria-labelledby="skin-tab-products"
    >
      <Card
        title="Products I’m using"
        subtitle="Keep product details and dates together. Archiving preserves products on your past journal entries."
        action={
          <button type="button" className={primaryClass} onClick={onNewProduct}>
            <Plus className="h-4 w-4" />
            Add product
          </button>
        }
      >
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Field label="Search skincare products">
            <input
              aria-label="Search skincare products"
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, brand or type…"
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Show archived products
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((pr) => (
            <article
              key={pr.id}
              className="min-w-0 rounded-2xl border border-[#EAE2D6] p-4"
            >
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-semibold">
                    {pr.name}
                  </h3>
                  <p className="mt-1 text-sm text-[#62584E]">
                    {[pr.brand, pr.type].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => onEditProduct(pr)}
                >
                  Edit
                </button>
              </div>
              <p className="my-3 whitespace-pre-wrap break-words text-sm text-[#62584E]">
                {pr.notes}
              </p>
              <p className="text-xs text-[#8C8073]">
                {pr.started && `Started ${pr.started}`}
                {pr.stopped && ` · Stopped ${pr.stopped}`}
              </p>
              <button
                type="button"
                className={`${secondaryClass} mt-4`}
                onClick={() => onToggleArchive(pr.id)}
              >
                {pr.active ? "Archive product" : "Use again"}
              </button>
            </article>
          ))}
        </div>
        {!products.length && (
          <Empty>
            Add your cleanser, moisturiser, sunscreen and other products.
          </Empty>
        )}
      </Card>
    </div>
  );
}
