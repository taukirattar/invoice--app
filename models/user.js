const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetotp: { type: String },
  verified: { type: String },
  verifyotp: { type: String },
  company_existing: { type: String },
  companies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Company" }],
});

module.exports = mongoose.model("User", userSchema);
