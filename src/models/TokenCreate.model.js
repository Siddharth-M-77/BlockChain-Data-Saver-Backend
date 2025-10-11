import mongoose from "mongoose";

const tokenCreateSchema = new mongoose.Schema(
  {
    name: String,
    symbol: String,
    owner: String,
    supply: Number,
    address: String,
    tokenAddress: String,
    txHash: String,
    compilerVersion: { type: String },
    license: { type: String },
    sourceCode: { type: String },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TokenCreate = mongoose.model("TokenCreate", tokenCreateSchema);
export default TokenCreate;
