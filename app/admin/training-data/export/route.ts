import { db } from "@/lib/db";
import { exportTrainingExamplesToJsonl } from "@/lib/llm/trainingData";

export async function GET(): Promise<Response> {
  const examples = await db.trainingExample.findMany({
    orderBy: { createdAt: "asc" },
  });
  const jsonl = exportTrainingExamplesToJsonl(examples);

  return new Response(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lifeupgrade-training-data.jsonl"',
      "Cache-Control": "no-store",
    },
  });
}
