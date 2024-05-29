const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  customer_company: { type: String, required: true },
  gstin: String,
  state: { type: String, required: true },
  address: { type: String, required: true },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    field: "companyId",
  },
  invoices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
});

module.exports = mongoose.model("Customer", customerSchema);
