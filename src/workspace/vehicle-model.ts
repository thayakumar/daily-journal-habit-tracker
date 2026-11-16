export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  insurer: string;
  policy: string;
  roadTaxDue: string;
  insuranceDue: string;
  serviceDue: string;
  odometer: number;
  serviceAtKm: number;
  notes: string;
}
export interface VehicleService {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  cost: number;
  workshop: string;
  details: string;
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const date = (v: unknown) =>
  typeof v === "string" &&
  (!v ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v + "T12:00Z").toISOString().slice(0, 10) === v));
export function validVehicles(vehicles: unknown, services: unknown): boolean {
  if (!Array.isArray(vehicles) || !Array.isArray(services)) return false;
  const ids = new Set<string>();
  if (
    !vehicles.every((v) => {
      if (!obj(v) || typeof v.id !== "string" || !v.id || ids.has(v.id))
        return false;
      ids.add(v.id);
      return (
        ["name", "plate", "insurer", "policy", "notes"].every(
          (k) => typeof v[k] === "string",
        ) &&
        !!String(v.name).trim() &&
        ["roadTaxDue", "insuranceDue", "serviceDue"].every((k) => date(v[k])) &&
        ["odometer", "serviceAtKm"].every(
          (k) =>
            typeof v[k] === "number" &&
            Number.isFinite(v[k]) &&
            Number(v[k]) >= 0,
        )
      );
    })
  )
    return false;
  const seen = new Set<string>();
  return services.every((s) => {
    if (!obj(s) || typeof s.id !== "string" || !s.id || seen.has(s.id))
      return false;
    seen.add(s.id);
    return (
      ids.has(String(s.vehicleId)) &&
      !!s.date &&
      date(s.date) &&
      ["workshop", "details"].every((k) => typeof s[k] === "string") &&
      ["odometer", "cost"].every(
        (k) =>
          typeof s[k] === "number" &&
          Number.isFinite(s[k]) &&
          Number(s[k]) >= 0,
      )
    );
  });
}
export function vehicleDue(date: string, today: string) {
  if (!date) return "Not set";
  const days = Math.round(
    (Date.parse(date + "T12:00Z") - Date.parse(today + "T12:00Z")) / 86400000,
  );
  return days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0
      ? "Due today"
      : `In ${days} days`;
}
