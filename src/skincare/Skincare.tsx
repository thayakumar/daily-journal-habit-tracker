import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
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
import { uploadSkinPhoto } from "./photos";
import { SkinPhotoTile } from "./SkinPhotoTile";
import { HabitEditor, ProductEditor } from "./SkinEditors";
import { SkinProductsTab } from "./SkinProductsTab";
import { SkinOverviewTab } from "./SkinOverviewTab";

export default function Skincare({
  data,
  update,
  today,
  storageReady,
  photoReady = false,
  onSync,
}: {
  data: Workspace;
  update: Update;
  today: string;
  storageReady: boolean;
  photoReady?: boolean;
  onSync?: () => void;
}) {
  const p = data.skincare ?? emptySkincare();
  const [tab, setTab] = useState<"tracker" | "products" | "overview">(
    "tracker",
  );
  const [date, setDate] = useState(today);
  const [product, setProduct] = useState<SkinProduct | null>(null);
  const [habit, setHabit] = useState<SkinHabit | null>(null);
  const [viewPhoto, setViewPhoto] = useState<SkinPhoto | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const mounted = useRef(true);
  const prevToday = useRef(today);
  useEffect(() => {
    if (prevToday.current !== today) {
      if (date === prevToday.current) setDate(today);
      prevToday.current = today;
    }
  }, [today, date]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function change(fn: (s: SkincareData) => SkincareData) {
    update((w) => ({ ...w, skincare: fn(w.skincare ?? emptySkincare()) }));
  }

  const day = p.entries.find((e) => e.date === date);
  const dayProductIds = useMemo(
    () => new Set(day?.productIds ?? []),
    [day?.productIds],
  );
  const dayChecks = useMemo(
    () => p.checks.filter((c) => c.date === date),
    [p.checks, date],
  );
  const dayCheckHabitIds = useMemo(
    () => new Set(dayChecks.map((c) => c.habitId)),
    [dayChecks],
  );
  const doneHabitIds = useMemo(
    () => new Set(dayChecks.filter((c) => c.done).map((c) => c.habitId)),
    [dayChecks],
  );
  const visibleHabits = useMemo(
    () =>
      p.habits.filter(
        (h) =>
          (h.active && h.createdAt.slice(0, 10) <= date) ||
          dayCheckHabitIds.has(h.id),
      ),
    [p.habits, date, dayCheckHabitIds],
  );
  const products = useMemo(
    () => p.products.filter((pr) => pr.active || dayProductIds.has(pr.id)),
    [p.products, dayProductIds],
  );
  const dayPhotoByAngle = useMemo(() => {
    const map = new Map<Angle, SkinPhoto>();
    for (const ph of p.photos) {
      if (ph.date === date) map.set(ph.angle, ph);
    }
    return map;
  }, [p.photos, date]);

  const [notesDraft, setNotesDraft] = useState(day?.notes ?? "");
  const [reactionDraft, setReactionDraft] = useState(day?.reaction ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!notesTimer.current) setNotesDraft(day?.notes ?? "");
  }, [date, day?.notes]);
  useEffect(() => {
    if (!reactionTimer.current) setReactionDraft(day?.reaction ?? "");
  }, [date, day?.reaction]);
  useEffect(
    () => () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    },
    [],
  );

  function patchDay(
    patch: Parameters<typeof putSkinDay>[2],
    targetDate = date,
  ) {
    change((s) => putSkinDay(s, targetDate, patch));
    setNotice(
      "Saved on this device · notes and routine changes sync automatically.",
    );
  }
  function flushTextDrafts() {
    if (notesTimer.current) {
      clearTimeout(notesTimer.current);
      notesTimer.current = null;
      if (notesDraft !== (day?.notes ?? "")) patchDay({ notes: notesDraft });
    }
    if (reactionTimer.current) {
      clearTimeout(reactionTimer.current);
      reactionTimer.current = null;
      if (reactionDraft !== (day?.reaction ?? ""))
        patchDay({ reaction: reactionDraft });
    }
  }
  function switchDate(nextDate: string) {
    flushTextDrafts();
    setDate(nextDate);
    setNotice("");
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
      onSync?.();
      if (mounted.current)
        setNotice(
          `Uploaded ${side} photo for ${uploadDate} and started Sheet sync.`,
        );
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      if (mounted.current) setBusy("");
    }
  }

  return (
    <div className="min-w-0 space-y-4 break-words">
      {/* Flush Top 3-Tab Underline Navigation Bar */}
      <div className="border-b border-[#E7DDD0]">
        <div
          role="tablist"
          aria-label="Skincare modules"
          className="grid grid-cols-3 sm:inline-flex sm:gap-1"
        >
          {(["tracker", "products", "overview"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`skincare-${t}`}
                id={`skin-tab-${t}`}
                key={t}
                className={`relative flex min-h-11 items-center justify-center whitespace-nowrap px-1.5 py-2.5 text-xs font-semibold transition-colors min-[375px]:text-[13px] sm:px-5 sm:text-sm ${
                  active
                    ? "text-[#D95D39]"
                    : "text-[#6E6358] hover:text-[#24201D]"
                }`}
                onClick={() => {
                  flushTextDrafts();
                  setTab(t);
                  setError("");
                }}
              >
                {t === "tracker"
                  ? "Daily tracker"
                  : t === "products"
                    ? "My products"
                    : "Photo overview"}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[#D95D39]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!storageReady && (
        <p
          role="status"
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
        >
          Notes, products and habits save on this device. Deploy the updated
          planner script to sync Skincare tables and enable photo uploads.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#FBECE7] px-3.5 py-2.5 text-xs font-medium text-[#A83E20]"
        >
          {error}
        </p>
      )}
      {tab === "tracker" && (
        <div
          role="tabpanel"
          id="skincare-tracker"
          aria-labelledby="skin-tab-tracker"
          className="space-y-4"
        >
          {/* Compact Single-Row Date Navigator */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
                aria-label="Previous skincare day"
                onClick={() => switchDate(addDays(date, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                aria-label="Journal date"
                type="date"
                required
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#24201D] shadow-xs outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7] sm:w-44 sm:flex-initial sm:text-sm"
                max={today}
                value={date}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= today)
                    switchDate(e.target.value);
                }}
              />
              <button
                type="button"
                disabled={date >= today}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2] disabled:opacity-40"
                aria-label="Next skincare day"
                onClick={() => switchDate(addDays(date, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="min-h-10 shrink-0 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
                onClick={() => switchDate(today)}
              >
                Today
              </button>
            </div>
            <p className="hidden text-xs text-[#6E6358] md:block">
              Auto-saves to your daily shelf
            </p>
          </div>
          <Card
            compact
            title="Daily face journal"
            subtitle="Write what you applied and how your skin reacted."
          >
            <div className="grid gap-3.5 lg:grid-cols-2">
              <Field label="What I applied / daily notes">
                <textarea
                  aria-label="What I applied / daily notes"
                  className={inputClass}
                  rows={4}
                  maxLength={10000}
                  value={notesDraft}
                  placeholder="Morning and evening routine, changes, or anything you want to remember…"
                  onChange={(e) => {
                    const next = e.target.value;
                    const targetDate = date;
                    setNotesDraft(next);
                    if (notesTimer.current) clearTimeout(notesTimer.current);
                    notesTimer.current = setTimeout(() => {
                      notesTimer.current = null;
                      patchDay({ notes: next }, targetDate);
                    }, 250);
                  }}
                  onBlur={() => {
                    if (notesTimer.current) {
                      clearTimeout(notesTimer.current);
                      notesTimer.current = null;
                    }
                    if (notesDraft !== (day?.notes ?? "")) {
                      patchDay({ notes: notesDraft });
                    }
                  }}
                />
              </Field>
              <Field label="How my skin reacted">
                <textarea
                  aria-label="How my skin reacted"
                  className={inputClass}
                  rows={6}
                  maxLength={10000}
                  value={reactionDraft}
                  placeholder="Dryness, oiliness, redness, irritation, breakouts, or feeling comfortable…"
                  onChange={(e) => {
                    const next = e.target.value;
                    const targetDate = date;
                    setReactionDraft(next);
                    if (reactionTimer.current)
                      clearTimeout(reactionTimer.current);
                    reactionTimer.current = setTimeout(() => {
                      reactionTimer.current = null;
                      patchDay({ reaction: next }, targetDate);
                    }, 250);
                  }}
                  onBlur={() => {
                    if (reactionTimer.current) {
                      clearTimeout(reactionTimer.current);
                      reactionTimer.current = null;
                    }
                    if (reactionDraft !== (day?.reaction ?? "")) {
                      patchDay({ reaction: reactionDraft });
                    }
                  }}
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
                        checked={dayProductIds.has(pr.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          change((s) => {
                            const current = s.entries.find(
                              (entry) => entry.date === date,
                            );
                            const existing = current?.productIds ?? [];
                            const nextIds = checked
                              ? [...new Set([...existing, pr.id])]
                              : existing.filter((id) => id !== pr.id);
                            return putSkinDay(s, date, { productIds: nextIds });
                          });
                          setNotice(
                            "Saved on this device · notes and routine changes sync automatically.",
                          );
                        }}
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
              <button
                type="button"
                className={`${secondaryClass} mt-3`}
                onClick={newProduct}
              >
                <Plus className="h-4 w-4" />
                Add product
              </button>
            </div>
          </Card>
          <Card
            title="My skincare routine"
            subtitle="Your skincare habits are separate from the general Habits page. Add, edit or archive steps whenever you need."
            action={
              <button
                type="button"
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
                  type="button"
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
                              checked={doneHabitIds.has(h.id)}
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
                            type="button"
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
                      type="button"
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
            compact
            title="Daily progress photos"
            subtitle={`Front, left and right views for ${date}.`}
          >
            {!photoReady && (
              <p
                role="status"
                className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                Photo uploads need the latest Apps Script deployment. No photo
                key or device connection is required.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {ANGLES.map((side) => {
                const photo = dayPhotoByAngle.get(side);
                return (
                  <div key={side} className="min-w-0">
                    <h3 className="mb-1.5 text-center text-xs font-semibold capitalize text-[#5C5248] sm:text-left sm:text-sm">
                      {side}
                    </h3>
                    <SkinPhotoTile photo={photo} onOpen={setViewPhoto} />
                    <label
                      className={`mt-2 flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[#EAE2D6] px-2 py-1.5 text-center text-[11px] font-semibold sm:mt-3 sm:min-h-11 sm:px-3 sm:text-xs ${!photoReady || busy ? "cursor-not-allowed bg-[#F3EDE3] text-[#8C8073]" : "bg-white text-[#5C5248] hover:bg-[#FAF7F2]"}`}
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
                          ? "Replace"
                          : "Upload"}
                    </label>
                    {photo && (
                      <button
                        type="button"
                        className="mt-1.5 min-h-9 w-full rounded-xl text-[11px] font-medium text-[#D95D39] hover:bg-[#FBECE7]/60 sm:text-xs"
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
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
          {day && (
            <button
              type="button"
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
        <SkinProductsTab
          products={p.products}
          onNewProduct={newProduct}
          onEditProduct={setProduct}
          onToggleArchive={(id) =>
            change((s) => ({
              ...s,
              products: s.products.map((x) =>
                x.id === id ? { ...x, active: !x.active } : x,
              ),
            }))
          }
        />
      )}
      {tab === "overview" && (
        <SkinOverviewTab
          data={p}
          onOpenDay={(entryDate) => {
            setDate(entryDate);
            setTab("tracker");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onViewPhoto={setViewPhoto}
        />
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
            <SkinPhotoTile photo={viewPhoto} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
