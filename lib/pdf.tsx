import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FINDING_CATEGORIES } from "./config";
import { SUB_SCORES, scoreBand, sortFindings, type Box, type Finding, type Report } from "./report";

export type PdfImage = { data: Buffer; format: "png" | "jpg" } | null;

const C = {
  ink: "#0E1013",
  text: "#1C1F24",
  muted: "#6B7280",
  line: "#E5E7EB",
  accent: "#5B45FF",
  critical: "#F0384B",
  high: "#FF8A00",
  medium: "#2F7CFF",
  dark: "#5B45FF",
};

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontSize: 10, color: C.text, fontFamily: "Helvetica", lineHeight: 1.45 },
  cover: { padding: 48, backgroundColor: C.dark, color: "#F3F4F6", fontFamily: "Helvetica" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted },
  h1: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 10, marginTop: 4, color: C.ink },
  h3: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginBottom: 4, color: C.ink },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: C.accent, marginBottom: 6 },
  label: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, color: C.muted, marginBottom: 2, marginTop: 6 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 12, marginBottom: 12 },
  row: { flexDirection: "row" },
  pill: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, color: "#fff", alignSelf: "flex-start", textTransform: "uppercase", letterSpacing: 0.6 },
});

const sevColor = (sev: string) => (sev === "critical" ? C.critical : sev === "high" ? C.high : C.medium);

