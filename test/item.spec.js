const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const Item = require("../models/item");
const Invoice = require("../models/invoice");
const Redis = require("ioredis");

const {
  getItems,
  addItem,
  updateItem,
  removeItem,
  getAllItems,
  getItemsReport,
  getItemsExport,
  importItem,
} = require("../controllers/itemController");

jest.mock("ioredis", () => {
  const mRedis = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
  return jest.fn(() => mRedis);
});

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

jest.mock("../models/company", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/item", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock("../models/invoice", () => ({
  find: jest.fn(),
}));

describe("getItems", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return items if company is found", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId };
    const items = [{ item_name: "Colgate" }, { item_name: "Surf Excel" }];

    jwt.verify.mockReturnValueOnce({ id: userId });
    Company.findOne.mockResolvedValueOnce(company);
    client.get.mockResolvedValueOnce(null);
    Item.find.mockResolvedValueOnce(items);
    client.set.mockResolvedValueOnce();

    await getItems(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "someToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(client.get).toHaveBeenCalledWith(`itemsof${userId}${companyId}`);
    expect(Item.find).toHaveBeenCalledWith({ company: company._id });
    expect(client.set).toHaveBeenCalledWith(
      `itemsof${userId}${companyId}`,
      JSON.stringify(items)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(items);
  });

  it("should return items from cache if available", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId };
    const items = [{ item_name: "Colgate" }, { item_name: "Surf Excel" }];

    jwt.verify.mockReturnValueOnce({ id: userId });
    Company.findOne.mockResolvedValueOnce(company);
    client.get.mockResolvedValueOnce(JSON.stringify(items));

    await getItems(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "someToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(client.get).toHaveBeenCalledWith(`itemsof${userId}${companyId}`);
    expect(Item.find).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(items);
  });

  it("should return 404 if company is not found", async () => {
    const userId = "someUserId";
    jwt.verify.mockReturnValueOnce({ id: userId });

    Company.findOne.mockResolvedValueOnce(null);

    await getItems(req, res);

    console.log("res.status calls:", res.status.mock.calls); // Log res.status calls
    console.log("res.json calls:", res.json.mock.calls);

    expect(client.get).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 500 if an error occurs", async () => {
    jwt.verify.mockReturnValueOnce({ id: "someUserId" });
    Company.findOne.mockRejectedValueOnce(new Error("Database error"));

    await getItems(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("addItem function", () => {
  const req = {
    body: {
      token: "someToken",
      item_name: "Item Name",
      item_code: "Item Code",
      item_details: "Item Details",
      hsn_sac: "HSN/SAC",
      qty: 10,
      rate: 100,
    },
  };

  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should add a new item successfully", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId };

    const newItem = {
      item_name: req.body.item_name,
      item_code: req.body.item_code,
      item_details: req.body.item_details,
      hsn_sac: req.body.hsn_sac,
      qty: req.body.qty,
      rate: req.body.rate,
      company: company._id,
    };

    jwt.verify.mockReturnValue({ id: userId });

    Company.findOne.mockResolvedValue(company);

    Item.findOne.mockResolvedValue(null);

    Item.create.mockResolvedValue(newItem);

    client.del.mockResolvedValue();

    await addItem(req, res);

    console.log("res.status calls:", res.status.mock.calls); // Log res.status calls
    console.log("res.json calls:", res.json.mock.calls);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: req.body.item_name,
      company: company._id,
    });

    expect(Item.create).toHaveBeenCalledWith({
      item_name: req.body.item_name,
      item_code: req.body.item_code,
      item_details: req.body.item_details,
      hsn_sac: req.body.hsn_sac,
      qty: req.body.qty,
      rate: req.body.rate,
      company: company._id,
    });

    expect(client.del).toHaveBeenCalledWith(`itemsof${userId}${company._id}`);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newItem);
  });

  it("should return 409 status if item already exists", async () => {
    const userId = "someUserId";
    const company = { _id: "someCompanyId" };
    jwt.verify.mockReturnValue({ id: userId });

    Company.findOne.mockResolvedValue(company);

    const existingItem = { _id: "existingItemId" };
    Item.findOne.mockResolvedValue(existingItem);

    await addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Item already exists!" });
  });

  it("should return 500 status if an error occurs", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("Token verification failed");
    });

    await addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Token verification failed",
    });
  });
});

