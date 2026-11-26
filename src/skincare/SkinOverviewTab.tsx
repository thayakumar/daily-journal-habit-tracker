import { useMemo, useState } from "react";
import {
  Card,
  Empty,
  Field,
  inputClass,
  secondaryClass,
} from "../workspace/ui";
import { ANGLES, type Angle, type SkincareData, type SkinPhoto } from "./model";
import { SkinPhotoTile } from "./SkinPhotoTile";

export function SkinOverviewTab({
  data,
  onOpenDay,
  onViewPhoto,
}: {
  data: SkincareData;
  onOpenDay: (date: string) => void;
  onViewPhoto: (photo: SkinPhoto) => void;
}) {
  const [angle, setAngle] = useState<Angle | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(9);

  const tracked = useMemo(
    () =>
      [...data.entries]
        .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.entries, from, to],
  );

  const productNameById = useMemo(
    () => new Map(data.products.map((pr) => [pr.id, pr.name])),
    [data.products],
  );

  const doneCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of data.checks) {
      if (c.done) counts.set(c.date, (counts.get(c.date) ?? 0) + 1);
    }
    return counts;
  }, [data.checks]);

  const photoIndex = useMemo(() => {
    const byKey = new Map<string, SkinPhoto>();
    const countByDate = new Map<string, number>();
    for (const ph of data.photos) {
      byKey.set(`${ph.date}:${ph.angle}`, ph);
      countByDate.set(ph.date, (countByDate.get(ph.date) ?? 0) + 1);
    }
    return { byKey, countByDate };
  }, [data.photos]);

  return (
    <div
      role="tabpanel"
      id="skincare-overview"
      aria-labelledby="skin-tab-overview"
      className="space-y-5"
    >
      <Card
        title="My skin over time"
        subtitle="Browse daily notes, products and photos side by side. Photos show your records; the app does not diagnose skin conditions."
      >
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl bg-[#FBECE7] px-4 py-3 font-semibold text-[#A83E20]">
            {data.entries.length} tracked days
          </span>
          <span className="rounded-xl bg-sky-50 px-4 py-3 font-semibold text-sky-700">
            {data.photos.length} photos
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Photos from">
            <input
              className={inputClass}
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setLimit(9);
              }}
            />
          </Field>
          <Field label="Photos to">
            <input
              className={inputClass}
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setLimit(9);
              }}
            />
          </Field>
          <Field label="Photo angle">
            <select
              aria-label="Photo angle"
              className={inputClass}
              value={angle}
              onChange={(e) => setAngle(e.target.value as Angle | "all")}
            >
              <option value="all">All angles</option>
              {ANGLES.map((a) => (
                <option key={a} value={a}>
                  {a[0].toUpperCase() + a.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-[#62584E]">
          Newest days first. Select one angle to compare a consistent view
          across dates.
        </p>
      </Card>
      {!tracked.length ? (
        <Empty>
          No tracked days in this range yet. Start with a journal entry or
          routine check.
        </Empty>
      ) : (
        tracked.slice(0, limit).map((entry) => (
          <Card
            key={entry.id}
            title={new Date(entry.date + "T12:00").toLocaleDateString("en-MY", {
              weekday: "short",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            subtitle={`${doneCountByDate.get(entry.date) ?? 0} routine steps completed · ${photoIndex.countByDate.get(entry.date) ?? 0}/3 photos`}
            action={
              <button
                type="button"
                className={secondaryClass}
                onClick={() => onOpenDay(entry.date)}
              >
                Open day
              </button>
            }
          >
            <div
              className={`grid gap-3 ${angle === "all" ? "grid-cols-1 sm:grid-cols-3" : "mx-auto max-w-sm grid-cols-1"}`}
            >
              {(angle === "all" ? ANGLES : [angle]).map((a) => (
                <div key={a} className="min-w-0">
                  <p className="mb-2 text-center text-xs font-semibold capitalize text-[#62584E]">
                    {a}
                  </p>
                  <SkinPhotoTile
                    photo={photoIndex.byKey.get(`${entry.date}:${a}`)}
                    onOpen={onViewPhoto}
                  />
                </div>
              ))}
            </div>
            {entry.notes && (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm text-[#62584E]">
                <strong>Routine: </strong>
                {entry.notes}
              </p>
            )}
            {entry.reaction && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-[#62584E]">
                <strong>Reaction: </strong>
                {entry.reaction}
              </p>
            )}
            {entry.productIds.length > 0 && (
              <p className="mt-3 break-words text-xs text-[#62584E]">
                Products:{" "}
                {entry.productIds
                  .map((id) => productNameById.get(id) ?? "Product")
                  .join(" · ")}
              </p>
            )}
          </Card>
        ))
      )}
      {tracked.length > limit && (
        <button
          type="button"
          className={secondaryClass}
          onClick={() => setLimit((n) => n + 9)}
        >
          Show more days
        </button>
      )}
    </div>
  );
}
