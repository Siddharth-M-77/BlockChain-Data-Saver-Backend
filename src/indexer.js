// // import dotenv from "dotenv";
// // dotenv.config();

// // import mongoose from "mongoose";
// // import { ethers } from "ethers";
// // import cron from "node-cron";
// // import { BlockMeta } from "./models/BlockMeta.js";
// // import { logger } from "./utils/logger.js";
// // import Transaction from "./models/Transaction.model.js";
// // import connectToDB from "./DB/DB.js";

// // const RPC_HTTP = process.env.RPC_HTTP;
// // console.log(RPC_HTTP, "RPC_HTTP");
// // const RPC_WS = process.env.RPC_WS;
// // const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
// // const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
// // const USE_WS = process.env.USE_WS === "true";

// // const provider = USE_WS
// //   ? new ethers.WebSocketProvider(RPC_WS)
// //   : new ethers.JsonRpcProvider(RPC_HTTP);
// // let isIndexing = false;

// // async function getLastIndexedBlock() {
// //   const last = await BlockMeta.findOne().sort({ number: -1 });
// //   return last ? last.number : -1;
// // }

// // async function saveBlockMeta(block) {
// //   await BlockMeta.updateOne(
// //     { number: block.number },
// //     { hash: block.hash, timestamp: block.timestamp },
// //     { upsert: true }
// //   );
// // }

// // async function processBlocks(start, end) {
// //   for (let i = start; i <= end; i++) {
// //     try {
// //       const block = await provider.send("eth_getBlockByNumber", [
// //         ethers.toQuantity(i),
// //         true,
// //       ]);

// //       if (!block) continue;

// //       const txDocs = block.transactions.map((tx) => ({
// //         hash: tx.hash,
// //         from: tx.from,
// //         to: tx.to || null,
// //         value: tx.value || "0x0",
// //         gasUsed: tx.gas || "0x0",
// //         gasPrice: tx.gasPrice || "0x0",
// //         nonce: parseInt(tx.nonce),
// //         blockNumber: parseInt(block.number),
// //         timeStamp: parseInt(block.timestamp),
// //       }));

// //       if (txDocs.length > 0) {
// //         await Transaction.insertMany(txDocs, { ordered: false });
// //         logger.info(`✅ Indexed block ${i} (${txDocs.length} txs)`);
// //       } else {
// //         logger.info(`📭 Block ${i} empty`);
// //       }

// //       await saveBlockMeta({
// //         number: parseInt(block.number),
// //         hash: block.hash,
// //         timestamp: parseInt(block.timestamp),
// //       });
// //     } catch (err) {
// //       logger.error(`❌ Error processing block ${i}: ${err.message}`);
// //     }
// //   }
// // }

// // async function indexerJob() {
// //   if (isIndexing) return;
// //   isIndexing = true;

// //   try {
// //     const latest = await provider.getBlockNumber();
// //     console.log(latest, "latest");
// //     let lastIndexed = await getLastIndexedBlock();

// //     if (lastIndexed >= latest) {
// //       logger.info("🟢 No new blocks to index");
// //       isIndexing = false;
// //       return;
// //     }

// //     while (lastIndexed < latest) {
// //       const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
// //       logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
// //       await processBlocks(lastIndexed + 1, nextEnd);
// //       lastIndexed = nextEnd;
// //     }
// //   } catch (error) {
// //     logger.error(`❌ Indexer job failed: ${error.message}`);
// //   }

// //   isIndexing = false;
// // }

// // async function startIndexer() {
// //   await connectToDB();
// //   logger.info("🚀 Indexer started");

// //   await indexerJob();

// //   cron.schedule(CRON_SCHEDULE, async () => {
// //     logger.info("⏰ Cron triggered");
// //     await indexerJob();
// //   });
// // }

// // startIndexer();

// // process.on("SIGINT", async () => {
// //   await mongoose.disconnect();
// //   logger.info("🛑 Indexer stopped");
// //   process.exit(0);
// // });

