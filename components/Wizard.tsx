"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCESS_METHODS, FOCUS_AREAS, GROWTH_STAGES, PRIMARY_GOALS, PRODUCT_TYPES } from "@/lib/config";
import { Button, Field, inputCls } from "./ui";
import { extractFrames, grabFrame } from "./media";

type Method = (typeof ACCESS_METHODS)[number]["value"];
const STEPS = ["Product info", "Access method", "Focus areas"];
const MAX_IMAGES = 15;

const FLOWS: Record<string, string> = {
  onboarding: "Sign up as a new user and complete the first-run setup",
  dashboard: "Land on the main dashboard and explain what a user looks at first",
  core_workflow: "Complete the single most important task in the product end to end",
  messaging: "Open the homepage and pricing page and read the main claims",
  monetization: "Hit a plan limit or open the upgrade and billing screens",
  ux_consistency: "Move between three different areas of the product",
  discoverability: "Try to find an advanced feature without using search",
};

export function Wizard({ figmaServerToken, initialUrl = "", initialMethod = "url" }: { figmaServerToken: boolean; initialUrl?: string; initialMethod?: Method }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [info, setInfo] = useState({ productName: nameFromUrl(initialUrl), productUrl: initialUrl, productType: initialMethod === "url" ? "website" : "saas_app", growthStage: "seed", primaryGoal: "conversion" });
  const [method, setMethod] = useState<Method>(initialMethod);
  const [demo, setDemo] = useState({ loginUrl: "", email: "", password: "", mfaNotes: "", reviewerNotes: "" });
  const [figma, setFigma] = useState({ url: "", token: "" });
  const [loomUrl, setLoomUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<Blob | null>(null);
  const [focus, setFocus] = useState<string[]>(["onboarding", "messaging", "core_workflow"]);

  const pct = ((step + 1) / STEPS.length) * 100;

  function validate(): string | null {
    if (step === 0) {
      if (!info.productName.trim()) return "Enter the product name.";
      if (info.productUrl && !/^https?:\/\/.+\..+/.test(info.productUrl)) return "Enter a full URL starting with https://";
    }
    if (step === 1) {
      if (method === "url" && !/^https?:\/\/.+\..+/.test(info.productUrl)) return "Enter the live URL to scan, starting with https://";
      if (method === "demo" && (!demo.loginUrl || !demo.email || !demo.password)) return "Login URL, email and password are required.";
      if (method === "figma" && !/figma\.com\/(design|file|proto)\//.test(figma.url)) return "Paste a Figma file link (figma.com/design/...).";
      if (method === "figma" && !figma.token && !figmaServerToken) return "Add a Figma personal access token.";
      if ((method === "upload" || method === "recording") && !images.length && !loomUrl) return method === "recording" ? "Record a walkthrough first." : "Add screenshots, a video or a Loom link.";
    }
    if (step === 2 && focus.length === 0) return "Select at least one focus area.";
    return null;
  }

  function next() {
    const v = validate();
    setError(v);
    if (!v) setStep((s) => s + 1);
  }

  async function submit() {
    const v = validate();
    if (v) return setError(v);
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        ...info,
        accessMethod: method,
        focusAreas: focus,
        demo: method === "demo" ? demo : undefined,
        figma: method === "figma" ? figma : undefined,
        loomUrl: method === "upload" ? loomUrl : undefined,
      }),
    );
    if (method === "upload" || method === "recording") {
      images.slice(0, MAX_IMAGES).forEach((f) => fd.append("images", f));
      if (video) fd.set("video", video, method === "recording" ? "recording.webm" : "upload");
    }
    const res = await fetch("/api/audits", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({ error: "Something went wrong." }));
    if (!res.ok) {
      setError(json.error);
      setUpgrade(Boolean(json.upgrade));
      setSubmitting(false);
      return;
    }
    router.push(`/audits/${json.id}/processing`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted">Step {step + 1} of {STEPS.length}</p>
        <p className="text-fg">{STEPS[step]}</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-2 rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2 text-xs sm:text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={i <= step ? "font-semibold text-accent" : "text-subtle"}>{String(i + 1).padStart(2, "0")} · {s}</li>
        ))}
      </ol>

      <div key={step} className="fade-up mt-8 sm:mt-10 rounded-3xl border border-line bg-white p-5 sm:p-8 shadow-[0_10px_40px_rgb(14_19_37/0.06)]">
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <h2 className="md:col-span-2 font-display text-2xl sm:text-3xl tracking-tight">Tell us about the product</h2>
            <Field label="Product name">
              <input className={inputCls} value={info.productName} onChange={(e) => setInfo({ ...info, productName: e.target.value })} placeholder="Acme Analytics" />
            </Field>
            <Field label="Product URL" hint="Your website, landing page or app address.">
              <input className={inputCls} value={info.productUrl} onChange={(e) => setInfo({ ...info, productUrl: e.target.value.trim() })} placeholder="https://acme.com" />
            </Field>
            <Field label="Product type">
              <select className={inputCls} value={info.productType} onChange={(e) => setInfo({ ...info, productType: e.target.value })}>
                {PRODUCT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Growth stage">
              <select className={inputCls} value={info.growthStage} onChange={(e) => setInfo({ ...info, growthStage: e.target.value })}>
                {GROWTH_STAGES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Primary goal">
                <select className={inputCls} value={info.primaryGoal} onChange={(e) => setInfo({ ...info, primaryGoal: e.target.value })}>
                  {PRIMARY_GOALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">How should we access it?</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {ACCESS_METHODS.map((m, i) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setMethod(m.value); setError(null); }}
                  className={`flex flex-col justify-start text-left rounded-2xl border-2 p-4 transition-all ${method === m.value ? "border-accent bg-accent/5 shadow-sm" : "border-line hover:border-accent/40 hover:-translate-y-0.5"}`}
                >
                  <p className="text-[11px] text-subtle">Option {String.fromCharCode(65 + i)}</p>
                  <p className="mt-1 text-sm font-medium">{m.label}</p>
                  <p className="mt-2 text-xs text-muted leading-relaxed">{m.description}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 border-t border-line pt-8">
              {method === "url" && (
                <div className="grid gap-5 max-w-xl">
                  <Field label="Live URL" hint="We capture the page on desktop and mobile, plus key pages it links to such as pricing and signup.">
                    <input className={inputCls} value={info.productUrl} onChange={(e) => setInfo({ ...info, productUrl: e.target.value.trim() })} placeholder="https://acme.com" />
                  </Field>
                </div>
              )}
              {method === "demo" && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <Field label="Login URL"><input className={inputCls} value={demo.loginUrl} onChange={(e) => setDemo({ ...demo, loginUrl: e.target.value.trim() })} placeholder="https://app.acme.com/login" /></Field>
                  </div>
                  <Field label="Email"><input className={inputCls} value={demo.email} onChange={(e) => setDemo({ ...demo, email: e.target.value })} autoComplete="off" /></Field>
                  <Field label="Password"><input type="password" className={inputCls} value={demo.password} onChange={(e) => setDemo({ ...demo, password: e.target.value })} autoComplete="new-password" /></Field>
                  <Field label="MFA notes" hint="If the account uses MFA, explain how the reviewer can pass it.">
                    <textarea rows={3} className={inputCls} value={demo.mfaNotes} onChange={(e) => setDemo({ ...demo, mfaNotes: e.target.value })} />
                  </Field>
                  <Field label="Reviewer notes" hint="Anything we should know: key flows, known issues, test data.">
                    <textarea rows={3} className={inputCls} value={demo.reviewerNotes} onChange={(e) => setDemo({ ...demo, reviewerNotes: e.target.value })} />
                  </Field>
                  <p className="md:col-span-2 text-xs text-subtle">Use a dedicated demo account. Credentials are encrypted at rest, used only for this session, and permanently deleted as soon as screens are captured.</p>
                </div>
              )}
              {method === "figma" && (
                <div className="grid gap-5 max-w-xl">
                  <Field label="Figma file link" hint="Link to the file or to a specific frame or page. We analyze up to 8 top-level frames.">
                    <input className={inputCls} value={figma.url} onChange={(e) => setFigma({ ...figma, url: e.target.value.trim() })} placeholder="https://www.figma.com/design/..." />
                  </Field>
                  <Field
                    label={`Figma personal access token${figmaServerToken ? " (optional)" : ""}`}
                    hint="Figma > Settings > Security > Personal access tokens, with read access to file content. Deleted after analysis."
                  >
                    <input type="password" className={inputCls} value={figma.token} onChange={(e) => setFigma({ ...figma, token: e.target.value.trim() })} autoComplete="off" />
                  </Field>
                </div>
              )}
              {method === "recording" && <Recorder url={info.productUrl} focus={focus} images={images} setImages={setImages} setVideo={setVideo} />}
              {method === "upload" && (
                <UploadPanel images={images} setImages={setImages} setVideo={setVideo} loomUrl={loomUrl} setLoomUrl={setLoomUrl} />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">Where should we focus?</h2>
            <p className="mt-2 text-sm text-muted">Every audit covers value proposition, conversion and trust. Focus areas add depth.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {FOCUS_AREAS.map((f) => {
                const on = focus.includes(f.value);
                return (
                  <label key={f.value} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-colors ${on ? "border-accent bg-accent/5" : "border-line hover:border-accent/40"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setFocus(on ? focus.filter((x) => x !== f.value) : [...focus, f.value])}
                      className="h-4 w-4 accent-[#f04a0f]"
                    />
                    <span className="text-sm">{f.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 text-sm text-critical">
            {error} {upgrade && <a href="/upgrade" className="underline underline-offset-4 text-accent">See Pro</a>}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? router.push("/dashboard") : setStep(step - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button variant="accent" onClick={submit} disabled={submitting}>{submitting ? "Starting" : "Start Audit"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function nameFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return host ? host.charAt(0).toUpperCase() + host.slice(1) : "";
  } catch {
    return "";
  }
}

function Thumbs({ images, setImages }: { images: File[]; setImages: (f: File[]) => void }) {
  const urls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  if (!images.length) return null;
  return (
    <div className="mt-4 grid grid-cols-3 md:grid-cols-5 gap-3">
      {images.map((f, i) => (
        <div key={i} className="relative group rounded border border-line overflow-hidden bg-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[i]} alt={f.name} className="block w-full h-20 object-cover object-top" />
          <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded bg-bg/90 px-1.5 text-xs text-muted hover:text-fg">Remove</button>
        </div>
      ))}
    </div>
  );
}

function UploadPanel({ images, setImages, setVideo, loomUrl, setLoomUrl }: { images: File[]; setImages: (f: File[]) => void; setVideo: (b: Blob | null) => void; loomUrl: string; setLoomUrl: (s: string) => void }) {
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const add = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /image\/(png|jpe?g|webp|gif)/.test(f.type));
    setImages([...images, ...list].slice(0, MAX_IMAGES));
  };
  async function onVideo(file: File | undefined) {
    if (!file) return;
    setVideoStatus("Extracting key frames from the video");
    try {
      const frames = await extractFrames(file, 8);
      setVideo(file.size < 200 * 1024 * 1024 ? file : null);
      setImages([...images, ...frames].slice(0, MAX_IMAGES));
      setVideoStatus(`${frames.length} frames extracted from ${file.name}`);
    } catch (e) {
      setVideoStatus((e as Error).message);
    }
  }
  return (
    <div className="grid gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`rounded-md border border-dashed p-8 text-center ${drag ? "border-accent bg-accent/5" : "border-line-strong"}`}
      >
        <p className="text-sm">Drop screenshots or design exports here</p>
        <p className="mt-1 text-xs text-subtle">PNG, JPG, WebP or GIF, up to {MAX_IMAGES} images, 12 MB each</p>
        <label className="mt-4 inline-block cursor-pointer rounded-md border border-line-strong px-3 py-2 text-sm hover:bg-surface-2">
          Choose files
          <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files && add(e.target.files)} />
        </label>
        <Thumbs images={images} setImages={setImages} />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <Field label="Upload video" hint={videoStatus ?? "MP4, MOV or WebM. We extract key frames for annotation."}>
          <input type="file" accept="video/*" onChange={(e) => onVideo(e.target.files?.[0])} className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-transparent file:px-3 file:py-2 file:text-fg" />
        </Field>
        <Field label="Loom link" hint="Optional. Used as walkthrough context for the review.">
          <input className={inputCls} value={loomUrl} onChange={(e) => setLoomUrl(e.target.value.trim())} placeholder="https://www.loom.com/share/..." />
        </Field>
      </div>
    </div>
  );
}

function Recorder({ url, focus, images, setImages, setVideo }: { url: string; focus: string[]; images: File[]; setImages: (f: File[]) => void; setVideo: (b: Blob | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done">(images.length ? "done" : "idle");
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const frames = useRef<File[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState(0);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      streamRef.current = stream;
      const v = videoEl.current!;
      v.srcObject = stream;
      await v.play();
      chunks.current = [];
      frames.current = [];
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start(1000);
      recRef.current = rec;
      stream.getVideoTracks()[0].onended = () => finish();
      setState("recording");
      const snap = async () => {
        if (frames.current.length >= MAX_IMAGES || !v.videoWidth) return;
        frames.current.push(await grabFrame(v, `frame ${frames.current.length + 1}.jpg`));
        setCount(frames.current.length);
      };
      setTimeout(snap, 1500);
      timer.current = setInterval(snap, 4000);
    } catch (e) {
      setErr((e as Error).name === "NotAllowedError" ? "Screen sharing was not allowed." : "Screen recording is not supported in this browser.");
    }
  }

  function finish() {
    if (timer.current) clearInterval(timer.current);
    recRef.current?.state === "recording" && recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setTimeout(() => {
      setVideo(chunks.current.length ? new Blob(chunks.current, { type: "video/webm" }) : null);
      setImages(frames.current.slice(0, MAX_IMAGES));
      setState("done");
    }, 300);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-6">
      <div>
        <div className="rounded-md border border-line overflow-hidden bg-bg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-subtle">
            <span className={`h-2 w-2 rounded-full ${state === "recording" ? "bg-critical pulse-ring" : "bg-line-strong"}`} />
            <span className="truncate">{url || "Add a product URL in step 1 to load it here"}</span>
          </div>
          {url ? (
            <iframe src={url} className="w-full h-[380px] bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="Product preview" />
          ) : (
            <div className="h-[380px] flex items-center justify-center text-sm text-subtle">No URL to preview</div>
          )}
        </div>
        <p className="mt-2 text-xs text-subtle">Some products block embedding. If the preview is blank, open the product in another tab and share that tab when recording.</p>
        <video ref={videoEl} muted playsInline className="hidden" />
        <div className="mt-4 flex items-center gap-3">
          {state !== "recording" ? (
            <Button type="button" variant="accent" onClick={start}>{state === "done" ? "Record again" : "Start recording"}</Button>
          ) : (
            <Button type="button" onClick={finish}>Finish recording</Button>
          )}
          <span className="text-sm text-muted">
            {state === "recording" ? `Recording · ${count} key screens captured` : state === "done" ? `${images.length} key screens ready for analysis` : "Records your screen; you choose which tab or window to share."}
          </span>
        </div>
        {err && <p className="mt-2 text-sm text-critical">{err}</p>}
        {state === "done" && <Thumbs images={images} setImages={setImages} />}
      </div>
      <aside className="rounded-md border border-line p-5 bg-bg">
        <p className="text-[11px] uppercase tracking-wider text-accent">Flows to test</p>
        <ol className="mt-4 space-y-3 text-sm">
          {(focus.length ? focus : Object.keys(FLOWS)).slice(0, 6).map((f, i) => (
            <li key={f} className="flex gap-3">
              <span className="text-subtle tabular-nums">{i + 1}.</span>
              <span className="text-muted">{FLOWS[f]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-subtle">Pause for a moment on each important screen. A key frame is captured every few seconds.</p>
      </aside>
    </div>
  );
}
