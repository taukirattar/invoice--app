const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const Item = require("../models/item");
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

exports.getItems = async (req, res) => {
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

    // const cachedData = await client.get(`itemsof${userId}${company._id}`);

    const cachedData = null;

    if (cachedData) {
      res.status(200);
      res.json(JSON.parse(cachedData));
    } else {
      const items = await Item.find({ company: company._id });

      // await client.set(`itemsof${userId}${company._id}`, JSON.stringify(items));

      res.status(200);
      res.json(items);
    }
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getAllItems = async (req, res) => {
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

    const itemPromises = companies.map((company) =>
      Item.find({ company: company._id })
    );

    const items = await Promise.all(itemPromises);

    const flattenedItems = items.flat();

    res.status(200);
    res.json(flattenedItems);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.addItem = async (req, res) => {
  const { token, item_name, item_code, item_details, hsn_sac, qty, rate } =
    req.body;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const company = await Company.findOne({
      user: userId,
      selected_company: "Y",
    });

    const existingItem = await Item.findOne({
      item_name,
      company: company._id,
    });

    if (existingItem) {
      res.status(409);
      return res.json({ message: "Item already exists!" });
    }

    const newItem = await Item.create({
      item_name,
      item_code,
      item_details,
      hsn_sac,
      qty,
      rate,
      company: company._id,
    });

    // await client.del(`itemsof${userId}${company._id}`);

    res.status(201);
    res.json(newItem);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  const { id, item_name, item_code, item_details, hsn_sac, qty, rate } =
    req.body;
  try {
    const updatedItem = await Item.findOneAndUpdate(
      { _id: id },
      { item_name, item_code, item_details, hsn_sac, qty, rate },
      { new: true }
    );

    if (!updatedItem) {
      res.status(404);
      return res.json({ message: "Item not found" });
    }

    const companyId = updatedItem.company._id;

    const company = await Company.findOne({ _id: companyId });

    const userId = company.user._id;

    // await client.del(`itemsof${userId}${companyId}`);

    res.status(200);
    res.json(updatedItem);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.removeItem = async (req, res) => {
  const { id } = req.query;
  try {
    const invoices = await Invoice.find({ item: id });
    if (invoices.length > 0) {
      res.status(200);
      return res.json({
        message: "Please first delete invoices related to item!",
      });
    }
    const deletedItem = await Item.findByIdAndDelete(id);

    const companyId = deletedItem.company._id;

    const company = await Company.findOne({ _id: companyId });

    const userId = company.user._id;

    // await client.del(`itemsof${userId}${companyId}`);

    res.status(200);
    res.json({ message: "Item removed successfully" });
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getItemsReport = async (req, res) => {
  let { token, companyId, itemId } = req.query;
  try {
    let companies;
    if (companyId === undefined) {
      companyId = "";
    }
    if (itemId === undefined) {
      itemId = "";
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

    let itemPromises;

    if (itemId === "") {
      itemPromises = companies.map((company) =>
        Item.find({ company: company._id }).populate("company", "name")
      );
    } else {
      itemPromises = companies.map((company) =>
        Item.find({ company: company._id, _id: itemId }).populate(
          "company",
          "name"
        )
      );
    }

    const items = await Promise.all(itemPromises);

    const flattenedItems = items.flat();

    const itemsWithCompanyName = flattenedItems.map((item) => ({
      ...item._doc,
      companyName: item.company.name,
      __typename: "ItemsWithCompanyNames",
    }));

    res.status(200);
    res.json(itemsWithCompanyName);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getItemsExport = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    companies = await Company.find({ user: userId });

    if (!companies || companies.length === 0) {
      res.status(404);
      return res.json({ message: "Companies not found" });
    }

    let itemPromises;

    itemPromises = companies.map((company) =>
      Item.find({ company: company._id }).populate("company", "name")
    );

    const items = await Promise.all(itemPromises);

    const flattenedItems = items.flat();

    const itemsWithCompanyName = flattenedItems.map((item) => ({
      ...item._doc,
      companyName: item.company.name,
      __typename: "ItemsWithCompanyNames",
    }));

    res.status(200);
    res.json(itemsWithCompanyName);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.importItem = async (req, res) => {
  const { token, input } = req.body;
  const {
    item_name,
    item_code,
    item_details,
    hsn_sac,
    qty,
    rate,
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

    const existingItem = await Item.findOne({
      item_name,
      company: company._id,
    });

    if (existingItem) {
      res.status(200);
      return res.json({ message: "Item already exists!" });
    }

    const newItem = await Item.create({
      item_name,
      item_code,
      item_details,
      hsn_sac,
      qty,
      rate,
      company: company._id,
    });

    res.status(201);
    res.json(newItem);
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};
