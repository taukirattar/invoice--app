const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("../routes/auth");
const companyRoutes = require("../routes/company");
const customerRoutes = require("../routes/customer");
const itemRoutes = require("../routes/item");
const invoiceRoutes = require("../routes/invoice");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "https://staging.d2lxfc1uxunlcr.amplifyapp.com",
    allowedHeaders: ["Accept", "Content-Type", "Authorization"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  })
);

// app.use(cors());

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Routes
app.use("/auth", authRoutes);
app.use("/company", companyRoutes);
app.use("/customer", customerRoutes);
app.use("/item", itemRoutes);
app.use("/invoice", invoiceRoutes);

app.get("/", (req, res) => {
  res.send("Working");
});

// Start server
const PORT = process.env.PORT || 8087;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