function Footer({ product }: { product: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>UX Analysis Audit · {product}</Text>
      <Text>Powered by Matan.Design</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Shot({ img, size, box, width, marker }: { img: PdfImage; size: { width: number; height: number }; box?: Box | null; width: number; marker?: string }) {
  if (!img) return null;
  const ratio = size.height / size.width;
  // Very tall captures (full Figma frames) are cropped around the annotated area.
  const maxH = width * 0.75;
  const fullH = width * ratio;
  const viewH = Math.min(fullH, maxH);
  let offset = 0;
  if (fullH > viewH && box) {
    const center = ((box.y + box.h / 2) / 100) * fullH;
    offset = Math.max(0, Math.min(fullH - viewH, center - viewH / 2));
  }
  return (
    <View style={{ width, height: viewH, overflow: "hidden", borderRadius: 3, borderWidth: 1, borderColor: C.line, position: "relative" }}>
      <Image src={img} style={{ width, height: fullH, position: "absolute", top: -offset, left: 0 }} />
      {box && (
        <View
          style={{
            position: "absolute",
            left: (box.x / 100) * width,
            top: (box.y / 100) * fullH - offset,
            width: (box.w / 100) * width,
            height: (box.h / 100) * fullH,
            borderWidth: 2,
            borderColor: C.critical,
            backgroundColor: "rgba(194,53,58,0.10)",
            borderRadius: 2,
          }}
        >
          {marker && (
            <Text style={{ position: "absolute", top: -9, left: -9, width: 16, height: 16, borderRadius: 8, backgroundColor: C.critical, color: "#fff", fontSize: 7, textAlign: "center", paddingTop: 4, fontFamily: "Helvetica-Bold" }}>
              {marker}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function FindingBlock({ f, report, images }: { f: Finding; report: Report; images: PdfImage[] }) {
  const a = f.annotation;
  const shot = a ? report.screenshots[a.screenshotIndex] : undefined;
  return (
    <View style={s.card} wrap={false}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 6 }]}>
        <Text style={[s.h3, { flex: 1, paddingRight: 8 }]}>{f.id} · {f.title}</Text>
        <Text style={[s.pill, { backgroundColor: sevColor(f.severity) }]}>{f.severity}</Text>
      </View>
      <View style={s.row}>
        <View style={{ flex: 1, paddingRight: shot ? 12 : 0 }}>
          <Text style={s.label}>Problem</Text>
          <Text>{f.problem}</Text>
          <Text style={s.label}>Why it matters</Text>
          <Text>{f.whyItMatters}</Text>
          <Text style={s.label}>Business impact</Text>
          <Text>{f.businessImpact}</Text>
          <Text style={s.label}>Recommended fix</Text>
          <Text>{f.recommendedFix}</Text>
          <Text style={{ marginTop: 6, color: C.muted, fontSize: 8 }}>Impact {f.impact}/5 · Effort {f.effort}</Text>
        </View>
        {shot && a && (
          <View style={{ width: 210 }}>
            <Shot img={images[a.screenshotIndex]} size={shot} box={a} width={210} marker={f.id.replace(/^F/, "")} />
            <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 4 }}>{shot.label}{f.annotationNote ? ` · ${f.annotationNote}` : ""}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function ReportPdf({ productName, productUrl, report, images }: { productName: string; productUrl: string; report: Report; images: PdfImage[] }) {
  const band = scoreBand(report.growthScore);
  const findings = sortFindings(report.findings);
  return (
    <Document title={`UX Analysis Audit: ${productName}`} author="UX Analysis Audit">
      <Page size="A4" style={s.cover}>
        <Text style={[s.eyebrow, { marginBottom: 120, color: "#FFFFFF" }]}>UX Analysis Audit · Executive Report</Text>
        <Text style={{ fontSize: 34, fontFamily: "Helvetica-Bold", marginBottom: 8 }}>{productName}</Text>
        <Text style={{ color: "#DCD6FF", marginBottom: 48 }}>{productUrl}</Text>
        <Text style={[s.eyebrow, { color: "#FFFFFF" }]}>Growth Readiness Score</Text>
        <View style={[s.row, { alignItems: "flex-end", marginBottom: 6 }]}>
          <Text style={{ fontSize: 72, fontFamily: "Helvetica-Bold" }}>{report.growthScore}</Text>
          <Text style={{ fontSize: 16, color: "#DCD6FF", marginLeft: 6, marginBottom: 14 }}>/ 100</Text>
        </View>
        <Text style={{ color: "#FFFFFF", marginBottom: 32 }}>{band.label}</Text>
        {report.subScores.map((sc) => (
          <View key={sc.key} style={{ marginBottom: 9 }}>
            <View style={[s.row, { justifyContent: "space-between", fontSize: 9, marginBottom: 3 }]}>
              <Text>{SUB_SCORES.find((d) => d.key === sc.key)?.label}</Text>
              <Text>{sc.score}</Text>
            </View>
            <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 2 }}>
              <View style={{ height: 4, width: `${sc.score}%`, backgroundColor: "#FFFFFF", borderRadius: 2 }} />
            </View>
          </View>
        ))}
        <Text style={{ position: "absolute", bottom: 40, left: 48, fontSize: 8, color: "#DCD6FF" }}>
          Generated {new Date(report.generatedAt).toDateString()} · Powered by Matan.Design
        </Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Executive summary</Text>
        <Text style={{ fontSize: 12, marginBottom: 20, color: C.ink }}>{report.executiveSummary}</Text>
        <Text style={s.h2}>Top 3 critical issues</Text>
        {report.criticalIssues.map((c, i) => {
          const f = report.findings.find((x) => x.id === c.findingId);
          const a = f?.annotation;
          const shot = a ? report.screenshots[a.screenshotIndex] : undefined;
          return (
            <View key={i} style={s.card} wrap={false}>
              <View style={s.row}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[s.pill, { backgroundColor: sevColor(c.impactLevel), marginBottom: 6 }]}>{c.impactLevel} impact</Text>
                  <Text style={s.h3}>{i + 1}. {c.title}</Text>
                  <Text style={s.label}>Business impact</Text>
                  <Text>{c.businessImpact}</Text>
                  <Text style={s.label}>Fix</Text>
                  <Text>{c.fix}</Text>
                </View>
                {shot && a && (
                  <View style={{ width: 200 }}>
                    <Shot img={images[a.screenshotIndex]} size={shot} box={a} width={200} marker={String(i + 1)} />
                    <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 4 }}>{shot.label}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        <Footer product={productName} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Detailed findings</Text>
        {FINDING_CATEGORIES.map((cat) => {
          const items = findings.filter((f) => f.category === cat.value);
          if (!items.length) return null;
          return (
            <View key={cat.value}>
              <Text style={[s.eyebrow, { marginTop: 8 }]}>{cat.label}</Text>
              {items.map((f) => (
                <FindingBlock key={f.id} f={f} report={report} images={images} />
              ))}
            </View>
          );
        })}
        <Footer product={productName} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Prioritized action plan</Text>
        {(
          [
            ["High impact / Low effort", "Do first", report.actionPlan.highImpactLowEffort],
            ["High impact / High effort", "Plan into the roadmap", report.actionPlan.highImpactHighEffort],
            ["Quick wins", "Batch into the next sprint", report.actionPlan.quickWins],
          ] as const
        ).map(([title, sub, items]) => (
          <View key={title} style={s.card} wrap={false}>
            <Text style={s.h3}>{title}</Text>
            <Text style={{ color: C.muted, marginBottom: 6 }}>{sub}</Text>
            {items.length === 0 && <Text style={{ color: C.muted }}>None identified.</Text>}
            {items.map((a) => (
              <View key={a.findingId} style={[s.row, { marginBottom: 3 }]}>
                <Text style={{ width: 28, color: C.accent }}>{a.findingId}</Text>
                <Text style={{ flex: 1 }}>{a.title}</Text>
                <Text style={{ color: C.muted, fontSize: 8 }}>Impact {a.impact}/5 · {a.effort} effort</Text>
              </View>
            ))}
          </View>
        ))}
        <Footer product={productName} />
      </Page>
    </Document>
  );
}

export async function renderReportPdf(props: Parameters<typeof ReportPdf>[0]) {
  return renderToBuffer(<ReportPdf {...props} />);
}
