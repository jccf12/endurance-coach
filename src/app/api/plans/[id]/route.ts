import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/plans/[id] — fetch plan with sessions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { data: plan, error } = await supabase
    .from("training_plans")
    .select("*, training_sessions(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !plan) {
    return NextResponse.json({ message: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json(plan);
}

// PATCH /api/plans/[id] — update plan status or name
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const updates = await request.json();
  const allowed = ["name", "goal", "status"];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowed.includes(key))
  );

  const { data, error } = await supabase
    .from("training_plans")
    .update({ ...filtered, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/plans/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("training_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