describe("updateItem", () => {
  const req = {
    body: {
      id: "60c72b2f9b1e8b6f2f5a567b",
      item_name: "Test Item",
      item_code: "1234",
      item_details: "Test Details",
      hsn_sac: "123456",
      qty: 10,
      rate: 100,
    },
  };

  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  beforeEach(() => {
    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update an item and return the updated item", async () => {
    const mockItem = {
      _id: req.body.id,
      item_name: req.body.item_name,
      item_code: req.body.item_code,
      item_details: req.body.item_details,
      hsn_sac: req.body.hsn_sac,
      qty: req.body.qty,
      rate: req.body.rate,
      company: { _id: "companyId" },
    };

    const company = { _id: "companyId", user: { _id: "userId" } };

    Item.findOneAndUpdate.mockResolvedValue(mockItem);

    Company.findOne.mockResolvedValue(company);

    client.del.mockResolvedValue();

    await updateItem(req, res);

    expect(Item.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: req.body.id },
      {
        item_name: req.body.item_name,
        item_code: req.body.item_code,
        item_details: req.body.item_details,
        hsn_sac: req.body.hsn_sac,
        qty: req.body.qty,
        rate: req.body.rate,
      },
      { new: true }
    );

    expect(Company.findOne).toHaveBeenCalledWith({ _id: "companyId" });
    expect(client.del).toHaveBeenCalledWith("itemsofuserIdcompanyId");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockItem);
  });

  it("should return 404 if item is not found", async () => {
    // req.body.id = "60c72b2f9b1e8b6f2f5a567b";
    Item.findOneAndUpdate.mockResolvedValue(null);

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Item not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";
    Item.findOneAndUpdate.mockRejectedValue(new Error(errorMessage));

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("removeItem", () => {
  const req = {
    query: {
      id: "60c72b2f9b1e8b6f2f5a567b",
    },
  };

  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };

  beforeEach(() => {
    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return a message if there are related invoices", async () => {
    Invoice.find.mockResolvedValue([{ _id: "invoiceId1", item: req.query.id }]);

    await removeItem(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ item: req.query.id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please first delete invoices related to item!",
    });
  });

  it("should remove an item if there are no related invoices", async () => {
    const deletedItem = { _id: "itemId", company: { _id: "companyId" } };
    const company = { _id: "companyId", user: { _id: "userId" } };
    Invoice.find.mockResolvedValue([]);
    Item.findByIdAndDelete.mockResolvedValue(deletedItem);
    Company.findOne.mockResolvedValue(company);
    client.del.mockResolvedValue();

    await removeItem(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ item: req.query.id });
    expect(Item.findByIdAndDelete).toHaveBeenCalledWith(req.query.id);
    expect(Company.findOne).toHaveBeenCalledWith({ _id: "companyId" });
    expect(client.del).toHaveBeenCalledWith("itemsofuserIdcompanyId");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Item removed successfully",
    });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";
    Invoice.find.mockRejectedValue(new Error(errorMessage));

    await removeItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getAllItems", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return items for valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1" }, { _id: "companyId2" }];
    const items = [
      [{ _id: "itemId1", company: "companyId1" }],
      [{ _id: "itemId2", company: "companyId2" }],
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Item.find.mockImplementation((query) =>
      query.company === "companyId1"
        ? Promise.resolve(items[0])
        : Promise.resolve(items[1])
    );

    await getAllItems(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Item.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(Item.find).toHaveBeenCalledWith({ company: "companyId2" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(items.flat());
  });

  it("should return 404 if no companies are found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getAllItems(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const userId = "someUserId";
    const errorMessage = "Internal Server Error";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockRejectedValue(new Error(errorMessage));

    await getAllItems(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });

  it("should return 500 if token verification fails", async () => {
    const token = "invalid_token";
    req.query.token = token;
    const errorMessage = "Invalid token";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await getAllItems(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.SECRET_KEY);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getItemsReport", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return items with company names for a valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1", name: "Company1" }];
    const items = [
      [
        {
          _id: "itemId1",
          company: { _id: "companyId1", name: "Company1" },
          _doc: { _id: "itemId1" },
        },
        {
          _id: "itemId2",
          company: { _id: "companyId1", name: "Company1" },
          _doc: { _id: "itemId2" },
        },
      ],
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Item.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(items[0]),
    }));

    await getItemsReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Item.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      items[0].map((item) => ({
        ...item._doc,
        companyName: item.company.name,
        __typename: "ItemsWithCompanyNames",
      }))
    );
  });

  it("should return items for a specific companyId", async () => {
    const companyId = "companyId1";
    const companies = [{ _id: companyId, name: "Company1" }];
    const items = [
      {
        _id: "itemId1",
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: "itemId1" },
      },
      {
        _id: "itemId2",
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: "itemId2" },
      },
    ];

    req.query = { companyId };
    Company.find.mockResolvedValue(companies);
    Item.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(items),
    }));

    await getItemsReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: companyId });
    expect(Item.find).toHaveBeenCalledWith({ company: companyId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      items.map((item) => ({
        ...item._doc,
        companyName: item.company.name,
        __typename: "ItemsWithCompanyNames",
      }))
    );
  });

  it("should return items for a specific itemId within a company", async () => {
    const companyId = "companyId1";
    const itemId = "itemId1";
    const companies = [{ _id: companyId, name: "Company1" }];
    const items = [
      {
        _id: itemId,
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: itemId },
      },
    ];

    req.query = { companyId, itemId };
    Company.find.mockResolvedValue(companies);
    Item.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(items),
    }));

    await getItemsReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: companyId });
    expect(Item.find).toHaveBeenCalledWith({ company: companyId, _id: itemId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      items.map((item) => ({
        ...item._doc,
        companyName: item.company.name,
        __typename: "ItemsWithCompanyNames",
      }))
    );
  });

  it("should return 200 and a message if no companies are found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getItemsReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await getItemsReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getItemsExport", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return items with company names for a valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1", name: "Company1" }];
    const items = [
      {
        _id: "itemId1",
        company: { _id: "companyId1", name: "Company1" },
        _doc: { _id: "itemId1" },
      },
      {
        _id: "itemId2",
        company: { _id: "companyId1", name: "Company1" },
        _doc: { _id: "itemId2" },
      },
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Item.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(items),
    }));

    await getItemsExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Item.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      items.map((item) => ({
        ...item._doc,
        companyName: item.company.name,
        __typename: "ItemsWithCompanyNames",
      }))
    );
  });

  it("should return 404 if no companies are found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getItemsExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await getItemsExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("importItem", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "valid_token",
        input: {
          item_name: "Item1",
          item_code: "Code1",
          item_details: "Details1",
          hsn_sac: "HSN123",
          qty: 10,
          rate: 100,
          companyName: "Company1",
        },
      },
    };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new item if the company exists and the item does not already exist", async () => {
    const userId = "someUserId";
    const company = { _id: "companyId1", name: "Company1" };
    const newItem = {
      _id: "itemId1",
      item_name: "Item1",
      item_code: "Code1",
      item_details: "Details1",
      hsn_sac: "HSN123",
      qty: 10,
      rate: 100,
      company: "companyId1",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Item.findOne.mockResolvedValue(null);
    Item.create.mockResolvedValue(newItem);

    await importItem(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Company1",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "Item1",
      company: "companyId1",
    });
    expect(Item.create).toHaveBeenCalledWith({
      item_name: "Item1",
      item_code: "Code1",
      item_details: "Details1",
      hsn_sac: "HSN123",
      qty: 10,
      rate: 100,
      company: "companyId1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newItem);
  });

  it("should return 404 if the company is not found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(null);

    await importItem(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Company1",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 200 if the item already exists", async () => {
    const userId = "someUserId";
    const company = { _id: "companyId1", name: "Company1" };
    const existingItem = {
      _id: "itemId1",
      item_name: "Item1",
      company: "companyId1",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Item.findOne.mockResolvedValue(existingItem);

    await importItem(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Company1",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "Item1",
      company: "companyId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Item already exists!" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await importItem(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});
