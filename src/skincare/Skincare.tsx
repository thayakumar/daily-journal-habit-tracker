import { useEffect, useRef, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Camera, Pencil } from "lucide-react";
import {
  Card,
  Empty,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "../workspace/ui";
import { Dialog } from "../workspace/Dialog";
import { addDays, uid, type Workspace } from "../workspace/model";
import {
  ANGLES,
  emptySkincare,
  putSkinDay,
  starterSkinHabits,
  type Angle,
  type SkincareData,
  type SkinPhoto,
  type SkinProduct,
  type SkinHabit,
} from "./model";
import { cachedSkinPhoto, loadSkinPhoto, uploadSkinPhoto } from "./photos";

function Photo({
  photo,
  onOpen,
}: {
  photo?: SkinPhoto;
  onOpen?: (p: SkinPhoto) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null),
    [failed, setFailed] = useState(""),
    [attempt, setAttempt] = useState(0);
  const url = photo
    ? cachedSkinPhoto(photo.fileId) ||
      (loaded?.id === photo.fileId ? loaded.url : "")
    : "";
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    setFailed("");
    const run = () => {
      void loadSkinPhoto(photo.fileId)
        .then((value) => {
          if (!cancelled) setLoaded({ id: photo.fileId, url: value });
        })
        .catch((e) => {
          if (!cancelled)
            setFailed(e instanceof Error ? e.message : "Photo unavailable");
        });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          run();
        }
      },
      { rootMargin: "150px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [photo?.fileId, attempt]);
  return (
    <div
      ref={ref}
      className="flex aspect-[3/4] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-[#EAE2D6] bg-[#FAF7F2]"
    >
      {!photo ? (
        <div className="p-3 text-center text-xs text-[#8C8073]">
          <Camera className="mx-auto mb-2 h-6 w-6" />
          No photo
        </div>
      ) : url ? (
        <button
          type="button"
          aria-label={`View ${photo.angle} photo for ${photo.date}`}
          className="h-full w-full"
          onClick={() => onOpen?.(photo)}
        >
          <img
            src={url}
            alt={`${photo.angle} view · ${photo.date}`}
            className="h-full w-full object-contain"
          />
        </button>
      ) : failed ? (
        <div className="p-3 text-center">
          <p className="text-xs text-[#62584E]">
            Photo could not load. It may still be syncing.
          </p>
          <button
            className={`${secondaryClass} mt-2`}
            onClick={() => {
              setFailed("");
              setAttempt((n) => n + 1);
            }}
          >
            Retry photo
          </button>
        </div>
      ) : (
        <p role="status" className="text-xs text-[#8C8073]">
          Loading photo…
        </p>
      )}
    </div>
  );
}
function ProductEditor({
  product,
  onSave,
  onClose,
}: {
  product: SkinProduct;
  onSave: (p: SkinProduct) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(product),
    [error, setError] = useState("");
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
        <button className={primaryClass}>Save product</button>
      </form>
    </Dialog>
  );
}
function HabitEditor({
  habit,
  onSave,
  onClose,
}: {
  habit: SkinHabit;
  onSave: (h: SkinHabit) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState(habit),
    [error, setError] = useState("");
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
        <button className={primaryClass}>Save habit</button>
      </form>
    </Dialog>
  );
}
export default function Skincare({
  data,
  update,
  today,
  storageReady,
  photoReady = false,
}: {
  data: Workspace;
  update: Update;
  today: string;
  storageReady: boolean;
  photoReady?: boolean;
}) {
  const p = data.skincare ?? emptySkincare(),
    [tab, setTab] = useState<"tracker" | "products" | "overview">("tracker"),
    [date, setDate] = useState(today),
    [product, setProduct] = useState<SkinProduct | null>(null),
    [habit, setHabit] = useState<SkinHabit | null>(null),
    [viewPhoto, setViewPhoto] = useState<SkinPhoto | null>(null),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [angle, setAngle] = useState<Angle | "all">("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [limit, setLimit] = useState(9),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function change(fn: (s: SkincareData) => SkincareData) {
    update((w) => ({ ...w, skincare: fn(w.skincare ?? emptySkincare()) }));
  }
  const day = p.entries.find((e) => e.date === date),
    dayChecks = p.checks.filter((c) => c.date === date),
    visibleHabits = p.habits.filter(
      (h) =>
        (h.active && h.createdAt.slice(0, 10) <= date) ||
        dayChecks.some((c) => c.habitId === h.id),
    ),
    products = p.products.filter(
      (pr) => pr.active || day?.productIds.includes(pr.id),
    );
  function patchDay(patch: Parameters<typeof putSkinDay>[2]) {
    change((s) => putSkinDay(s, date, patch));
    setNotice(
      "Saved on this device · notes and routine changes sync automatically.",
    );
  }
  function newProduct() {
    setProduct({
      id: uid(),
      name: "",
      brand: "",
      type: "",
      notes: "",
      started: date,
      stopped: "",
      active: true,
    });
  }
  async function upload(file: File, side: Angle) {
    const uploadDate = date;
    setBusy(side);
    setError("");
    setNotice("");
    try {
      const photo = await uploadSkinPhoto(file, uploadDate, side);
      change((s) => {
        const next = putSkinDay(s, uploadDate);
        return {
          ...next,
          photos: [
            ...next.photos.filter(
              (ph) => !(ph.date === uploadDate && ph.angle === side),
            ),
            photo,
          ],
        };
      });
      if (mounted.current)
        setNotice(
          `Uploaded ${side} photo for ${uploadDate}. It will appear across devices after the planner sync finishes.`,
        );
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  const tracked = [...p.entries]
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="min-w-0 space-y-5 break-words">
      <Card
        title="Your skincare journal"
        subtitle="A daily record of your routine, products and how your skin feels."
      >
        <div
          role="tablist"
          aria-label="Skincare modules"
          className="flex flex-wrap gap-2"
        >
          {(["tracker", "products", "overview"] as const).map((t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              aria-controls={`skincare-${t}`}
              id={`skin-tab-${t}`}
              key={t}
              className={`${tab === t ? "bg-[#D95D39] text-white" : "bg-[#FAF7F2] text-[#62584E]"} min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold`}
              onClick={() => {
                setTab(t);
                setError("");
              }}
            >
              {t === "tracker"
                ? "Daily tracker"
                : t === "products"
                  ? "My products"
                  : "Photo overview"}
            </button>
          ))}
        </div>
        {!storageReady && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            Notes, products and habits save on this device. Deploy the updated
            planner script to sync Skincare tables and enable photo uploads.
          </p>
        )}
      </Card>
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
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
      {tab === "tracker" && (
        <div
          role="tabpanel"
          id="skincare-tracker"
          aria-labelledby="skin-tab-tracker"
          className="space-y-5"
        >
          <Card
            title="Daily face journal"
            subtitle="Write what you applied and how your skin reacted. Changes save automatically as you type."
          >
            <div className="mb-5 flex flex-wrap items-end gap-2">
              <button
                className={secondaryClass}
                aria-label="Previous skincare day"
                onClick={() => setDate(addDays(date, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Field label="Journal date">
                <input
                  type="date"
                  required
                  className={inputClass}
                  max={today}
                  value={date}
                  onChange={(e) => {
                    if (e.target.value && e.target.value <= today)
                      setDate(e.target.value);
                    setNotice("");
                  }}
                />
              </Field>
              <button
                disabled={date >= today}
                className={secondaryClass}
                aria-label="Next skincare day"
                onClick={() => setDate(addDays(date, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className={secondaryClass} onClick={() => setDate(today)}>
                Today
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="What I applied / daily notes">
                <textarea
                  aria-label="What I applied / daily notes"
                  className={inputClass}
                  rows={6}
                  maxLength={10000}
                  value={day?.notes ?? ""}
                  placeholder="Morning and evening routine, changes, or anything you want to remember…"
                  onChange={(e) => patchDay({ notes: e.target.value })}
                />
              </Field>
              <Field label="How my skin reacted">
                <textarea
                  aria-label="How my skin reacted"
                  className={inputClass}
                  rows={6}
                  maxLength={10000}
                  value={day?.reaction ?? ""}
                  placeholder="Dryness, oiliness, redness, irritation, breakouts, or feeling comfortable…"
                  onChange={(e) => patchDay({ reaction: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-5">
              <h3 className="mb-3 text-sm font-semibold">
                Products used on this day
              </h3>
              {products.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {products.map((pr) => (
                    <label
                      key={pr.id}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-[#EAE2D6] p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={day?.productIds.includes(pr.id) ?? false}
                        onChange={(e) =>
                          patchDay({
                            productIds: e.target.checked
                              ? [...(day?.productIds ?? []), pr.id]
                              : (day?.productIds ?? []).filter(
                                  (id) => id !== pr.id,
                                ),
                          })
                        }
                      />
                      <span>
                        {pr.name}
                        {pr.brand && ` · ${pr.brand}`}
                        {!pr.active && " · archived"}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#62584E]">
                  Add your products to choose what you used each day.
                </p>
              )}
              <button className={`${secondaryClass} mt-3`} onClick={newProduct}>
                <Plus className="h-4 w-4" />
                Add product
              </button>
            </div>
            {!day && (
              <button
                className={`${primaryClass} mt-5`}
                onClick={() => patchDay({})}
              >
                Save this day
              </button>
            )}
          </Card>
          <Card
            title="My skincare routine"
            subtitle="Your skincare habits are separate from the general Habits page. Add, edit or archive steps whenever you need."
            action={
              <button
                className={primaryClass}
                onClick={() =>
                  setHabit({
                    id: uid(),
                    name: "",
                    period: "AM",
                    active: true,
                    createdAt: date + "T12:00:00Z",
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add skincare habit
              </button>
            }
          >
            {!p.habits.length ? (
              <Empty>
                <span>
                  Start with cleanser, moisturiser and morning sunscreen, or add
                  your own steps.
                </span>
                <button
                  className={`${secondaryClass} mt-2`}
                  onClick={() =>
                    change((s) => ({
                      ...s,
                      habits: starterSkinHabits().map((h) => ({
                        ...h,
                        createdAt: date + "T12:00:00Z",
                      })),
                    }))
                  }
                >
                  Use starter routine
                </button>
              </Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {(["AM", "PM", "Anytime"] as const).map((period) => (
                  <div
                    key={period}
                    className="min-w-0 rounded-2xl bg-[#FAF7F2] p-3"
                  >
                    <h3 className="mb-3 font-semibold">
                      {period === "AM"
                        ? "Morning"
                        : period === "PM"
                          ? "Evening"
                          : "Anytime"}
                    </h3>
                    {visibleHabits
                      .filter((h) => h.period === period)
                      .map((h) => (
                        <div
                          key={h.id}
                          className="mb-2 flex items-center gap-2 rounded-xl border border-[#EFE8DC] bg-white p-2"
                        >
                          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              checked={dayChecks.some(
                                (c) => c.habitId === h.id && c.done,
                              )}
                              onChange={(e) => {
                                const done = e.target.checked;
                                change((s) => {
                                  const next = putSkinDay(s, date);
                                  return {
                                    ...next,
                                    checks: [
                                      ...next.checks.filter(
                                        (c) =>
                                          !(
                                            c.date === date &&
                                            c.habitId === h.id
                                          ),
                                      ),
                                      {
                                        id: `skin-check:${date}:${h.id}`,
                                        date,
                                        habitId: h.id,
                                        done,
                                      },
                                    ],
                                  };
                                });
                              }}
                            />
                            <span className="break-words">
                              {h.name}
                              {!h.active && " · archived"}
                            </span>
                          </label>
                          <button
                            aria-label={`Edit skincare habit ${h.name} ${h.period}`}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#62584E]"
                            onClick={() => setHabit(h)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
            {p.habits.some((h) => !h.active) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-[#62584E]">
                  Archived routine steps
                </summary>
                {p.habits
                  .filter((h) => !h.active)
                  .map((h) => (
                    <button
                      key={h.id}
                      className={`${secondaryClass} mr-2 mt-2`}
                      onClick={() => setHabit(h)}
                    >
                      {h.name} · {h.period}
                    </button>
                  ))}
              </details>
            )}
          </Card>
          <Card
            title="Daily progress photos"
            subtitle={`Front, left and right views for ${date}. Photos are resized for the gallery and saved privately in your Skincare Drive folder.`}
          >
            <p className="mb-4 text-xs text-[#62584E]">
              Use similar lighting, distance and angles so your photos are
              easier to compare. Uploading a replacement changes this day’s
              journal photo; original files stay in Drive.
            </p>
            {!photoReady && (
              <p
                role="status"
                className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
              >
                Photo uploads need the latest Apps Script deployment. No photo
                key or device connection is required.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ANGLES.map((side) => {
                const photo = p.photos.find(
                  (ph) => ph.date === date && ph.angle === side,
                );
                return (
                  <div key={side} className="min-w-0">
                    <h3 className="mb-2 font-semibold capitalize">{side}</h3>
                    <Photo photo={photo} onOpen={setViewPhoto} />
                    <label
                      className={`mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[#EAE2D6] px-3 py-2 text-sm font-semibold ${!photoReady || busy ? "cursor-not-allowed bg-[#F3EDE3] text-[#8C8073]" : "text-[#62584E] hover:bg-[#FAF7F2]"}`}
                    >
                      <input
                        aria-label={`Upload ${side} skincare photo`}
                        type="file"
                        className="sr-only"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!photoReady || !!busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void upload(file, side);
                        }}
                      />
                      {busy === side
                        ? "Uploading…"
                        : photo
                          ? "Replace photo"
                          : "Upload photo"}
                    </label>
                    {photo && (
                      <button
                        className="mt-2 min-h-11 w-full rounded-xl text-sm text-[#D95D39]"
                        disabled={!!busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Remove the ${side} photo from ${date}? The original file stays in Drive.`,
                            )
                          )
                            change((s) => ({
                              ...s,
                              photos: s.photos.filter(
                                (ph) => ph.id !== photo.id,
                              ),
                            }));
                        }}
                      >
                        Remove from journal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
          {day && (
            <button
              className={secondaryClass}
              disabled={!!busy}
              onClick={() => {
                if (
                  confirm(
                    `Delete the journal, checks and photo links for ${date}? Products, routine steps and original Drive photos stay available.`,
                  )
                ) {
                  change((s) => ({
                    ...s,
                    entries: s.entries.filter((e) => e.date !== date),
                    checks: s.checks.filter((c) => c.date !== date),
                    photos: s.photos.filter((ph) => ph.date !== date),
                  }));
                  setNotice(
                    "Journal day removed. Original photos remain in Drive.",
                  );
                }
              }}
            >
              Delete this journal day
            </button>
          )}
        </div>
      )}
      {tab === "products" && (
        <div
          role="tabpanel"
          id="skincare-products"
          aria-labelledby="skin-tab-products"
        >
          <Card
            title="Products I’m using"
            subtitle="Keep product details and dates together. Archiving preserves products on your past journal entries."
            action={
              <button className={primaryClass} onClick={newProduct}>
                <Plus className="h-4 w-4" />
                Add product
              </button>
            }
          >
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <Field label="Search skincare products">
                <input
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
              {p.products
                .filter(
                  (pr) =>
                    (archived || pr.active) &&
                    `${pr.name} ${pr.brand} ${pr.type}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((pr) => (
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
                        className={secondaryClass}
                        onClick={() => setProduct(pr)}
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
                      className={`${secondaryClass} mt-4`}
                      onClick={() =>
                        change((s) => ({
                          ...s,
                          products: s.products.map((x) =>
                            x.id === pr.id ? { ...x, active: !x.active } : x,
                          ),
                        }))
                      }
                    >
                      {pr.active ? "Archive product" : "Use again"}
                    </button>
                  </article>
                ))}
            </div>
            {!p.products.length && (
              <Empty>
                Add your cleanser, moisturiser, sunscreen and other products.
              </Empty>
            )}
          </Card>
        </div>
      )}
      {tab === "overview" && (
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
                {p.entries.length} tracked days
              </span>
              <span className="rounded-xl bg-sky-50 px-4 py-3 font-semibold text-sky-700">
                {p.photos.length} photos
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
                title={new Date(entry.date + "T12:00").toLocaleDateString(
                  "en-MY",
                  {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                )}
                subtitle={`${p.checks.filter((c) => c.date === entry.date && c.done).length} routine steps completed · ${p.photos.filter((ph) => ph.date === entry.date).length}/3 photos`}
                action={
                  <button
                    className={secondaryClass}
                    onClick={() => {
                      setDate(entry.date);
                      setTab("tracker");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Open day
                  </button>
                }
              >
                <div
                  className={`grid gap-3 ${angle === "all" ? "grid-cols-3" : "mx-auto max-w-sm grid-cols-1"}`}
                >
                  {(angle === "all" ? ANGLES : [angle]).map((a) => (
                    <div key={a} className="min-w-0">
                      <p className="mb-2 text-center text-xs font-semibold capitalize text-[#62584E]">
                        {a}
                      </p>
                      <Photo
                        photo={p.photos.find(
                          (ph) => ph.date === entry.date && ph.angle === a,
                        )}
                        onOpen={setViewPhoto}
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
                      .map(
                        (id) =>
                          p.products.find((pr) => pr.id === id)?.name ??
                          "Product",
                      )
                      .join(" · ")}
                  </p>
                )}
              </Card>
            ))
          )}
          {tracked.length > limit && (
            <button
              className={secondaryClass}
              onClick={() => setLimit((n) => n + 9)}
            >
              Show more days
            </button>
          )}
        </div>
      )}
      {product && (
        <ProductEditor
          key={product.id}
          product={product}
          onClose={() => setProduct(null)}
          onSave={(pr) => {
            change((s) => ({
              ...s,
              products: [...s.products.filter((x) => x.id !== pr.id), pr],
            }));
            setProduct(null);
            setNotice("Product saved.");
          }}
        />
      )}
      {habit && (
        <HabitEditor
          key={habit.id}
          habit={habit}
          onClose={() => setHabit(null)}
          onSave={(h) => {
            change((s) => ({
              ...s,
              habits: [...s.habits.filter((x) => x.id !== h.id), h],
            }));
            setHabit(null);
            setNotice("Routine step saved.");
          }}
        />
      )}
      {viewPhoto && (
        <Dialog
          wide
          title={`${viewPhoto.angle[0].toUpperCase() + viewPhoto.angle.slice(1)} photo · ${viewPhoto.date}`}
          onClose={() => setViewPhoto(null)}
        >
          <div className="mx-auto max-w-md">
            <Photo photo={viewPhoto} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
