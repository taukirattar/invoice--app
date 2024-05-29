const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const Customer = require("../models/customer");
const Invoice = require("../models/invoice");
// const redis = require("ioredis");

// const client = new redis({
//   host: "az-cache-wetxfl.serverless.use1.cache.amazonaws.com",
//   port: 6379,
//   tls: {
//     rejectUnauthorized: false,
//   },
// });

require("dotenv").config();

exports.getCustomers = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const company = await Company.findOne({
      user: userId,
      selected_company: "Y",
    });

    if (!company) {
      res.status(404);
      return res.json({ message: "Company not found" });
    }

    // const cachedData = await client.get(`customersof${userId}${company._id}`);

    const cachedData = null;

    if (cachedData) {
      res.status(200);
      res.json(JSON.parse(cachedData));
    } else {
      const customers = await Customer.find({ company: company._id });

      // await client.set(
      //   `customersof${userId}${company._id}`,
      //   JSON.stringify(customers)
      // );

      res.status(200);
      res.json(customers);
    }
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getAllCustomers = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const companies = await Company.find({
      user: userId,
    });

    if (!companies || companies.length === 0) {
      res.status(404);
      return res.json({ message: "Companies not found" });
    }

    const customerPromises = companies.map((company) =>
      Customer.find({ company: company._id })
    );

    const customers = await Promise.all(customerPromises);

    const flattenedCustomers = customers.flat();

    res.status(200);
    res.json(flattenedCustomers);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.addCustomer = async (req, res) => {
  const { token, name, email, phone, customer_company, gstin, state, address } =
    req.body;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const company = await Company.findOne({
      user: userId,
      selected_company: "Y",
    });

    const existingCustomer = await Customer.findOne({
      email,
      company: company._id,
    });

    if (existingCustomer) {
      res.status(409);
      return res.json({ message: "Customer already exists!" });
    }

    const newCustomer = await Customer.create({
      name,
      email,
      phone,
      customer_company,
      gstin,
      state,
      address,
      company: company._id,
    });

    // await client.del(`customersof${userId}${company._id}`);

    res.status(201);
    res.json(newCustomer);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  const { id, name, email, phone, customer_company, gstin, state, address } =
    req.body;
  try {
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: id },
      { name, email, phone, customer_company, gstin, state, address },
      { new: true }
    );

    if (!updatedCustomer) {
      res.status(404);
      return res.json({ message: "Customer not found" });
    }

    const companyId = updatedCustomer.company._id;

    const company = await Company.findOne({ _id: companyId });

    const userId = company.user._id;

    // await client.del(`customersof${userId}${companyId}`);

    res.status(200);
    res.json(updatedCustomer);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.removeCustomer = async (req, res) => {
  const { id } = req.query;
  try {
    const invoices = await Invoice.find({ customer: id });
    if (invoices.length > 0) {
      res.status(200);
      return res.json({
        message: "Please first delete invoices related to customer!",
      });
    }

    const deletedCustomer = await Customer.findByIdAndDelete(id);

    const companyId = deletedCustomer.company._id;

    const company = await Company.findOne({ _id: companyId });

    const userId = company.user._id;

    // await client.del(`customersof${userId}${companyId}`);

    res.status(200);
    res.json({ message: "Customer removed successfully" });
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getCustomersReport = async (req, res) => {
  let { token, companyId, customerId } = req.query;
  try {
    let companies;
    if (companyId === undefined) {
      companyId = "";
    }
    if (customerId === undefined) {
      customerId = "";
    }
    if (companyId === "") {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      const userId = decoded.id;

      companies = await Company.find({ user: userId });
    } else {
      companies = await Company.find({ _id: companyId });
    }

    if (!companies || companies.length === 0) {
      res.status(200);
      return res.json({ message: "Companies not found" });
    }

    let customerPromises;

    if (customerId === "") {
      customerPromises = companies.map((company) =>
        Customer.find({ company: company._id }).populate("company", "name")
      );
    } else {
      customerPromises = companies.map((company) =>
        Customer.find({ company: company._id, _id: customerId }).populate(
          "company",
          "name"
        )
      );
    }

    const customers = await Promise.all(customerPromises);

    const flattenedCustomers = customers.flat();

    const customersWithCompanyName = flattenedCustomers.map((customer) => ({
      ...customer._doc,
      companyName: customer.company.name,
      __typename: "CustomersWithCompanyNames",
    }));

    res.status(200);
    res.json(customersWithCompanyName);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getCustomersExport = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    companies = await Company.find({ user: userId });

    if (!companies || companies.length === 0) {
      res.status(200);
      return res.json({ message: "Companies not found" });
    }

    let customerPromises;

    customerPromises = companies.map((company) =>
      Customer.find({ company: company._id }).populate("company", "name")
    );

    const customers = await Promise.all(customerPromises);

    const flattenedCustomers = customers.flat();

    const customersWithCompanyName = flattenedCustomers.map((customer) => ({
      ...customer._doc,
      companyName: customer.company.name,
      __typename: "CustomersWithCompanyNames",
    }));

    res.status(200);
    res.json(customersWithCompanyName);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.importCustomer = async (req, res) => {
  const { token, input } = req.body;
  const {
    name,
    email,
    phone,
    customer_company,
    gstin,
    state,
    address,
    companyName,
  } = input;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const company = await Company.findOne({
      user: userId,
      name: companyName,
    });

    if (!company) {
      res.status(404);
      return res.json({ message: "Company not found" });
    }

    const existingCustomer = await Customer.findOne({
      email,
      company: company._id,
    });

    if (existingCustomer) {
      res.status(200);
      return res.json({ message: "Customer already exists!" });
    }

    const newCustomer = await Customer.create({
      name,
      email,
      phone,
      customer_company,
      gstin,
      state,
      address,
      company: company._id,
    });

    res.status(201);
    res.json(newCustomer);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};
