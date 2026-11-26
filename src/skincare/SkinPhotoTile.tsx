import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { secondaryClass } from "../workspace/ui";
import type { SkinPhoto } from "./model";
import { cachedSkinPhoto, loadSkinPhoto } from "./photos";

export function SkinPhotoTile({
  photo,
  onOpen,
}: {
  photo?: SkinPhoto;
  onOpen?: (p: SkinPhoto) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState(0);
  const fileId = photo?.fileId;

  const url = fileId
    ? cachedSkinPhoto(fileId) || (loaded?.id === fileId ? loaded.url : "")
    : "";

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    const run = () => {
      void loadSkinPhoto(fileId)
        .then((value) => {
          if (!cancelled) {
            setFailed("");
            setLoaded({ id: fileId, url: value });
          }
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
  }, [fileId, attempt]);

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
            type="button"
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
