const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

router.get("/get-customers", customerController.getCustomers);
router.post("/add-customer", customerController.addCustomer);
router.put("/update-customer", customerController.updateCustomer);
router.delete("/remove-customer", customerController.removeCustomer);
router.get("/get-all-customers", customerController.getAllCustomers);
router.get("/get-customers-report", customerController.getCustomersReport);
router.get("/get-customers-export", customerController.getCustomersExport);
router.post("/import-customer", customerController.importCustomer);

module.exports = router;
