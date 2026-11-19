"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, EyeOff, ImagePlus, Send, Users, X } from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/image-compress";
import { enqueueComplaint } from "@/lib/offline-queue";
import { STATUS_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { CategoryIcon } from "./category-icon";
import type { CategoryOption } from "./types";
import type { ComplaintStatus } from "@/domain/types";

type Similar = {
  id: string;
  referenceNo: string;
  title: string;
  status: ComplaintStatus;
  supportCount: number;
  isMine: boolean;
  supportedByMe: boolean;
};

const MAX_PHOTOS = 3;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight text-ink">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-800 text-sm text-white" aria-hidden>
          {n}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function NewComplaintForm({ categories, initialCategory }: { categories: CategoryOption[]; initialCategory?: string }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(
    () => categories.find((c) => c.code === initialCategory?.toUpperCase())?.id ?? "",
  );
  const [issueTypeId, setIssueTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [photos, setPhotos] = useState<{ file: Blob; url: string }[]>([]);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keyRef = useRef<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const category = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  // Suggestions only apply to the current category and a meaningful title.
  const suggestions = categoryId && title.trim().length >= 5 ? similar : [];

  // One key per draft: retries and offline replays never create a second complaint.
  useEffect(() => {
    keyRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  // Suggest similar open complaints while the student types the title.
  useEffect(() => {
    if (!categoryId || title.trim().length < 5) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ data: Similar[] }>(
          `/api/v1/complaints/similar?categoryId=${categoryId}&title=${encodeURIComponent(title.trim())}`,
        );
        setSimilar(res.data.filter((s) => !s.isMine));
      } catch {
        setSimilar([]);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [categoryId, title]);

  async function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    event.target.value = "";
    const compressed = await Promise.all(files.map((file) => compressImage(file)));
    setPhotos((prev) => [...prev, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  async function toggleSupport(item: Similar) {
    try {
      const res = await api<{ supported: boolean; supportCount: number }>(`/api/v1/complaints/${item.id}/support`, {
        method: item.supportedByMe ? "DELETE" : "POST",
      });
      setSimilar((list) =>
        list.map((s) => (s.id === item.id ? { ...s, supportedByMe: res.supported, supportCount: res.supportCount } : s)),
      );
    } catch (err) {
      setServerError(errorMessage(err));
    }
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!categoryId) next.category = "Choose what this is about.";
    if (title.trim().length < 5) next.title = "Give it a short title (at least 5 characters).";
    if (description.trim().length < 20) next.description = "Describe the problem in at least 20 characters.";
    return next;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0] === "category" ? "step-category" : `field-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const payload = {
      categoryId,
      issueTypeId,
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || null,
      isAnonymous: anonymous,
    };
    setSubmitting(true);

    const queueOffline = async () => {
      await enqueueComplaint({ key: keyRef.current, payload, images: photos.map((p) => p.file) });
      router.push("/student/complaints?queued=1");
    };

    if (!navigator.onLine) {
      await queueOffline();
      return;
    }

    try {
      const complaint = await api<{ id: string }>("/api/v1/complaints", {
        method: "POST",
        headers: { "Idempotency-Key": keyRef.current },
        body: payload,
      });
      for (const photo of photos) {
        const form = new FormData();
        form.append("file", photo.file, "photo.jpg");
        await api(`/api/v1/complaints/${complaint.id}/attachments`, { method: "POST", body: form }).catch(() => null);
      }
      router.push(`/student/complaints/${complaint.id}`);
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        await queueOffline(); // network dropped mid-request: keep the draft safe
        return;
      }
      setServerError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]" noValidate>
      <div className="flex min-w-0 flex-col gap-5">
        <Step n={1} title="What is it about?">
          <div
            id="step-category"
            tabIndex={-1}
            role="radiogroup"
            aria-label="Category"
            aria-describedby={errors.category ? "category-error" : undefined}
            className="grid gap-3 outline-none sm:grid-cols-2"
          >
            {categories.map((c) => {
              const selected = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setCategoryId(c.id);
                    setIssueTypeId(null);
                  }}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-[1.25rem] border-2 p-4 text-left transition-colors duration-150 focus-ring",
                    selected ? "border-brand-600 bg-brand-50" : "border-line hover:border-brand-200 hover:bg-shell",
                  )}
                >
                  <CategoryIcon code={c.code} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Goes to {c.department.name}</span>
                  </span>
                  {selected ? (
                    <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand-700 text-white" aria-hidden>
                      <Check className="size-4" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {errors.category ? (
            <p id="category-error" role="alert" className="mt-2 text-xs font-medium text-rejected">
              {errors.category}
            </p>
          ) : null}

          {category && category.issueTypes.length > 0 ? (
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold text-ink">
                What kind of issue? <span className="font-normal text-muted">(optional)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {category.issueTypes.map((t) => {
                  const active = issueTypeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setIssueTypeId(active ? null : t.id)}
                      className={cn(
                        "h-10 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors duration-150 focus-ring",
                        active ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong text-ink-soft hover:border-brand-400",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
        </Step>

        <Step n={2} title="Describe the problem">
          <div className="flex flex-col gap-5">
            <Field id="field-title" label="Title" error={errors.title} hint="A short summary, like a headline.">
              {(p) => (
                <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Internet down in Lab 3" />
              )}
            </Field>

            {suggestions.length > 0 ? (
              <div className="rounded-[1.25rem] bg-pending-soft p-4" aria-live="polite">
                <p className="text-sm font-semibold text-ink">Others may have reported this already</p>
                <p className="text-xs text-ink-soft">Add your support instead of filing a duplicate. You can still submit your own.</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                        <p className="text-xs text-muted">
                          {s.referenceNo} · {STATUS_LABEL[s.status]} · {s.supportCount} supporting
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={s.supportedByMe ? "soft" : "outline"}
                        onClick={() => toggleSupport(s)}
                        icon={s.supportedByMe ? <Check className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}
                        aria-pressed={s.supportedByMe}
                      >
                        {s.supportedByMe ? "Supported" : "Me too"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Field id="field-description" label="Details" error={errors.description} hint={`${description.trim().length}/5000. What happened, when, and how it affects you.`}>
              {(p) => (
                <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
              )}
            </Field>

            <Field label="Location" optional hint="Room, block or floor, if it helps the department find it.">
              {(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Lab 3, Block B" />}
            </Field>
          </div>
        </Step>

        <Step n={3} title="Add photos (optional)">
          <p className="mb-4 text-sm text-muted">Up to 3 photos. Location data is removed from every photo for your privacy.</p>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-square overflow-hidden rounded-2xl bg-shell">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file the user picked */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((x) => x.url !== p.url))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition-colors hover:border-brand-400 hover:text-brand-700 focus-ring"
              >
                <ImagePlus className="size-6" aria-hidden />
                Add photo
              </button>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={addPhotos} />
        </Step>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-4 xl:self-start">
        <Card>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-brand-700"
            />
            <span>
              <span className="flex items-center gap-2 font-semibold text-ink">
                <EyeOff className="size-4" aria-hidden /> Hide my name from the department
              </span>
              <span className="mt-1 block text-sm text-muted">
                The department sees &quot;Anonymous student&quot;. Only the university&apos;s complaint office can see who you
                are, and only for a recorded reason.
              </span>
            </span>
          </label>
        </Card>

        <Card className="bg-brand-gradient text-white">
          <p className="text-sm font-semibold text-brand-100">Will be sent to</p>
          <p className="mt-1 text-xl font-semibold">{category?.department.name ?? "Choose a category"}</p>
          <p className="mt-2 text-sm text-brand-100">You will get a reference number and updates as it progresses.</p>
          {serverError ? <div className="mt-4"><FormMessage>{serverError}</FormMessage></div> : null}
          <Button type="submit" variant="light" size="lg" loading={submitting} icon={<Send className="size-5" aria-hidden />} className="mt-5 w-full">
            Submit complaint
          </Button>
        </Card>
      </aside>
    </form>
  );
}
