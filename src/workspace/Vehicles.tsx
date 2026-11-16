import { useState } from "react";
import { Dialog } from "./Dialog";
import {
  Card,
  Empty,
  Field,
  Delete,
  inputClass,
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
    <div className="min-w-0 space-y-5">
      <Card
        title="Your vehicles"
        subtitle="Road tax, insurance renewals and service history, together."
        action={
          <button className={primaryClass} onClick={add}>
            Add vehicle
          </button>
        }
      >
        {!storageReady && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            Vehicle records save on this device. Deploy the updated planner
            script to sync Vehicles and VehicleServices tables.
          </p>
        )}
        {!vehicles.length ? (
          <Empty>Add your car or motorcycle to start tracking renewals.</Empty>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {vehicles.map((v) => (
              <article
                key={v.id}
                className="min-w-0 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-lg font-semibold">
                      {v.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {v.plate || "No plate recorded"} ·{" "}
                      {v.odometer.toLocaleString()} km
                    </p>
                  </div>
                  <button
                    className={secondaryClass}
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
                <div className="my-4 grid gap-2">
                  {(
                    [
                      ["Road tax", v.roadTaxDue],
                      ["Insurance", v.insuranceDue],
                      ["Next service", v.serviceDue],
                    ] as const
                  ).map(([label, date]) => (
                    <div
                      key={label}
                      className={`flex flex-wrap justify-between gap-2 rounded-xl p-3 text-sm ${date && date <= today ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}
                    >
                      <strong>{label}</strong>
                      <span>
                        {date || "Not set"} · {vehicleDue(date, today)}
                      </span>
                    </div>
                  ))}
                </div>
                {!!v.serviceAtKm && (
                  <p className="mb-3 text-sm font-medium text-violet-700">
                    Service at {v.serviceAtKm.toLocaleString()} km ·{" "}
                    {v.odometer >= v.serviceAtKm
                      ? "Mileage reached"
                      : `${(v.serviceAtKm - v.odometer).toLocaleString()} km remaining`}
                  </p>
                )}
                <p className="break-words text-sm text-slate-500">
                  {v.insurer}
                  {v.policy && ` · Policy ${v.policy}`}
                </p>
                <p className="my-3 whitespace-pre-wrap break-words text-sm text-slate-500">
                  {v.notes}
                </p>
                <button className={secondaryClass} onClick={() => log(v)}>
                  Log service
                </button>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Service history (
                    {services.filter((s) => s.vehicleId === v.id).length})
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {services
                      .filter((s) => s.vehicleId === v.id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((s) => (
                        <li
                          key={s.id}
                          className="flex gap-2 rounded-xl bg-slate-50 p-3"
                        >
                          <div className="min-w-0 flex-1 break-words text-sm">
                            <strong>
                              {s.date} · RM {s.cost.toFixed(2)}
                            </strong>
                            <p>
                              {s.odometer.toLocaleString()} km · {s.workshop}
                            </p>
                            <p>{s.details}</p>
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
              </article>
            ))}
          </div>
        )}
      </Card>
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
              update((w) => ({
                ...w,
                vehicles: [
                  ...(w.vehicles ?? []).filter((v) => v.id !== draft.id),
                  { ...draft, name: draft.name.trim() },
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
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              </Field>
            ))}
            <button className={primaryClass}>Save vehicle</button>
          </form>
        </Dialog>
      )}
      {service && (
        <Dialog title="Log vehicle service" onClose={() => setService(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const v = vehicles.find((v) => v.id === service.vehicleId);
              if (service.date > today) {
                setError("Service history cannot be in the future.");
                return;
              }
              update((w) => ({
                ...w,
                vehicleServices: [...(w.vehicleServices ?? []), service],
                vehicles: (w.vehicles ?? []).map((x) =>
                  x.id === v?.id
                    ? {
                        ...x,
                        odometer: Math.max(x.odometer, service.odometer),
                        serviceDue: nextDate,
                        serviceAtKm: nextKm,
                      }
                    : x,
                ),
              }));
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
                            ? Number(e.target.value)
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
                onChange={(e) => setNextKm(Number(e.target.value))}
              />
            </Field>
            {error && <p role="alert">{error}</p>}
            <button className={primaryClass}>Save service</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
