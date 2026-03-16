"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, MapPin, ChevronDown, ChevronUp, Pencil, X, Save } from "lucide-react";
import { cn, SESSION_TYPE_COLORS, SESSION_TYPE_ICONS, INTENSITY_COLORS, formatDuration, formatDistance, formatDate } from "@/lib/utils";
import type { TrainingSession } from "@/types";

interface SessionCardProps {
  session: TrainingSession;
  onToggleComplete?: (id: string, completed: boolean) => void;
  onUpdate?: (id: string, updates: { description?: string | null; duration_minutes?: number | null }) => Promise<void>;
  compact?: boolean;
}

export function SessionCard({ session, onToggleComplete, onUpdate, compact = false }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(session.description ?? "");
  const [editDuration, setEditDuration] = useState(session.duration_minutes ?? 0);
  const [saving, setSaving] = useState(false);

  const isRest = session.session_type === "rest";
  const colorClass = SESSION_TYPE_COLORS[session.session_type] ?? SESSION_TYPE_COLORS.rest;
  const icon = SESSION_TYPE_ICONS[session.session_type] ?? "💪";
  const intensityColor = session.intensity ? INTENSITY_COLORS[session.intensity] : "";

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(session.id, {
        description: editDescription || null,
        duration_minutes: editDuration > 0 ? editDuration : null,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDescription(session.description ?? "");
    setEditDuration(session.duration_minutes ?? 0);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200",
        session.completed ? "opacity-60" : "",
        colorClass.split(" ").slice(1).join(" "),
        "bg-card"
      )}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => !compact && !isRest && !isEditing && setExpanded((e) => !e)}
      >
        {/* Complete toggle */}
        {onToggleComplete && !isRest && (
          <button
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(session.id, !session.completed);
            }}
          >
            {session.completed ? (
              <CheckCircle2 size={22} className="text-green-400" />
            ) : (
              <Circle size={22} />
            )}
          </button>
        )}

        {/* Sport icon badge */}
        <div className={cn("text-xl shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border", colorClass)}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("font-semibold text-sm truncate", session.completed && "line-through text-muted-foreground")}>
              {session.title}
            </p>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(session.date, "EEE, MMM d")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {session.duration_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} />
                {formatDuration(session.duration_minutes)}
              </span>
            )}
            {session.distance && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={11} />
                {formatDistance(session.distance, session.distance_unit)}
              </span>
            )}
            {session.intensity && (
              <span className={cn("text-xs font-medium capitalize", intensityColor)}>
                {session.intensity}
              </span>
            )}
          </div>
        </div>

        {/* Edit + Expand buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {onUpdate && !isRest && !compact && (
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setIsEditing((v) => !v);
              }}
            >
              <Pencil size={14} />
            </button>
          )}
          {!compact && !isRest && session.description && (
            <button className="text-muted-foreground p-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details / edit mode */}
      {expanded && !compact && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-2">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background text-sm p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  className="w-full rounded-lg border border-border bg-background text-sm p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editDuration || ""}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save size={12} />
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {session.description && (
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {session.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {session.heart_rate_zone && (
                  <span className="bg-secondary rounded-lg px-2 py-1">
                    HR Zone: {session.heart_rate_zone}
                  </span>
                )}
                {session.pace_target && (
                  <span className="bg-secondary rounded-lg px-2 py-1">
                    Pace: {session.pace_target}
                  </span>
                )}
              </div>
              {session.notes && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                  {session.notes}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
