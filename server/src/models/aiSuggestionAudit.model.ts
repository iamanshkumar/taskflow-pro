import { Schema, model, Types } from "mongoose";

export interface IAISuggestionAudit {
  workspaceId: Types.ObjectId;
  targetTaskId?: Types.ObjectId;
  targetTaskTitle: string;
  suggestionTaskId: Types.ObjectId;
  suggestionTitle: string;
  rationale: string;
  decision: "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const AISuggestionAuditSchema = new Schema<IAISuggestionAudit>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    targetTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    targetTaskTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    suggestionTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    suggestionTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    rationale: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    decision: {
      type: String,
      enum: ["accepted", "rejected"],
      required: true,
    },
  },
  { timestamps: true },
);

AISuggestionAuditSchema.index({ createdAt: -1 });

export const AISuggestionAudit = model<IAISuggestionAudit>(
  "AISuggestionAudit",
  AISuggestionAuditSchema,
);
