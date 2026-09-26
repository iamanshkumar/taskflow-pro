import { Schema, model, Document, Types } from "mongoose";

export type WorkspaceRole = "owner" | "member";

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface IWorkspace extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member"], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [WorkspaceMemberSchema], default: [] },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ "members.userId": 1 });

export const Workspace = model<IWorkspace>("Workspace", WorkspaceSchema);
