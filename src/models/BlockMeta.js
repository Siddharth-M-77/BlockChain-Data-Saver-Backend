import mongoose from "mongoose";

const blockMetaSchema = new mongoose.Schema(
  {
    number: { type: Number, unique: true, index: true },
    hash: String,
    timestamp: Number,
  },
  { timestamps: true }
);

export const BlockMeta = mongoose.model("BlockMeta", blockMetaSchema);