// import dotenv from "dotenv";
// import { formatUnits } from "ethers";
// dotenv.config();

// import mongoose from "mongoose";
// import { ethers } from "ethers";
// import cron from "node-cron";
// import BlockMeta from "./models/BlockMeta.js";
// import { logger } from "./utils/logger.js";
// import Transaction from "./models/Transaction.model.js";
// import connectToDB from "./DB/DB.js";

// // ⚙️ ENV Setup
// const RPC_HTTP = process.env.RPC_HTTP;
// const RPC_WS = process.env.RPC_WS;
// const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
// const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
// const USE_WS = process.env.USE_WS === "true";

// const provider = USE_WS
//   ? new ethers.WebSocketProvider(RPC_WS)
//   : new ethers.JsonRpcProvider(RPC_HTTP);

// let isIndexing = false;

// // 🪙 RBM Token Config
// const RBM_TOKEN_ADDRESS = "0x1E6883014f406f3c5d578c888B6dE9702cd22Be8";
// const RBM_ABI = [
//   "event Transfer(address indexed from, address indexed to, uint256 value)",
// ];
// const rbmInterface = new ethers.Interface(RBM_ABI);

// // ✅ Get last indexed block
// async function getLastIndexedBlock() {
//   const last = await BlockMeta.findOne().sort({ number: -1 });
//   return last ? last.number : -1;
// }

// // ✅ Save block meta info
// async function saveBlockMeta(block) {
//   await BlockMeta.updateOne(
//     { number: block.number },
//     { hash: block.hash, timestamp: block.timestamp },
//     { upsert: true }
//   );
// }

// // ✅ Decode RBM token Transfer events
// function decodeRbmTransfers(receipt) {
//   const transfers = [];

//   for (const log of receipt.logs || []) {
//     if (log.address.toLowerCase() === RBM_TOKEN_ADDRESS.toLowerCase()) {
//       try {
//         const parsed = rbmInterface.parseLog(log);
//         if (parsed.name === "Transfer") {
//           const humanValue = formatUnits(parsed.args.value, 18);
//           transfers.push({
//             tokenName: "RBM",
//             tokenAddress: RBM_TOKEN_ADDRESS,
//             from: parsed.args.from,
//             to: parsed.args.to,
//             value: humanValue,
//           });
//         }
//       } catch {}
//     }
//   }

//   return transfers;
// }

// // ✅ Process each block
// async function processBlocks(start, end) {
//   for (let i = start; i <= end; i++) {
//     try {
//       const block = await provider.send("eth_getBlockByNumber", [
//         ethers.toQuantity(i),
//         true,
//       ]);
//       if (!block) continue;

//       const txDocs = [];

//       for (const tx of block.transactions) {
//         const txData = {
//           hash: tx.hash,
//           from: tx.from,
//           to: tx.to || null,
//           value: tx.value || "0x0",
//           gasUsed: tx.gas || "0x0",
//           gasPrice: tx.gasPrice || "0x0",
//           nonce: parseInt(tx.nonce),
//           blockNumber: parseInt(block.number),
//           timeStamp: parseInt(block.timestamp),
//           type: "native",
//         };

//         const receipt = await provider.getTransactionReceipt(tx.hash);
//         if (!receipt) continue;

//         const rbmTransfers = decodeRbmTransfers(receipt);
//         if (rbmTransfers.length > 0) {
//           txData.type = "token";
//           txData.tokenTransfers = rbmTransfers;
//         }

//         txDocs.push(txData);
//       }

//       if (txDocs.length > 0) {
//         await Transaction.insertMany(txDocs, { ordered: false });
//         logger.info(`✅ Indexed Block ${i} (${txDocs.length} txs)`);
//       } else {
//         logger.info(`📭 Block ${i} empty`);
//       }

//       await saveBlockMeta({
//         number: parseInt(block.number),
//         hash: block.hash,
//         timestamp: parseInt(block.timestamp),
//       });
//     } catch (err) {
//       logger.error(`❌ Error processing block ${i}: ${err.message}`);
//     }
//   }
// }

