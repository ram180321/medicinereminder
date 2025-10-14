import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dose: { type: String, required: true },
    time: { type: String, required: true }, // "HH:MM" format
    stock: { type: Number, default: 0 },
    recurrence: { type: String, enum: ["daily", "specific"], default: "daily" },
    days: { type: [String], default: [] }, // Array of strings like ["mon", "wed"]
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Link to the User
}, { timestamps: true });

export default mongoose.model("Medicine", medicineSchema);