import { prisma } from "../prisma";
import { saveFile } from "../storage";
import type { CaptureResult, DetectedElement, Screen } from "./types";

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  children?: FigmaNode[];
  style?: { fontSize?: number };
};

const MAX_FRAMES = 8;

export function parseFigmaUrl(raw: string) {
  const u = new URL(raw);
  const parts = u.pathname.split("/").filter(Boolean);
  // /design/:key/..., /file/:key/..., /proto/:key/..., /design/:key/branch/:branchKey/...
  const i = parts.findIndex((p) => ["design", "file", "proto"].includes(p));
  if (i < 0 || !parts[i + 1]) throw new Error("Not a Figma file URL");
  const key = parts[i + 2] === "branch" && parts[i + 3] ? parts[i + 3] : parts[i + 1];
  const nodeId = u.searchParams.get("node-id")?.replace(/-/g, ":") ?? null;
  return { key, nodeId };
}

async function figma<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

function collectElements(frame: FigmaNode): DetectedElement[] {
  const box = frame.absoluteBoundingBox;
  if (!box) return [];
  const out: DetectedElement[] = [];
  const walk = (n: FigmaNode, depth: number) => {
    const b = n.absoluteBoundingBox;
    if (b && n !== frame) {
      const pct = {
        x: ((b.x - box.x) / box.width) * 100,
        y: ((b.y - box.y) / box.height) * 100,
        w: (b.width / box.width) * 100,
        h: (b.height / box.height) * 100,
      };
      const name = n.name.toLowerCase();
      if (n.type === "TEXT" && n.characters) {
        const size = n.style?.fontSize ?? 14;
        out.push({ kind: size >= 32 ? "headline" : size >= 20 ? "subheadline" : "text", text: n.characters.slice(0, 140), ...pct });
      } else if (/button|cta/.test(name)) {
        out.push({ kind: "cta", text: n.name, ...pct });
      } else if (/nav|header|sidebar|menu/.test(name) && depth <= 2) {
        out.push({ kind: "nav", text: n.name, ...pct });
      } else if (/input|field|form/.test(name)) {
        out.push({ kind: "input", text: n.name, ...pct });
      }
    }
    if (depth < 6) n.children?.forEach((c) => walk(c, depth + 1));
  };
  walk(frame, 0);
  return out.slice(0, 80);
}

export async function captureFigma(auditId: string, fileUrl: string, token: string): Promise<CaptureResult> {
  const { key, nodeId } = parseFigmaUrl(fileUrl);
  let frames: FigmaNode[];
  if (nodeId) {
    const data = await figma<{ nodes: Record<string, { document: FigmaNode }> }>(`/files/${key}/nodes?ids=${encodeURIComponent(nodeId)}&depth=2`, token);
    const node = data.nodes[nodeId]?.document;
    if (!node) throw new Error("Figma node not found");
    frames = node.type === "FRAME" || node.type === "COMPONENT" ? [node] : (node.children ?? []).filter((c) => c.type === "FRAME");
  } else {
    const file = await figma<{ document: FigmaNode }>(`/files/${key}?depth=2`, token);
    frames = (file.document.children ?? []).flatMap((page) => (page.children ?? []).filter((c) => c.type === "FRAME"));
  }
  frames = frames.slice(0, MAX_FRAMES);
  if (!frames.length) throw new Error("No top-level frames found in the Figma file");

  const ids = frames.map((f) => f.id).join(",");
  const detail = await figma<{ nodes: Record<string, { document: FigmaNode }> }>(`/files/${key}/nodes?ids=${encodeURIComponent(ids)}`, token);
  const images = await figma<{ images: Record<string, string | null> }>(`/images/${key}?ids=${encodeURIComponent(ids)}&format=png&scale=1`, token);

  const screens: Screen[] = [];
  for (const [i, f] of frames.entries()) {
    const url = images.images[f.id];
    if (!url) continue;
    const res = await fetch(url);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const doc = detail.nodes[f.id]?.document ?? f;
    const b = doc.absoluteBoundingBox;
    const width = Math.round(b?.width ?? 1440);
    const height = Math.round(b?.height ?? 900);
    const rel = await saveFile(auditId, "png", buf);
    const asset = await prisma.asset.create({
      data: { auditId, kind: "screenshot", label: `Figma: ${f.name}`, source: "figma", path: rel, mimeType: "image/png", width, height, order: i },
    });
    screens.push({ assetId: asset.id, label: `Figma: ${f.name}`, width, height, path: rel, mimeType: "image/png", elements: collectElements(doc) });
  }
  return { screens, signals: [], notes: [] };
}
