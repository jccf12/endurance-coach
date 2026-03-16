import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyProposedChanges, type PlanProposal } from "@/lib/ai/coach-tools";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { proposal } = await request.json() as { proposal: PlanProposal };

  if (!proposal?.changes?.length) {
    return NextResponse.json({ message: "No changes to apply" }, { status: 400 });
  }

  const { applied, failed, results } = await applyProposedChanges(proposal, supabase, user.id);

  return NextResponse.json({ applied, failed, results });
}
