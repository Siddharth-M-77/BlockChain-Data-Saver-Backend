import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../src/DB/DB.js";
import morgan from "morgan";
dotenv.config();
import transactionRouter from "../src/routes/transaction.routes.js";

const app = express();
app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/transactions", transactionRouter);
const PORT = 8080;

app.listen(PORT, async () => {
  await connectDB();
  console.log(`✅ API running on http://localhost:${PORT}`);
});
