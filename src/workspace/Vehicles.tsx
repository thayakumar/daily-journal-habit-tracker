import { useState } from "react";
import { Dialog } from "./Dialog";
import {
  Empty,
  Field,
  Delete,
  SectionHeader,
  inputClass,
  parseNumberInput,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";
import { uid, type Workspace } from "./model";
import { vehicleDue, type Vehicle, type VehicleService } from "./vehicle-model";
export function Vehicles({
  data,
  update,
  today,
  storageReady,
}: {
  data: Workspace;
  update: Update;
  today: string;
  storageReady: boolean;
}) {
  const vehicles = data.vehicles ?? [],
    services = data.vehicleServices ?? [];
  const [draft, setDraft] = useState<Vehicle | null>(null);
  const [service, setService] = useState<VehicleService | null>(null);
  const [nextDate, setNextDate] = useState(""),
    [nextKm, setNextKm] = useState(0);
  const [error, setError] = useState("");
  function add() {
    setDraft({
      id: uid(),
      name: "",
      plate: "",
      insurer: "",
      policy: "",
      roadTaxDue: "",
      insuranceDue: "",
      serviceDue: "",
      odometer: 0,
      serviceAtKm: 0,
      notes: "",
    });
  }
  function log(v: Vehicle) {
    setService({
      id: uid(),
      vehicleId: v.id,
      date: today,
      odometer: v.odometer,
      cost: 0,
      workshop: "",
      details: "",
    });
    setNextDate(v.serviceDue);
    setNextKm(v.serviceAtKm);
    setError("");
  }
  return (
    <div className="min-w-0 space-y-4">
      <SectionHeader
        title="Your fleet"
        count={`${vehicles.length} ${vehicles.length === 1 ? "vehicle" : "vehicles"}`}
        action={
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#D95D39] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition duration-150 hover:bg-[#C04C2B] sm:text-sm"
            onClick={add}
          >
            Add vehicle
          </button>
        }
      />

      {!storageReady && (
        <p
          role="status"
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
        >
          Vehicle records save on this device. Deploy the updated planner script
          to sync Vehicles and VehicleServices tables.
        </p>
      )}

      {!vehicles.length ? (
        <div className="clay-card rounded-2xl p-4">
          <Empty compact asset="vehicles">
            Add your car or motorcycle to start tracking road tax, insurance,
            and service renewals.
          </Empty>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {vehicles.map((v) => {
            const vServices = services
              .filter((s) => s.vehicleId === v.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            const kmPct =
              v.serviceAtKm > 0
                ? Math.min(100, Math.round((v.odometer / v.serviceAtKm) * 100))
                : 0;
            return (
              <article
                key={v.id}
                className="clay-card min-w-0 rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display break-words text-base font-bold text-[#24201D] sm:text-lg">
                        {v.name}
                      </h3>
                      {v.plate && (
                        <span className="rounded-lg border border-[#E7DDD0] bg-[#FAF7F2] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#3B342E]">
                          {v.plate}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium tabular-nums text-[#6E6358]">
                      {v.odometer.toLocaleString()} km
                      {!v.plate ? " · No plate recorded" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-9 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3B342E] hover:bg-[#FAF7F2]"
                    onClick={() => setDraft(v)}
                  >
                    Edit
                  </button>
                  <Delete
                    label={`Delete ${v.name}`}
                    onClick={() => {
                      if (
                        confirm("Delete this vehicle and its service history?")
                      )
                        update((w) => ({
                          ...w,
                          vehicles: (w.vehicles ?? []).filter(
                            (x) => x.id !== v.id,
                          ),
                          vehicleServices: (w.vehicleServices ?? []).filter(
                            (x) => x.vehicleId !== v.id,
                          ),
                        }));
                    }}
                  />
                </div>

                {/* 3-Up Renewal Status Strip */}
                <div className="my-3.5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                  {(
                    [
                      ["Road tax", v.roadTaxDue],
                      ["Insurance", v.insuranceDue],
                      ["Next service", v.serviceDue],
                    ] as const
                  ).map(([label, date]) => {
                    const urgent = Boolean(date && date <= today);
                    return (
                      <div
                        key={label}
                        className={`min-w-0 rounded-xl border p-2.5 text-xs ${
                          urgent
                            ? "border-[#E8B8A9] bg-[#FBECE7] text-[#A83E20]"
                            : "border-[#EFE8DC] bg-[#FAF7F2] text-[#4C433B]"
                        }`}
                      >
                        <p className="text-[11px] font-semibold opacity-80">
                          {label}
                        </p>
                        <p className="mt-1 truncate font-semibold tabular-nums">
                          {date || "Not set"}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] opacity-85">
                          {vehicleDue(date, today)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {!!v.serviceAtKm && (
                  <div className="mb-3 rounded-xl border border-[#EFE8DC] bg-[#FAF7F2]/80 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#355380]">
                      <span>Service at {v.serviceAtKm.toLocaleString()} km</span>
                      <span className="tabular-nums">
                        {v.odometer >= v.serviceAtKm
                          ? "Mileage reached"
                          : `${(v.serviceAtKm - v.odometer).toLocaleString()} km left`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E7DDD0]">
                      <div
                        className={`h-full rounded-full ${v.odometer >= v.serviceAtKm ? "bg-[#D95D39]" : "bg-[#355380]"}`}
                        style={{ width: `${kmPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {(v.insurer || v.policy) && (
                  <p className="mb-2 break-words text-xs text-[#5C5248]">
                    {v.insurer}
                    {v.policy && ` · Policy ${v.policy}`}
                  </p>
                )}
                {v.notes && (
                  <p className="mb-3 whitespace-pre-wrap break-words text-xs text-[#5C5248]">
                    {v.notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DC] pt-3">
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={() => log(v)}
                  >
                    Log service
                  </button>
                  <details className="w-full sm:w-auto sm:flex-1">
                    <summary className="cursor-pointer py-2 text-xs font-semibold text-[#5C5248] hover:text-[#24201D] sm:text-right">
                      Service history ({vServices.length})
                    </summary>
                    <ul className="mt-2.5 space-y-2 text-left">
                      {vServices.map((s) => (
                        <li
                          key={s.id}
                          className="flex gap-2 rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] p-2.5"
                        >
                          <div className="min-w-0 flex-1 break-words text-xs">
                            <strong className="tabular-nums text-[#24201D]">
                              {s.date} · RM {s.cost.toFixed(2)}
                            </strong>
                            <p className="mt-0.5 text-[#5C5248]">
                              {s.odometer.toLocaleString()} km
                              {s.workshop ? ` · ${s.workshop}` : ""}
                            </p>
                            {s.details && (
                              <p className="mt-0.5 text-[#4C433B]">
                                {s.details}
                              </p>
                            )}
                          </div>
                          <Delete
                            label="Delete service record"
                            onClick={() => {
                              if (
                                confirm(
                                  "Delete this service record? Current mileage and next service stay unchanged.",
                                )
                              )
                                update((w) => ({
                                  ...w,
                                  vehicleServices: (
                                    w.vehicleServices ?? []
                                  ).filter((x) => x.id !== s.id),
                                }));
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {draft && (
        <Dialog
          title={
            vehicles.some((v) => v.id === draft.id)
              ? "Edit vehicle"
              : "Add vehicle"
          }
          onClose={() => setDraft(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const cleanName = draft.name.trim();
              if (!cleanName) {
                setError("Vehicle name cannot be empty.");
                return;
              }
              setError("");
              update((w) => ({
                ...w,
                vehicles: [
                  ...(w.vehicles ?? []).filter((v) => v.id !== draft.id),
                  {
                    ...draft,
                    name: cleanName,
                    odometer:
                      Number.isFinite(draft.odometer) && draft.odometer >= 0
                        ? draft.odometer
                        : 0,
                    serviceAtKm:
                      Number.isFinite(draft.serviceAtKm) &&
                      draft.serviceAtKm >= 0
                        ? draft.serviceAtKm
                        : 0,
                  },
                ],
              }));
              setDraft(null);
            }}
          >
            {(
              [
                "name",
                "plate",
                "insurer",
                "policy",
                "roadTaxDue",
                "insuranceDue",
                "serviceDue",
                "odometer",
                "serviceAtKm",
                "notes",
              ] as const
            ).map((key) => (
              <Field
                key={key}
                label={
                  {
                    name: "Vehicle name",
                    plate: "Registration plate",
                    insurer: "Insurer",
                    policy: "Policy reference",
                    roadTaxDue: "Road tax expiry",
                    insuranceDue: "Insurance expiry",
                    serviceDue: "Next service date",
                    odometer: "Current odometer (km)",
                    serviceAtKm: "Next service mileage (km; 0 if unset)",
                    notes: "Notes",
                  }[key]
                }
              >
                <input
                  className={inputClass}
                  required={key === "name"}
                  maxLength={500}
                  type={
                    key.endsWith("Due")
                      ? "date"
                      : key === "odometer" || key === "serviceAtKm"
                        ? "number"
                        : "text"
                  }
                  min={0}
                  step={1}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]:
                        key === "odometer" || key === "serviceAtKm"
                          ? parseNumberInput(e.target.value, 0)
                          : e.target.value,
                    })
                  }
                />
              </Field>
            ))}
            <button type="submit" className={primaryClass}>
              Save vehicle
            </button>
          </form>
        </Dialog>
      )}
      {service && (
        <Dialog title="Log vehicle service" onClose={() => setService(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (service.date > today) {
                setError("Service history cannot be in the future.");
                return;
              }
              setError("");
              let missingVehicle = false;
              update((w) => {
                const target = (w.vehicles ?? []).find(
                  (v) => v.id === service.vehicleId,
                );
                if (!target) {
                  missingVehicle = true;
                  return w;
                }
                const cleanService = {
                  ...service,
                  odometer:
                    Number.isFinite(service.odometer) && service.odometer >= 0
                      ? service.odometer
                      : 0,
                  cost:
                    Number.isFinite(service.cost) && service.cost >= 0
                      ? service.cost
                      : 0,
                };
                return {
                  ...w,
                  vehicleServices: [...(w.vehicleServices ?? []), cleanService],
                  vehicles: (w.vehicles ?? []).map((x) =>
                    x.id === target.id
                      ? {
                          ...x,
                          odometer: Math.max(x.odometer, cleanService.odometer),
                          serviceDue: nextDate,
                          serviceAtKm: nextKm,
                        }
                      : x,
                  ),
                };
              });
              if (missingVehicle) {
                setError("That vehicle was deleted on another device.");
              }
              setService(null);
            }}
          >
            {(["date", "odometer", "cost", "workshop", "details"] as const).map(
              (key) => (
                <Field
                  key={key}
                  label={
                    {
                      date: "Service date",
                      odometer: "Odometer (km)",
                      cost: "Cost (RM)",
                      workshop: "Workshop",
                      details: "Work completed",
                    }[key]
                  }
                >
                  <input
                    className={inputClass}
                    required={key === "date" || key === "details"}
                    type={
                      key === "date"
                        ? "date"
                        : key === "cost" || key === "odometer"
                          ? "number"
                          : "text"
                    }
                    min={0}
                    max={key === "date" ? today : undefined}
                    step={key === "cost" ? "0.01" : 1}
                    value={service[key]}
                    onChange={(e) =>
                      setService({
                        ...service,
                        [key]:
                          key === "cost" || key === "odometer"
                            ? parseNumberInput(e.target.value, 0)
                            : e.target.value,
                      })
                    }
                  />
                </Field>
              ),
            )}
            <Field label="Next service date">
              <input
                className={inputClass}
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </Field>
            <Field label="Next service mileage (km)">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={nextKm}
                onChange={(e) =>
                  setNextKm(parseNumberInput(e.target.value, 0))
                }
              />
            </Field>
            {error && <p role="alert">{error}</p>}
            <button type="submit" className={primaryClass}>
              Save service
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
