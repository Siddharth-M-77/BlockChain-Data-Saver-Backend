import mongoose from "mongoose";

const tokenVerificationListSchema = new mongoose.Schema(
  {
    name: String,
    symbol: String,
    owner: String,
    supply: Number,
    address: String,
    tokenAddress: String,
    txHash: String,
  },
  { timestamps: true }
);

const TokenVerificationList = mongoose.model(
  "TokenVerificationList",
  tokenVerificationListSchema
);
export default TokenVerificationList;