// // 🔁 Indexer Job
// async function indexerJob() {
//   if (isIndexing) return;
//   isIndexing = true;

//   try {
//     const latest = await provider.getBlockNumber();
//     let lastIndexed = await getLastIndexedBlock();

//     if (lastIndexed >= latest) {
//       logger.info("🟢 No new blocks to index");
//       isIndexing = false;
//       return;
//     }

//     while (lastIndexed < latest) {
//       const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
//       logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
//       await processBlocks(lastIndexed + 1, nextEnd);
//       lastIndexed = nextEnd;
//     }
//   } catch (error) {
//     logger.error(`❌ Indexer job failed: ${error.message}`);
//   }

//   isIndexing = false;
// }

// // 🚀 Start Indexer
// async function startIndexer() {
//   await connectToDB();
//   logger.info("🚀 RBM Indexer started");

//   await indexerJob();

//   cron.schedule(CRON_SCHEDULE, async () => {
//     logger.info("⏰ Cron triggered");
//     await indexerJob();
//   });
// }

// startIndexer();

// // 🛑 Graceful Shutdown
// process.on("SIGINT", async () => {
//   await mongoose.disconnect();
//   logger.info("🛑 Indexer stopped");
//   process.exit(0);
// });

import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";
import { ethers, formatUnits } from "ethers";

import BlockMeta from "./models/BlockMeta.js";
import Transaction from "./models/Transaction.model.js";
import UserHolding from "./models/UserHolding.js";
import TokenRegistry from "./models/TokenRegistry.js";
import { logger } from "./utils/logger.js";
import connectToDB from "./DB/DB.js";
import { updateBalances } from "./utils/updatebalance.js";

dotenv.config();

// ⚙️ ENV Setup
const RPC_HTTP = process.env.RPC_HTTP;
const RPC_WS = process.env.RPC_WS;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 50);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/1 * * * *";
const USE_WS = process.env.USE_WS === "true";

const provider = USE_WS
  ? new ethers.WebSocketProvider(RPC_WS)
  : new ethers.JsonRpcProvider(RPC_HTTP);

let isIndexing = false;

// ✅ Get last indexed block
async function getLastIndexedBlock() {
  const last = await BlockMeta.findOne().sort({ number: -1 });
  return last ? last.number : -1;
}

async function saveBlockMeta(block) {
  await BlockMeta.updateOne(
    { number: block.number },
    { hash: block.hash, timestamp: block.timestamp },
    { upsert: true }
  );
}

// async function getTokenInfo(tokenAddress) {
//   const addr = tokenAddress.toLowerCase();
//   let existing = await TokenRegistry.findOne({ address: addr });

//   const abi = [
//     "function name() view returns (string)",
//     "function symbol() view returns (string)",
//     "function decimals() view returns (uint8)",
//   ];

//   // const contract = new ethers.Contract(addr, abi, provider);

//   // ⚙️ fresh provider per token to avoid symbol caching bug
//   const freshProvider = new ethers.JsonRpcProvider(
//     process.env.RPC_HTTP + `?nocache=${Date.now()}`
//   );
//   const contract = new ethers.Contract(addr, abi, freshProvider);

//   try {
//     // ✅ Always try direct fetch first
//     const [name, symbol, decimalsRaw] = await Promise.all([
//       contract.name().catch(() => null),
//       contract.symbol().catch(() => null),
//       contract.decimals().catch(() => null),
//     ]);

//     const decimals = decimalsRaw ? Number(decimalsRaw) : 18;

//     // ✅ If fetched symbol different from DB, always overwrite
//     if (
//       !existing ||
//       existing.symbol !== symbol ||
//       existing.name !== name ||
//       existing.decimals !== decimals
//     ) {
//       existing = await TokenRegistry.findOneAndUpdate(
//         { address: addr },
//         {
//           name: name || "Unknown",
//           symbol: symbol || "UNK",
//           decimals,
//         },
//         { new: true, upsert: true }
//       );
//       logger.info(`💎 Updated token registry: ${symbol || "UNK"} (${addr})`);
//     }

