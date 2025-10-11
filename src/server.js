import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../src/DB/DB.js";
import morgan from "morgan";
dotenv.config();
import transactionRouter from "../src/routes/transaction.routes.js";
import tokenRouter from "../src/routes/token.routes.js";

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/transactions", transactionRouter);
app.use("/api/token", tokenRouter);
const PORT = 8080;

app.listen(PORT, async () => {
  await connectDB();
  console.log(`✅ API running on http://localhost:${PORT}`);
});
