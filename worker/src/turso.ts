export type SqlArg = string | number | boolean | null | undefined;

export interface SqlStatement {
  sql: string;
  args?: SqlArg[];
}

export interface SqlResult {
  columns: string[];
  rows: Record<string, string | number | null>[];
  affectedRowCount: number;
}

interface HranaValue {
  type: "null" | "integer" | "float" | "text" | "blob";
  value?: string | number;
  base64?: string;
}

interface HranaResultItem {
  type: "ok" | "error";
  response?: {
    type: string;
    result?: {
      cols: Array<{ name: string | null }>;
      rows: HranaValue[][];
      affected_row_count?: number;
    };
  };
  error?: { message: string; code?: string };
}

function encodeArg(arg: SqlArg): HranaValue {
  if (arg === null || arg === undefined) return { type: "null" };
  if (typeof arg === "boolean") return { type: "integer", value: arg ? "1" : "0" };
  if (typeof arg === "number") {
    if (!Number.isFinite(arg)) return { type: "null" };
    return Number.isInteger(arg)
      ? { type: "integer", value: String(arg) }
      : { type: "float", value: arg };
  }
  return { type: "text", value: String(arg) };
}

function decodeValue(cell: HranaValue): string | number | null {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer") return Number(cell.value);
  if (cell.type === "float") return Number(cell.value);
  if (cell.type === "blob") return cell.base64 ?? "";
  return cell.value !== undefined ? String(cell.value) : "";
}

export function tursoPipelineUrl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim().replace(/\/+$/, "");
  const httpUrl = trimmed.startsWith("libsql://")
    ? `https://${trimmed.slice("libsql://".length)}`
    : trimmed;
  return `${httpUrl}/v2/pipeline`;
}

export class TursoClient {
  private readonly pipelineUrl: string;
  private readonly authToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    databaseUrl: string,
    authToken: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is not configured");
    this.pipelineUrl = tursoPipelineUrl(databaseUrl);
    this.authToken = authToken || "";
    this.fetchImpl = fetchImpl;
  }

  async batch(statements: SqlStatement[]): Promise<SqlResult[]> {
    const requests = [
      ...statements.map((stmt) => ({
        type: "execute" as const,
        stmt: {
          sql: stmt.sql,
          args: (stmt.args ?? []).map(encodeArg),
        },
      })),
      { type: "close" as const },
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const res = await this.fetchImpl(this.pipelineUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Turso HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }

    const body = (await res.json()) as { results?: HranaResultItem[] };
    const items = body.results ?? [];
    const output: SqlResult[] = [];

    for (let i = 0; i < statements.length; i++) {
      const item = items[i];
      if (!item || item.type === "error") {
        throw new Error(item?.error?.message || "Turso query failed");
      }
      const raw = item.response?.result;
      const columns = (raw?.cols ?? []).map((c, idx) => c.name || `col_${idx}`);
      const rows = (raw?.rows ?? []).map((row) => {
        const record: Record<string, string | number | null> = {};
        for (let c = 0; c < columns.length; c++) {
          record[columns[c]] = decodeValue(row[c]);
        }
        return record;
      });
      output.push({
        columns,
        rows,
        affectedRowCount: raw?.affected_row_count ?? 0,
      });
    }

    return output;
  }

  async execute(sql: string, args?: SqlArg[]): Promise<SqlResult> {
    const [result] = await this.batch([{ sql, args }]);
    return result;
  }
}
