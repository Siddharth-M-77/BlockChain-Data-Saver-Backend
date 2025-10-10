import mongoose, { Schema } from "mongoose";

const prebookingSchema = new Schema(
  {
    tokensBooked: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
    },
    txHash: {
      type: String,
      default: null,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const Prebooking = mongoose.model("Prebooking", prebookingSchema);
export default Prebooking;
