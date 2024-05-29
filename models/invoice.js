const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, required: true },
  invoice_date: { type: Date, required: true },
  due_date: { type: String, required: true },
  total_amount: { type: Number, required: true },
  qty: { type: Number, required: true },
  discount: { type: Number, required: true },
  gst: { type: Number, required: true },
  amount: { type: Number, required: true },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    field: "companyId",
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    field: "customerId",
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    field: "itemId",
  },
});

module.exports = mongoose.model("Invoice", invoiceSchema);