//     return existing;
//   } catch (err) {
//     logger.warn(`⚠️ Token fetch failed for ${addr}: ${err.message}`);

//     // ✅ Force re-fetch after short delay once if RPC timed out
//     try {
//       const fallbackContract = new ethers.Contract(addr, abi, provider);
//       const [name, symbol, decimalsRaw] = await Promise.all([
//         fallbackContract.name().catch(() => "Unknown"),
//         fallbackContract.symbol().catch(() => "UNK"),
//         fallbackContract.decimals().catch(() => 18),
//       ]);

//       const decimals = Number(decimalsRaw);
//       existing = await TokenRegistry.findOneAndUpdate(
//         { address: addr },
//         { name, symbol, decimals },
//         { new: true, upsert: true }
//       );
//       logger.info(`🔁 Retried and saved token info: ${symbol} (${addr})`);
//       return existing;
//     } catch (fallbackErr) {
//       logger.error(`❌ Fallback failed: ${fallbackErr.message}`);
//       return (
//         existing || {
//           address: addr,
//           name: "Unknown",
//           symbol: "UNK",
//           decimals: 18,
//         }
//       );
//     }
//   }
// }

// ✅ User token holdings update

async function getTokenInfo(tokenAddress) {
  const addr = tokenAddress.toLowerCase();
  let existing = await TokenRegistry.findOne({ address: addr });

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];

  // 🧠 Fresh provider for every call to avoid cached symbols
  const freshProvider = new ethers.JsonRpcProvider(
    process.env.RPC_HTTP + `?nocache=${Date.now()}`
  );
  const contract = new ethers.Contract(addr, abi, freshProvider);

  try {
    // 🟢 1️⃣ Log token address being fetched
    console.log("🔍 Fetching token info for:", addr);

    // 🟢 2️⃣ Fetch actual on-chain values
    const [name, symbol, decimalsRaw] = await Promise.all([
      contract.name().catch(() => null),
      contract.symbol().catch(() => null),
      contract.decimals().catch(() => null),
    ]);

    const decimals = decimalsRaw ? Number(decimalsRaw) : 18;

    // 🟢 Log what RPC returned
    console.log("🧾 RPC DATA:", {
      name,
      symbol,
      decimals,
    });

    // 🟠 Log what’s already in DB
    if (existing) {
      console.log("📦 EXISTING DB ENTRY:", {
        name: existing.name,
        symbol: existing.symbol,
        decimals: existing.decimals,
      });
    } else {
      console.log("📦 No existing DB entry found, creating new.");
    }

    // 🔴 Check if RPC data mismatches DB data
    if (
      existing &&
      symbol &&
      existing.symbol.toLowerCase() !== symbol.toLowerCase()
    ) {
      console.log(
        `⚠️ SYMBOL MISMATCH: existing=${existing.symbol} fetched=${symbol}`
      );

      existing = await TokenRegistry.findOneAndUpdate(
        { address: addr },
        { name, symbol, decimals },
        { new: true, upsert: true }
      );

      console.log(`🔁 FIXED SYMBOL: Now set to ${symbol}`);
    }

    // ✅ If new or changed, update registry
    if (
      !existing ||
      existing.symbol !== symbol ||
      existing.name !== name ||
      existing.decimals !== decimals
    ) {
      existing = await TokenRegistry.findOneAndUpdate(
        { address: addr },
        {
          name: name || "Unknown",
          symbol: symbol || "UNK",
          decimals,
        },
        { new: true, upsert: true }
      );
      console.log(`💾 Updated token registry entry: ${symbol || "UNK"}`);
    }

    // console.log("✅ Returning final token info:", {
    //   address: existing.address,
    //   name: existing.name,
    //   symbol: existing.symbol,
    //   decimals: existing.decimals,
    // });

    return existing;
  } catch (err) {
    console.log(`❌ ERROR FETCHING TOKEN ${addr}:`, err.message);

    try {
      // Retry once
      const fallbackContract = new ethers.Contract(addr, abi, freshProvider);
      const [name, symbol, decimalsRaw] = await Promise.all([
        fallbackContract.name().catch(() => "Unknown"),
        fallbackContract.symbol().catch(() => "UNK"),
        fallbackContract.decimals().catch(() => 18),
      ]);
      const decimals = Number(decimalsRaw);

      existing = await TokenRegistry.findOneAndUpdate(
        { address: addr },
        { name, symbol, decimals },
        { new: true, upsert: true }
      );

      console.log(`🔁 RETRY SUCCESS: ${symbol} (${addr})`);
      return existing;
    } catch (fallbackErr) {
      console.log(`❌ FALLBACK FAILED for ${addr}:`, fallbackErr.message);
      return (
        existing || {
          address: addr,
          name: "Unknown",
          symbol: "UNK",
          decimals: 18,
        }
      );
    }
  }
}

