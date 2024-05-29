const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Company = require("../models/company");
const Item = require("../models/item");
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

exports.getCompanyExistingFlag = async (req, res) => {
  const { token, sample_data } = req.query;
  try {
    console.log("token inside getCompanyExistingFlag", token);
    console.log("sample_data", sample_data);
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    console.log("decoded", decoded);
    const user = await User.findOne({ _id: decoded.id });
    console.log("user", user);

    if (!user) {
      console.log("log4");
      res.status(404);
      return res.json({ message: "User not found" });
    }

    console.log("log5");

    res.status(200);
    res.json({ company_existing: user.company_existing });
  } catch (err) {
    console.log("log6");
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.createCompany = async (req, res) => {
  const { token, name, gst_number, phone, address, email, state } = req.body;
  try {
    console.log("token inside createCompany", token);
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const user = await User.findById(userId);
    console.log("userId inside createcompany", userId);
    const existingCompany = await Company.findOne({ name, user: userId });

    console.log("log3");
    if (existingCompany) {
      console.log("log4");
      res.status(409);
      return res.json({ message: "Company already exists!" });
    }
    console.log("log5");
    await Company.updateMany({ user: userId }, { selected_company: "N" });
    console.log("log6");
    user.company_existing = "Y";
    console.log("log7");
    await user.save();
    console.log("log8");
    const newCompany = await Company.create({
      name,
      gst_number,
      phone,
      email,
      state,
      address,
      user: userId,
      selected_company: "Y",
    });
    console.log("log9");

    // await client.del(`companiesof${userId}`);

    res.status(201);
    res.json(newCompany);
  } catch (err) {
    console.log("log10");
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getCompanies = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    // const cachedData = await client.get(`companiesof${userId}`);

    const cachedData = null;

    if (cachedData) {
      res.status(200);
      res.json(JSON.parse(cachedData));
    } else {
      const companies = await Company.find({ user: userId });

      // await client.set(`companiesof${userId}`, JSON.stringify(companies));

      res.status(200);
      res.json(companies);
    }
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getSelectedCompany = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const selectedcompany = await Company.findOne({
      user: userId,
      selected_company: "Y",
    });

    res.status(200);
    res.json(selectedcompany);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.updateSelectedCompany = async (req, res) => {
  const { token, company_name } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    await Company.updateMany({ user: userId }, { selected_company: "N" });

    await Company.updateOne(
      { user: userId, name: company_name },
      { selected_company: "Y" }
    );

    selectedcompany = await Company.findOne({
      user: userId,
      name: company_name,
    });

    res.status(200);
    res.json(selectedcompany);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.updateCompany = async (req, res) => {
  const { id, name, gst_number, phone, state, email, address } = req.body;
  try {
    const updatedCompany = await Company.findOneAndUpdate(
      { _id: id },
      { name, gst_number, phone, state, email, address },
      { new: true }
    );

    if (!updatedCompany) {
      res.status(404);
      return res.json({ message: "Company not found" });
    }

    const userId = updatedCompany.user;

    // await client.del(`companiesof${userId}`);

    res.status(200);
    res.json(updatedCompany);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.removeCompany = async (req, res) => {
  const { id } = req.query;
  try {
    const invoices = await Invoice.find({ company: id });
    if (invoices.length > 0) {
      res.status(200);
      return res.json({
        message: "Please first delete invoices related to company!",
      });
    }
    const items = await Item.find({ company: id });
    if (items.length > 0) {
      res.status(200);
      return res.json({
        message: "Please first delete items related to company!",
      });
    }
    const customers = await Customer.find({ company: id });
    if (customers.length > 0) {
      res.status(200);
      return res.json({
        message: "Please first delete customers related to company!",
      });
    }
    const companyToDelete = await Company.findById(id).populate("user");
    if (!companyToDelete) {
      res.status(404);
      return res.json({ message: "Company not found" });
    }
    if (companyToDelete.selected_company === "Y") {
      const otherCompany = await Company.findOne({
        user: companyToDelete.user._id,
        _id: { $ne: id },
      });
      if (otherCompany) {
        otherCompany.selected_company = "Y";
        await otherCompany.save();
      } else {
        const user = await User.findById(companyToDelete.user._id);

        user.company_existing = "N";

        await user.save();
      }
    }

    await Company.findByIdAndDelete(id);

    const userId = companyToDelete.user._id;

    // await client.del(`companiesof${userId}`);

    res.status(200);
    res.json({ message: "Company removed successfully" });
  } catch (err) {
    res.status(200);
    res.json({ message: err.message });
  }
};

exports.getCompaniesReport = async (req, res) => {
  let { token, companyId, customerId, itemId } = req.query;
  try {
    let companies;
    if (companyId === undefined) {
      companyId = "";
    }
    if (customerId === undefined) {
      customerId = "";
    }
    if (itemId === undefined) {
      itemId = "";
    }
    if (companyId === "" && customerId === "" && itemId === "") {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      const userId = decoded.id;

      companies = await Company.find({ user: userId });
    } else if (companyId === "" && customerId === "" && itemId !== "") {
      const item = await Item.findOne({ _id: itemId });
      companies = await Company.find({ _id: item.company._id });
    } else if (companyId === "" && customerId !== "" && itemId === "") {
      const customer = await Customer.findOne({ _id: customerId });
      companies = await Company.find({ _id: customer.company._id });
    } else if (companyId === "" && customerId !== "" && itemId !== "") {
      const customer = await Customer.findOne({ _id: customerId });
      companies = await Company.find({ _id: customer.company._id });
    } else {
      companies = await Company.find({ _id: companyId });
    }

    companies = companies.map((company) => ({
      ...company._doc,
      __typename: "Company",
    }));

    res.status(200);
    res.json(companies);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getCompaniesExport = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    let companies = await Company.find({ user: userId });

    companies = companies.map((company) => ({
      ...company._doc,
      __typename: "Company",
    }));

    res.status(200);
    res.json(companies);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.importCompany = async (req, res) => {
  const { token, input } = req.body;
  const { name, gst_number, phone, address, email, state, selected_company } =
    input;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const existingCompany = await Company.findOne({ name, user: userId });

    if (existingCompany) {
      res.status(200);
      return res.json({ message: "Company already exists!" });
    }

    const newCompany = await Company.create({
      name,
      gst_number,
      phone,
      email,
      state,
      address,
      user: userId,
      selected_company,
    });

    res.status(201);
    res.json(newCompany);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};
