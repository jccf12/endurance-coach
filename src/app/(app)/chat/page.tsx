"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatInput } from "@/components/chat/ChatInput";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { ChatMessage, TrainingPlan } from "@/types";
import type { PlanProposal } from "@/lib/ai/coach-tools";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const ACTION_ICON: Record<string, string> = {
  modify: "✏️",
  add: "➕",
  remove: "🗑️",
};

export default function ChatPage() {
  const searchParams = useSearchParams();
  const planIdParam = searchParams.get("planId");

  const supabase = createClient();
  const { toast } = useToast();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planIdParam ?? "");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [planModified, setPlanModified] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<PlanProposal | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user & plans
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: plansData } = await supabase
        .from("training_plans")
        .select("id, name, sport, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (plansData) setPlans(plansData as TrainingPlan[]);

      const { data: history } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (history && history.length > 0) {
        setMessages(
          history
            .reverse()
            .filter((m: ChatMessage) => m.role !== "system")
            .map((m: ChatMessage) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
        );
      } else {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hey! I'm your endurance coach 🏅 I can help you with training advice, modify your plan, answer questions about your workouts, or anything else related to your marathon, triathlon, or HYROX training.\n\nWhat's on your mind?",
          },
        ]);
      }

      setHistoryLoading(false);
    };

    init();
  }, [supabase]);

  const handleApplyProposal = useCallback(async () => {
    if (!pendingProposal) return;
    setIsApplying(true);

    try {
      const res = await fetch("/api/plans/apply-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: pendingProposal }),
      });

      const data = await res.json() as { applied: number; failed: number };

      if (data.applied > 0) {
        toast({
          title: "Plan updated",
          description: `${data.applied} change${data.applied > 1 ? "s" : ""} applied successfully`,
        });
        setPlanModified(true);
      }
      if (data.failed > 0) {
        toast({
          title: `${data.failed} change${data.failed > 1 ? "s" : ""} failed`,
          description: "Some changes could not be applied",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to apply changes", variant: "destructive" });
    } finally {
      setIsApplying(false);
      setPendingProposal(null);
    }
  }, [pendingProposal, toast]);

  const handleClearConversation = useCallback(async () => {
    if (!userId) return;
    await supabase.from("chat_messages").delete().eq("user_id", userId);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hey! I'm your endurance coach 🏅 I can help you with training advice, modify your plan, answer questions about your workouts, or anything else related to your marathon, triathlon, or HYROX training.\n\nWhat's on your mind?",
      },
    ]);
    setShowClearConfirm(false);
    setPendingProposal(null);
  }, [userId, supabase]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: LocalMessage = { id: Date.now().toString(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingContent("");
      setPendingProposal(null);

      try {
        const history = messages
          .filter((m) => m.id !== "welcome")
          .slice(-10)
          .map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, planId: selectedPlanId || undefined, history }),
        });

        if (!res.ok) throw new Error("Failed to get response");
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullContent += parsed.text;
                  setStreamingContent(fullContent);
                } else if (parsed.plan_updated) {
                  const { action, sessionTitle } = parsed.plan_updated as { action: string; sessionTitle: string };
                  const label = action === "modified" ? "Updated" : action === "added" ? "Added" : "Removed";
                  toast({ title: `Plan ${label}`, description: sessionTitle });
                  setPlanModified(true);
                } else if (parsed.plan_proposal) {
                  setPendingProposal(parsed.plan_proposal as PlanProposal);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: fullContent },
        ]);
        setStreamingContent("");
      } catch (err: unknown) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to send message",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, selectedPlanId, toast]
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="flex flex-col h-screen">
      <Header
        title="AI Coach"
        subtitle={selectedPlan ? `Context: ${selectedPlan.name}` : "General coaching"}
        action={
          <div className="flex items-center gap-2">
            {plans.length > 0 && (
              <Select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="text-xs h-8 w-36"
              >
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Clear conversation"
              className="flex items-center justify-center h-8 w-8 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Trash2 size={15} className="text-muted-foreground" />
            </button>
          </div>
        }
      />

      {planModified && selectedPlanId && (
        <a
          href={`/plan/${selectedPlanId}`}
          className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
          onClick={() => setPlanModified(false)}
        >
          <span>Your training plan was updated</span>
          <span className="font-medium underline">View plan →</span>
        </a>
      )}

      {historyLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      ) : (
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          streamingContent={streamingContent}
        />
      )}

      {/* Proposal confirmation card */}
      {pendingProposal && (
        <div className="mx-4 mb-2 rounded-lg border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-semibold mb-2">Proposed changes — {pendingProposal.summary}</p>
          <ul className="space-y-1 mb-3">
            {pendingProposal.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="shrink-0">{ACTION_ICON[change.action] ?? "•"}</span>
                <span>
                  <span className="font-medium">{change.session_title}</span>
                  <span className="text-muted-foreground"> · {change.session_date}</span>
                  <span className="text-muted-foreground"> — {change.change_description}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApplyProposal}
              disabled={isApplying}
              className="h-7 text-xs"
            >
              {isApplying ? "Applying…" : `Apply ${pendingProposal.changes.length} change${pendingProposal.changes.length > 1 ? "s" : ""}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingProposal(null)}
              disabled={isApplying}
              className="h-7 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium mb-1">Clear conversation?</p>
          <p className="text-xs text-muted-foreground mb-3">
            This will permanently delete all messages and remove context from your coach.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearConversation}
              className="h-7 text-xs"
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={isLoading || historyLoading}
        placeholder="Ask your coach anything..."
      />
    </div>
  );
}