async function updateHoldings(from, to, tokenAddress, symbol, name, value) {
  const val = parseFloat(value || 0);
  if (val <= 0) return;

  if (from && from !== ethers.ZeroAddress) {
    await UserHolding.updateOne(
      { address: from, tokenAddress },
      {
        $inc: { balance: -val },
        $setOnInsert: { tokenSymbol: symbol, tokenName: name },
      },
      { upsert: true }
    );
  }

  if (to && to !== ethers.ZeroAddress) {
    await UserHolding.updateOne(
      { address: to, tokenAddress },
      {
        $inc: { balance: val },
        $setOnInsert: { tokenSymbol: symbol, tokenName: name },
      },
      { upsert: true }
    );
  }
}

// ✅ Decode ERC-20 Transfers
// async function decodeAllTokenTransfers(receipt) {
//   const transfers = [];
//   const iface = new ethers.Interface([
//     "event Transfer(address indexed from, address indexed to, uint256 value)",
//   ]);

//   for (const log of receipt.logs || []) {
//     if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
//       try {
//         const parsed = iface.parseLog(log);
//         const tokenAddress = log.address.toLowerCase();
//         const token = await getTokenInfo(tokenAddress);
//         const humanValue = formatUnits(parsed.args.value, token.decimals);

//         transfers.push({
//           tokenName: token.name,
//           tokenSymbol: token.symbol,
//           tokenAddress,
//           from: parsed.args.from,
//           to: parsed.args.to,
//           value: humanValue,
//         });
//       } catch (err) {
//         logger.warn(`Failed to decode token transfer: ${err.message}`);
//       }
//     }
//   }

//   return transfers;
// }

async function decodeAllTokenTransfers(receipt) {
  const transfers = [];
  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  // 🧠 Deep clone logs to break reference
  const safeLogs = JSON.parse(JSON.stringify(receipt.logs || []));

  for (const log of safeLogs) {
    try {
      if (
        !log.topics ||
        log.topics.length === 0 ||
        log.topics[0] !== ethers.id("Transfer(address,address,uint256)")
      )
        continue;

      const tokenAddress = log.address?.toLowerCase();
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) continue;

      const parsed = iface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      const token = await getTokenInfo(tokenAddress);
      const humanValue = formatUnits(parsed.args.value, token.decimals);

      if (parseFloat(humanValue) === 0) continue;

      // ✅ force isolate new object
      const transferData = {
        tokenAddress,
        from: parsed.args.from,
        to: parsed.args.to,
        value: humanValue,
        tokenName: token.name || "Unknown",
        tokenSymbol: token.symbol || "UNK",
        tokenDecimals: token.decimals || 18,
      };

      // console.log("🎯 CLEAN TRANSFER:", transferData);

      transfers.push(transferData);
    } catch (err) {
      logger.warn(`Failed to decode token transfer: ${err.message}`);
    }
  }

  return transfers;
}

