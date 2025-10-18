// watcher-crosschain.js
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const BSC_RPC = process.env.BSC_RPC;
const RPC_HTTP = process.env.CBM_RPC;
const USDT_ADDRESS_ON_BSC = process.env.USDT_ADDRESS_ON_BSC;
const EXCHANGE_WALLET = (process.env.EXCHANGE_WALLET || "").toLowerCase();
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const USDT_PER_CBM = Number(process.env.USDT_PER_CBM || "10");
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || 3);
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 15000);

if (
  !BSC_RPC ||
  !RPC_HTTP ||
  !USDT_ADDRESS_ON_BSC ||
  !EXCHANGE_WALLET ||
  !ADMIN_PRIVATE_KEY
) {
  console.error("Please set env vars correctly.");
  process.exit(1);
}

const bscProvider = new ethers.JsonRpcProvider(BSC_RPC);
const cbmProvider = new ethers.JsonRpcProvider(CBM_RPC);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, cbmProvider);

// ERC20 minimal ABI for Transfer event + decimals
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)",
];

const usdtContract = new ethers.Contract(
  USDT_ADDRESS_ON_BSC,
  ERC20_ABI,
  bscProvider
);

// Persist processed transactions to avoid duplicate processing
const DB_FILE = path.join(__dirname, "processed_cross_tx.json");
let processed = {};
try {
  if (fs.existsSync(DB_FILE)) processed = JSON.parse(fs.readFileSync(DB_FILE));
} catch (e) {
  processed = {};
}
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(processed, null, 2));
}

async function handleEvent(txHash, from, to, value, blockNumber) {
  if (to.toLowerCase() !== EXCHANGE_WALLET) return;
  if (processed[txHash]) {
    console.log("Already processed:", txHash);
    return;
  }

  console.log(
    `Detected incoming USDT tx ${txHash} from ${from} amount ${value.toString()} at block ${blockNumber}`
  );
  try {
    // wait for confirmations
    const targetBlock = blockNumber + CONFIRMATIONS;
    let current = await bscProvider.getBlockNumber();
    while (current < targetBlock) {
      console.log(`Waiting for confirmations... ${current}/${targetBlock}`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      current = await bscProvider.getBlockNumber();
    }

    // get decimals and convert to human amount
    const decimals = await usdtContract.decimals();
    const usdtAmount = Number(ethers.formatUnits(value, decimals));
    const cbmToSendDecimal = usdtAmount / USDT_PER_CBM;
    if (cbmToSendDecimal <= 0) {
      console.log("CBM to send 0 — skip");
      processed[txHash] = { status: "skipped_zero", usdtAmount };
      saveDB();
      return;
    }

    // send native CBM from admin wallet to 'from' on CBM chain
    const cbmAmountWei = ethers.parseEther(cbmToSendDecimal.toString());
    console.log(
      `Sending ${cbmToSendDecimal} CBM (${cbmAmountWei}) to ${from} on CBM chain`
    );

    const tx = await adminWallet.sendTransaction({
      to: from,
      value: cbmAmountWei,
      // optionally set gasLimit/gasPrice depending on chain
    });
    console.log("CBM send tx hash:", tx.hash);
    await tx.wait();
    console.log("CBM sent confirmed:", tx.hash);

    processed[txHash] = {
      status: "done",
      usdtAmount,
      cbmSent: cbmToSendDecimal,
      cbmTxHash: tx.hash,
    };
    saveDB();
  } catch (err) {
    console.error("Error processing event:", err);
    processed[txHash] = { status: "error", error: String(err) };
    saveDB();
  }
}

async function pollPastEvents() {
  try {
    const latest = await bscProvider.getBlockNumber();
    const fromBlock = Math.max(0, latest - 1000);
    const filter = usdtContract.filters.Transfer(null, EXCHANGE_WALLET);
    const events = await usdtContract.queryFilter(filter, fromBlock, latest);
    for (const ev of events) {
      const txHash = ev.transactionHash;
      if (!processed[txHash]) {
        const [from, to, value] = ev.args;
        await handleEvent(txHash, from, to, value, ev.blockNumber);
      }
    }
  } catch (err) {
    console.error("Poll error:", err);
  }
}

async function main() {
  console.log(
    "Watcher starting — listening for USDT => EXCHANGE_WALLET on BSC"
  );
  // Event subscription (fast)
  const filter = usdtContract.filters.Transfer(null, EXCHANGE_WALLET);
  bscProvider.on(filter, async (log) => {
    try {
      const parsed = usdtContract.interface.parseLog(log);
      const [from, to, value] = parsed.args;
      const txHash = log.transactionHash;
      // get block number from log
      const blockNumber = log.blockNumber;
      handleEvent(txHash, from, to, value, blockNumber);
    } catch (err) {
      console.error("on event parse error:", err);
    }
  });

  // Poll fallback
  setInterval(pollPastEvents, POLL_INTERVAL);
  // initial poll once
  await pollPastEvents();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
