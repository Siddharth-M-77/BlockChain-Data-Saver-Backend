import mongoose, { Schema } from "mongoose";

const tokenSchema = new Schema(
  {
    token: {
      type: Number,
      default: 500,
    },
  },
  {
    timestamps: true,
  }
);

const Token = mongoose.model("Token", tokenSchema);
export default Token;
