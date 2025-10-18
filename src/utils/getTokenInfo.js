// utils/tokenInfo.js
import { ethers } from "ethers";
import TokenRegistry from "../models/TokenRegistry.js";
import { logger } from "./logger.js";

const provider = new ethers.JsonRpcProvider(process.env.RPC_HTTP);

const inFlight = new Map();

export async function getTokenInfo(tokenAddress) {
  const addr = tokenAddress.toLowerCase();

  // 1) Check DB cache
  const existing = await TokenRegistry.findOne({ address: addr });
  if (existing) return existing;

  if (inFlight.has(addr)) {
    return inFlight.get(addr);
  }

  // create a promise and store it
  const p = (async () => {
    const abi = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ];

    try {
      // quick guard: ensure contract has code (not EOA)
      const code = await provider.getCode(addr);
      if (!code || code === "0x" || code === "0x0") {
        logger.warn(`Addr ${addr} has no code - not a contract`);
        return { address: addr, name: "Unknown", symbol: "UNK", decimals: 18 };
      }

      const contract = new ethers.Contract(addr, abi, provider);

      // call on-chain (parallel)
      let [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => "Unknown"),
        contract.symbol().catch(() => "UNK"),
        contract.decimals().catch(() => 18),
      ]);

      try {
        decimals = Number(decimals);
      } catch {
        decimals = 18;
      }

      const doc = await TokenRegistry.findOneAndUpdate(
        { address: addr },
        { $setOnInsert: { address: addr, name, symbol, decimals } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      logger.info(`💎 Token info saved: ${symbol} (${addr})`);
      return doc;
    } catch (err) {
      logger.warn(`Failed to fetch token info for ${addr}: ${err.message}`);
      return { address: addr, name: "Unknown", symbol: "UNK", decimals: 18 };
    } finally {
      inFlight.delete(addr);
    }
  })();

  inFlight.set(addr, p);
  return p;
}
