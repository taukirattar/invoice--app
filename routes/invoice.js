const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");

router.post("/create-invoice", invoiceController.createInvoice);
router.get("/get-invoice-by-company", invoiceController.getInvoiceByCompany);
router.delete("/remove-invoice", invoiceController.removeInvoice);
router.get("/get-invoice", invoiceController.getInvoice);
router.get("/get-invoices-report", invoiceController.getInvoicesReport);
router.get("/get-invoices-export", invoiceController.getInvoicesExport);
router.post("/import-invoice", invoiceController.importInvoice);

module.exports = router;
