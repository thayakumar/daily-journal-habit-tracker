import { Dialog } from "../../workspace/Dialog";
import { Field, inputClass, primaryClass } from "../../workspace/ui";
import { money, type FinanceCycle, type FinancePlanning } from "../planning";
import type { FinancePortfolio } from "../portfolio-model";
import {
  ENTITY_NAMES,
  getPortfolioFields,
  type PortfolioDraft,
  type PortfolioEntity,
} from "./fields";

export function PortfolioEditorDialog({
  editor,
  p,
  plan,
  cycle,
  error,
  onChangeDraft,
  onSave,
  onClose,
}: {
  editor: { entity: PortfolioEntity; draft: PortfolioDraft };
  p: FinancePortfolio;
  plan: FinancePlanning;
  cycle: FinanceCycle | undefined;
  error: string;
  onChangeDraft: (key: string, value: string | boolean) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEditing = p[editor.entity].some((r) => r.id === editor.draft.id);
  const inputFields = getPortfolioFields(
    editor.entity,
    editor.draft,
    p,
    plan,
    cycle,
  );
  const isGoldSnapshot =
    editor.entity === "snapshots" &&
    p.accounts.find((a) => a.id === editor.draft.accountId)?.kind === "gold";
  const goldUnits = Number(editor.draft.units);
  const goldPrice = Number(editor.draft.price);
  const goldValue = Number(editor.draft.value);

  return (
    <Dialog
      title={`${isEditing ? "Edit" : "Add"} ${ENTITY_NAMES[editor.entity]}`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {inputFields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.options ? (
              <select
                aria-label={f.label}
                required={!f.optional}
                className={inputClass}
                value={String(editor.draft[f.key] ?? "")}
                onChange={(e) => onChangeDraft(f.key, e.target.value)}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                aria-label={f.label}
                type="checkbox"
                className="h-5 w-5 accent-[#D95D39]"
                checked={!!editor.draft[f.key]}
                onChange={(e) => onChangeDraft(f.key, e.target.checked)}
              />
            ) : (
              <input
                aria-label={f.label}
                required={!f.optional}
                type={f.type ?? "text"}
                className={inputClass}
                value={String(editor.draft[f.key] ?? "")}
                min={f.min}
                max={f.max}
                step={f.step}
                maxLength={f.key === "maskedRef" ? 4 : 200}
                pattern={f.key === "maskedRef" ? "[0-9]{4}" : undefined}
                onChange={(e) => onChangeDraft(f.key, e.target.value)}
              />
            )}{" "}
            {f.hint && (
              <p className="mt-1 text-xs font-normal leading-relaxed text-[#8C8073]">
                {f.hint}
              </p>
            )}
          </Field>
        ))}
        {isGoldSnapshot && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold">
            Recorded value:{" "}
            {money(
              Number.isFinite(goldUnits) &&
                goldUnits > 0 &&
                Number.isFinite(goldPrice) &&
                goldPrice > 0
                ? goldUnits * goldPrice
                : Number.isFinite(goldValue)
                  ? goldValue
                  : 0,
            )}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[#FBECE7] p-3 text-sm text-[#A83E20]"
          >
            {error}
          </p>
        )}
        <button type="submit" className={primaryClass}>
          Save {ENTITY_NAMES[editor.entity]}
        </button>
      </form>
    </Dialog>
  );
}
