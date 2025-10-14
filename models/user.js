import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    name: { type: String, default: null },
    phoneNumber: { type: String, default: null }, 
    age: { type: Number, default: null },
    sex: { type: String, enum: ["Male", "Female", "Other", null], default: null },
    // ✅ New fields for verification
    verificationCode: { type: String, default: null },
    codeExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);