import type { FinanceExpense } from "../workspace/model";
export interface ImportRow {
  id: string;
  date: string;
  item: string;
  amount: string;
  category: string;
  selected: boolean;
  warning: string;
}
export function statementDate(value: string, year: number): string {
  let y: number, m: number, d: number;
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const local = value.match(
    /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](20\d{2}|\d{2}))?\b/,
  );
  const named = value.match(
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+(20\d{2}))?\b/i,
  );
  if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else if (named) {
    d = +named[1];
    m =
      [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf(named[2].toLowerCase()) + 1;
    y = named[3] ? +named[3] : year;
  } else if (local) {
    d = +local[1];
    m = +local[2];
    y = local[3] ? (+local[3] < 100 ? 2000 + +local[3] : +local[3]) : year;
  } else return "";
  const result = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return Number.isFinite(Date.parse(result)) &&
    new Date(result + "T12:00Z").toISOString().slice(0, 10) === result
    ? result
    : "";
}
export function parseStatement(text: string, year: number): ImportRow[] {
  const rows: ImportRow[] = [];
  let date = "",
    pending = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Remove amounts before date recognition so a decimal cannot masquerade as a date.
    const dateText = line.replace(
      /(?:RM\s*)?[+−-]?\s*\d[\d,]*\.\d{2}(?!\d)/gi,
      "",
    );
    const found = statementDate(dateText, year);
    if (found) {
      date = found;
      pending = "";
    }
    if (
      /opening balance|closing balance|available balance|total balance|account number|account no|total debit|total credit|total transactions|statement period/i.test(
        line,
      )
    )
      continue;
    const money = [
      ...line.matchAll(/(?:RM\s*)?([+−-]?\s*\d[\d,]*\.\d{2})(?!\d)/gi),
    ];
    if (!money.length) {
      if (
        !/^\s*(date|description|transaction history|transaction date|amount|debit|credit)\s*$/i.test(
          line,
        )
      )
        pending = [pending, line].filter(Boolean).join(" ");
      continue;
    }
    const token = money[0],
      number = Number(token[1].replace(/[,\s−-]/g, ""));
    if (!Number.isFinite(number) || number <= 0) continue;
    let item = [pending, line.slice(0, token.index)]
      .filter(Boolean)
      .join(" ")
      .replace(
        /\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-](?:20\d{2}|\d{2}))?\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+20\d{2})?\b/gi,
        "",
      )
      .replace(/\bRM\b/gi, "")
      .replace(/[+−-]\s*$/, "")
      .trim();
    if (!item) item = "Review transaction";
    const credit =
      /\b(credit|credited|refund|received|salary|interest earned|cashback|CR)\b/i.test(
        line,
      ) ||
      /^\s*\+/.test(token[1]) ||
      /\+\s*RM/i.test(line);
    const warning = [
      !date ? "Date missing" : "",
      credit ? "Possible incoming money — exclude from expenses" : "",
      money.length > 1
        ? "Multiple amounts: verify debit versus running balance"
        : "",
      "Check date, description and debit amount",
    ]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      id: `row-${rows.length}`,
      date,
      item,
      amount: number.toFixed(2),
      category: "Unknown",
      selected: false,
      warning,
    });
    pending = "";
  }
  return rows;
}
export function duplicateExpense(
  row: Pick<ImportRow, "date" | "item" | "amount">,
  existing: FinanceExpense[],
): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return existing.some(
    (e) =>
      e.date === row.date &&
      Math.round(e.amount * 100) === Math.round(Number(row.amount) * 100) &&
      normalize(e.item) === normalize(row.item),
  );
}