// ✅ Block processor (null-safe + tx-safe)
async function processBlocks(start, end) {
  for (let i = start; i <= end; i++) {
    try {
      const block = await provider.send("eth_getBlockByNumber", [
        ethers.toQuantity(i),
        true,
      ]);
      if (!block) continue;

      const txDocs = [];

      for (const tx of block.transactions) {
        try {
          const safeValue = tx?.value ?? "0x0";

          const txData = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to || null,
            value: safeValue,
            gasUsed: tx.gas || "0x0",
            gasPrice: tx.gasPrice || tx.maxFeePerGas || "0x0",
            nonce: Number(tx.nonce ?? 0),
            blockNumber: Number(block.number),
            timeStamp: Number(block.timestamp),
            type: "native",
          };

          // await updateBalances(tx.from, tx.to, safeValue);
          await updateBalances(tx);

          // ⚙️ Fresh provider per transaction to avoid stale cached logs
          const freshProvider = new ethers.JsonRpcProvider(
            process.env.RPC_HTTP + `?nocache=${Date.now()}`
          );
          const receipt = await freshProvider.getTransactionReceipt(tx.hash);

          if (!receipt) continue;

          const tokenTransfers = await decodeAllTokenTransfers(receipt);

          if (tokenTransfers.length > 0) {
            txData.type = "token";

            // 🧠 Deep clone to break reference (no RBM overwrite)
            // txData.tokenTransfers = JSON.parse(JSON.stringify(tokenTransfers));
            txData.tokenTransfers = tokenTransfers.map((t) => ({
              tokenAddress: t.tokenAddress,
              from: t.from,
              to: t.to,
              value: t.value,
              symbol: t.tokenSymbol,
              name: t.tokenName,
              decimals: t.tokenDecimals,
            }));

            for (const t of txData.tokenTransfers) {
              await updateHoldings(
                t.from,
                t.to,
                t.tokenAddress,
                t.tokenSymbol,
                t.tokenName,
                t.value
              );
            }

            // 🧩 Debug log per TX
            console.log("💾 SAVING TX:", {
              hash: tx.hash,
              tokenSymbols: txData.tokenTransfers.map((x) => x.tokenSymbol),
            });
          }

          txDocs.push(txData);
        } catch (txErr) {
          logger.error(
            `⚠️ Error in tx inside block ${i}: ${txErr.message || txErr}`
          );
        }
      }

      if (txDocs.length > 0) {
        await Transaction.insertMany(txDocs, { ordered: false });
        logger.info(`✅ Indexed Block ${i} (${txDocs.length} txs)`);
      } else {
        logger.info(`📭 Block ${i} empty`);
      }

      await saveBlockMeta({
        number: Number(block.number),
        hash: block.hash,
        timestamp: Number(block.timestamp),
      });
    } catch (err) {
      logger.error(`❌ Error processing block ${i}: ${err.message}`);
    }
  }
}

// ✅ Cron job for indexing new blocks
async function indexerJob() {
  if (isIndexing) return;
  isIndexing = true;

  try {
    const latest = await provider.getBlockNumber();
    let lastIndexed = await getLastIndexedBlock();

    if (lastIndexed >= latest) {
      logger.info("🟢 No new blocks to index");
      isIndexing = false;
      return;
    }

    while (lastIndexed < latest) {
      const nextEnd = Math.min(latest, lastIndexed + BATCH_SIZE);
      logger.info(`🔹 Indexing ${lastIndexed + 1} → ${nextEnd}`);
      await processBlocks(lastIndexed + 1, nextEnd);
      lastIndexed = nextEnd;
    }
  } catch (error) {
    logger.error(`❌ Indexer job failed: ${error.message}`);
  }

  isIndexing = false;
}

// ✅ Start the indexer
async function startIndexer() {
  await connectToDB();
  logger.info("🚀 Multi-Token Indexer Started");

  await indexerJob();

  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info("⏰ Cron triggered");
    await indexerJob();
  });
}

startIndexer();

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  logger.info("🛑 Indexer stopped");
  process.exit(0);
});
