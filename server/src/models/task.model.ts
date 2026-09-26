import { Schema, model, Document, Types } from "mongoose";

export interface ITask extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  title: string;
  description: string;
  boardStatus: "Backlog" | "In Progress" | "Review" | "Done";
  archivedAt: Date | null;
  startDate: Date;
  durationDays: number;
  dependsOn: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    boardStatus: {
      type: String,
      enum: ["Backlog", "In Progress", "Review", "Done"],
      default: "Backlog",
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    dependsOn: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  {
    timestamps: true,
  },
);

TaskSchema.pre("save", function () {
  const selfRef = this.dependsOn.some((id) => id.equals(this._id));
  if (selfRef) {
    throw new Error("A task cannot depend on itself");
  }
});

TaskSchema.index({ boardStatus: 1 });
TaskSchema.index({ dependsOn: 1 });
TaskSchema.index({ workspaceId: 1, boardStatus: 1 });

export const Task = model<ITask>("Task", TaskSchema);
