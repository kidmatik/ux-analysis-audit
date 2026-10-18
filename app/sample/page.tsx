import { redirect } from "next/navigation";
import { ensureSample, SAMPLE_TOKEN } from "@/lib/sample";

export const dynamic = "force-dynamic";

export default async function Sample() {
  await ensureSample();
  redirect(`/r/${SAMPLE_TOKEN}`);
}
