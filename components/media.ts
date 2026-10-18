"use client";

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: "image/jpeg" })) : reject(new Error("Frame capture failed"))), "image/jpeg", 0.86),
  );
}

export function drawFrame(video: HTMLVideoElement, maxWidth = 1600) {
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function grabFrame(video: HTMLVideoElement, name: string) {
  return canvasToFile(drawFrame(video), name);
}

// Extracts evenly spaced still frames from a video file so they can be annotated in the report.
export async function extractFrames(file: Blob, count = 8): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("This video format cannot be read in the browser."));
  });
  let duration = video.duration;
  if (!Number.isFinite(duration)) {
    video.currentTime = 1e7;
    await new Promise((r) => (video.ontimeupdate = r));
    duration = video.duration;
    video.ontimeupdate = null;
  }
  const frames: File[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(duration - 0.1, ((i + 0.5) / count) * duration);
    video.currentTime = Math.max(0, t);
    await new Promise((r) => (video.onseeked = r));
    frames.push(await grabFrame(video, `frame ${i + 1}.jpg`));
  }
  URL.revokeObjectURL(url);
  return frames;
}
