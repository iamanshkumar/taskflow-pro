import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  displayName: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser>("User", UserSchema);
