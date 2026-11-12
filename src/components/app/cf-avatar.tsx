import { useEffect, useMemo, useState } from "react";
import { cfAvatarCandidates } from "@/lib/cf-avatar";
import { cn } from "@/lib/utils";

type Props = {
  handle: string;
  titlePhoto?: string | null;
  avatar?: string | null;
  className?: string;
};

export function CodeforcesAvatar(props: Props) {
  // Changing handles or photo URLs creates fresh loading/retry state.
  return <Photo key={`${props.handle}:${props.titlePhoto}:${props.avatar}`} {...props} />;
}

function Photo({ handle, titlePhoto, avatar, className }: Props) {
  const sources = useMemo(() => cfAvatarCandidates(titlePhoto, avatar), [titlePhoto, avatar]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const source = sources[index];

  useEffect(() => {
    if (!source || loaded) return;
    // A stalled official host must not hold up every fallback indefinitely.
    const timer = setTimeout(() => setIndex((value) => value + 1), 3000);
    return () => clearTimeout(timer);
  }, [source, attempt, loaded]);

  useEffect(() => {
    if (source || sources.length === 0 || attempt >= 2) return;
    const timer = setTimeout(
      () => {
        setAttempt((value) => value + 1);
        setIndex(0);
      },
      1500 * (attempt + 1),
    );
    return () => clearTimeout(timer);
  }, [source, sources.length, attempt]);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      {source ? (
        <img
          key={`${source}:${attempt}`}
          src={source}
          alt={handle}
          loading="eager"
          decoding="async"
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setIndex((value) => value + 1)}
        />
      ) : (
        <span aria-label={`${handle} profile photo unavailable`}>
          {handle.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}
