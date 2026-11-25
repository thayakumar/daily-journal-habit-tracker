export type ClayAssetName =
  | "habits"
  | "personal"
  | "skincare"
  | "fitness"
  | "finance"
  | "calendar"
  | "vehicles"
  | "meals"
  | "dump"
  | "ideas"
  | "vocabulary"
  | "settings"
  | "brand-shelf"
  | "spot-cup"
  | "empty-desk"
  | "empty-mind"
  | "hero-shelf"
  | "hero-shelf-scene";

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) ||
  "/daily-journal-habit-tracker/";

export function clayAssetUrl(name: ClayAssetName): string {
  return `${BASE}images/clay/${name}.svg`;
}

export function ClayObject({
  name,
  className = "h-12 w-12",
  alt = "",
}: {
  name: ClayAssetName;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={clayAssetUrl(name)}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      decoding="async"
      className={`select-none object-contain ${className}`}
    />
  );
}
