import { useState } from "react";
import { Dialog } from "../workspace/Dialog";
import { Field, inputClass, primaryClass } from "../workspace/ui";
import type { SkinHabit, SkinProduct } from "./model";

export function ProductEditor({
  product,
  onSave,
  onClose,
}: {
  product: SkinProduct;
  onSave: (p: SkinProduct) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(product);
  const [error, setError] = useState("");
  return (
    <Dialog
      title={product.name ? "Edit skincare product" : "Add skincare product"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!p.name.trim()) {
            setError("Enter a product name.");
            return;
          }
          if (p.started && p.stopped && p.stopped < p.started) {
            setError("The stop date must be on or after the start date.");
            return;
          }
          onSave({ ...p, name: p.name.trim() });
        }}
      >
        {(["name", "brand", "type", "started", "stopped"] as const).map((k) => (
          <Field
            key={k}
            label={
              {
                name: "Product name",
                brand: "Brand",
                type: "Product type",
                started: "Started using (optional)",
                stopped: "Stopped using (optional)",
              }[k]
            }
          >
            <input
              className={inputClass}
              required={k === "name"}
              maxLength={k === "type" ? 100 : 200}
              type={k === "started" || k === "stopped" ? "date" : "text"}
              value={p[k]}
              onChange={(e) => setP({ ...p, [k]: e.target.value })}
            />
          </Field>
        ))}
        <Field label="Product notes">
          <textarea
            aria-label="Product notes"
            className={inputClass}
            maxLength={10000}
            rows={4}
            placeholder="Ingredients, how you use it, or anything to remember…"
            value={p.notes}
            onChange={(e) => setP({ ...p, notes: e.target.value })}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => setP({ ...p, active: e.target.checked })}
          />
          Currently using this product
        </label>
        {error && (
          <p role="alert" className="text-sm text-[#A83E20]">
            {error}
          </p>
        )}
        <button type="submit" className={primaryClass}>
          Save product
        </button>
      </form>
    </Dialog>
  );
}

export function HabitEditor({
  habit,
  onSave,
  onClose,
}: {
  habit: SkinHabit;
  onSave: (h: SkinHabit) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState(habit);
  const [error, setError] = useState("");
  return (
    <Dialog
      title={habit.name ? "Edit skincare habit" : "Add skincare habit"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!h.name.trim()) {
            setError("Enter a skincare habit name.");
            return;
          }
          onSave({ ...h, name: h.name.trim() });
        }}
      >
        <Field label="Skincare habit name">
          <input
            aria-label="Skincare habit name"
            required
            maxLength={200}
            className={inputClass}
            value={h.name}
            onChange={(e) => setH({ ...h, name: e.target.value })}
            placeholder="Moisturiser, cleanser, treatment…"
          />
        </Field>
        <Field label="Routine time">
          <select
            aria-label="Routine time"
            className={inputClass}
            value={h.period}
            onChange={(e) =>
              setH({ ...h, period: e.target.value as SkinHabit["period"] })
            }
          >
            {["AM", "PM", "Anytime"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={h.active}
            onChange={(e) => setH({ ...h, active: e.target.checked })}
          />
          Active routine step
        </label>
        {error && (
          <p role="alert" className="text-sm text-[#A83E20]">
            {error}
          </p>
        )}
        <button type="submit" className={primaryClass}>
          Save habit
        </button>
      </form>
    </Dialog>
  );
}
