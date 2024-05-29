const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  item_code: { type: String, required: true },
  item_details: { type: String, required: true },
  hsn_sac: { type: String, required: true },
  qty: { type: Number, required: true },
  rate: { type: Number, required: true },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    field: "companyId",
  },
  invoices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
});

module.exports = mongoose.model("Item", itemSchema);
