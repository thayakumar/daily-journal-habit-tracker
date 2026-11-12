import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseHistory } from "./components/ExpenseHistory";
import { isConfigured } from "../lib/sheets-api";
import { uid, type Workspace } from "../workspace/model";
import { type Update } from "../workspace/ui";

export default function Finance({
  data,
  update,
  receiptReady,
  onSync,
}: {
  data: Workspace;
  update: Update;
  receiptReady: boolean;
  onSync: () => void;
}) {
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
      <ExpenseForm
        receiptReady={isConfigured() && receiptReady}
        onSave={(expense) =>
          update((s) => ({
            ...s,
            financeExpenses: [
              ...(s.financeExpenses ?? []),
              {
                ...expense,
                receiptName: expense.receiptName ?? "",
                receiptUrl: expense.receiptUrl ?? "",
                id: uid(),
                createdAt: new Date().toISOString(),
              },
            ],
          }))
        }
      />
      <ExpenseHistory expenses={data.financeExpenses ?? []} onSync={onSync} />
    </div>
  );
}
