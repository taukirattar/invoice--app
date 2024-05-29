const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Company = require("../models/company");
const Item = require("../models/item");
const Customer = require("../models/customer");
const Invoice = require("../models/invoice");
// const client = require("../redis/redisClient");
const Redis = require("ioredis");

const {
  getCompanyExistingFlag,
  createCompany,
  getCompanies,
  getSelectedCompany,
  updateSelectedCompany,
  updateCompany,
  removeCompany,
  getCompaniesReport,
  getCompaniesExport,
  importCompany,
} = require("../controllers/companyController");

// jest.mock("../redis/redisClient", () => ({
//   del: jest.fn(),
// }));

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

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../models/company", () => ({
  findOne: jest.fn(),
  updateMany: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock("../models/invoice", () => ({
  find: jest.fn(),
}));

jest.mock("../models/item", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/customer", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

describe("getCompanyExistingFlag", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and the company_existing flag when user is found", async () => {
    const userId = "user-id";
    const user = { company_existing: "Y" };

    jwt.verify.mockReturnValue({ id: userId });
    User.findOne.mockResolvedValue(user);

    await getCompanyExistingFlag(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(User.findOne).toHaveBeenCalledWith({ _id: userId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      company_existing: user.company_existing,
    });
  });

  it("should return 404 when user is not found", async () => {
    const userId = "user-id";

    jwt.verify.mockReturnValue({ id: userId });
    User.findOne.mockResolvedValue(null);

    await getCompanyExistingFlag(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(User.findOne).toHaveBeenCalledWith({ _id: userId });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  it("should return 500 when there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getCompanyExistingFlag(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("createCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "test-token",
        name: "Test Company",
        gst_number: "GST12345",
        phone: "1234567890",
        address: "123 Test St",
        email: "test@example.com",
        state: "Test State",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new company and return 201 status", async () => {
    const decoded = { id: "user-id" };
    const user = { _id: "user-id", company_existing: "N", save: jest.fn() };
    const newCompany = { _id: "company-id", name: "Test Company" };

    jwt.verify.mockReturnValue(decoded);
    User.findById.mockResolvedValue(user);
    Company.findOne.mockResolvedValue(null);
    Company.updateMany.mockResolvedValue();
    Company.create.mockResolvedValue(newCompany);
    client.del.mockResolvedValue();

    await createCompany(req, res);

    console.log("res.status calls:", res.status.mock.calls); // Log res.status calls
    console.log("res.json calls:", res.json.mock.calls);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(User.findById).toHaveBeenCalledWith("user-id");
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "Test Company",
      user: "user-id",
    });
    expect(Company.updateMany).toHaveBeenCalledWith(
      { user: "user-id" },
      { selected_company: "N" }
    );
    expect(user.company_existing).toBe("Y");
    expect(user.save).toHaveBeenCalled();
    expect(Company.create).toHaveBeenCalledWith({
      name: "Test Company",
      gst_number: "GST12345",
      phone: "1234567890",
      address: "123 Test St",
      email: "test@example.com",
      state: "Test State",
      user: "user-id",
      selected_company: "Y",
    });
    expect(client.del).toHaveBeenCalledWith("companiesofuser-id");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newCompany);
  });

  it("should return 409 if the company already exists", async () => {
    const decoded = { id: "user-id" };
    const user = { _id: "user-id", company_existing: "N", save: jest.fn() };
    const existingCompany = { _id: "existing-company-id" };

    jwt.verify.mockReturnValue(decoded);
    User.findById.mockResolvedValue(user);
    Company.findOne.mockResolvedValue(existingCompany);

    await createCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(User.findById).toHaveBeenCalledWith("user-id");
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "Test Company",
      user: "user-id",
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Company already exists!",
    });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await createCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getCompanies", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and a list of companies from cache", async () => {
    const decoded = { id: "user-id" };
    const companies = [{ name: "Company 1" }, { name: "Company 2" }];
    const cachedCompanies = JSON.stringify(companies);

    jwt.verify.mockReturnValue(decoded);
    client.get.mockResolvedValue(cachedCompanies); // Mock the Redis get method

    await getCompanies(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(client.get).toHaveBeenCalledWith("companiesofuser-id"); // Adjust the expectation
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(companies);
  });

  it("should return 200 and a list of companies from database", async () => {
    const decoded = { id: "user-id" };
    const companies = [{ name: "Company 1" }, { name: "Company 2" }];

    jwt.verify.mockReturnValue(decoded);
    client.get.mockResolvedValue(null);
    Company.find.mockResolvedValue(companies);

    await getCompanies(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(client.get).toHaveBeenCalledWith("companiesofuser-id");
    expect(Company.find).toHaveBeenCalledWith({ user: "user-id" });
    expect(client.set).toHaveBeenCalledWith(
      "companiesofuser-id",
      JSON.stringify(companies)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(companies);
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getCompanies(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getSelectedCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and the selected company", async () => {
    const decoded = { id: "user-id" };
    const selectedCompany = { name: "Selected Company", selected_company: "Y" };

    jwt.verify.mockReturnValue(decoded);
    Company.findOne.mockResolvedValue(selectedCompany);

    await getSelectedCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(selectedCompany);
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getSelectedCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("updateSelectedCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "test-token",
        company_name: "Test Company",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update the selected company and return 200 status", async () => {
    const decoded = { id: "user-id" };
    const selectedCompany = { name: "Test Company", selected_company: "Y" };

    jwt.verify.mockReturnValue(decoded);
    Company.updateMany.mockResolvedValue();
    Company.updateOne.mockResolvedValue();
    Company.findOne.mockResolvedValue(selectedCompany);

    await updateSelectedCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.updateMany).toHaveBeenCalledWith(
      { user: "user-id" },
      { selected_company: "N" }
    );
    expect(Company.updateOne).toHaveBeenCalledWith(
      { user: "user-id", name: "Test Company" },
      { selected_company: "Y" }
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      name: "Test Company",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(selectedCompany);
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await updateSelectedCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("updateCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        id: "company-id",
        name: "Updated Company",
        gst_number: "GST12345",
        phone: "1234567890",
        state: "Updated State",
        email: "updated@example.com",
        address: "123 Updated St",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update the company and return 200 status", async () => {
    const updatedCompany = {
      _id: "company-id",
      name: "Updated Company",
      gst_number: "GST12345",
      phone: "1234567890",
      state: "Updated State",
      email: "updated@example.com",
      address: "123 Updated St",
      user: "user-id", // Mocking user property
    };

    Company.findOneAndUpdate.mockResolvedValue(updatedCompany);

    client.del.mockResolvedValue();

    await updateCompany(req, res);

    expect(Company.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "company-id" },
      {
        name: "Updated Company",
        gst_number: "GST12345",
        phone: "1234567890",
        state: "Updated State",
        email: "updated@example.com",
        address: "123 Updated St",
      },
      { new: true }
    );
    expect(client.del).toHaveBeenCalledWith("companiesofuser-id");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedCompany);
  });

  it("should return 404 if the company is not found", async () => {
    Company.findOneAndUpdate.mockResolvedValue(null);

    await updateCompany(req, res);

    expect(Company.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "company-id" },
      {
        name: "Updated Company",
        gst_number: "GST12345",
        phone: "1234567890",
        state: "Updated State",
        email: "updated@example.com",
        address: "123 Updated St",
      },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    Company.findOneAndUpdate.mockImplementation(() => {
      throw error;
    });

    await updateCompany(req, res);

    expect(Company.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "company-id" },
      {
        name: "Updated Company",
        gst_number: "GST12345",
        phone: "1234567890",
        state: "Updated State",
        email: "updated@example.com",
        address: "123 Updated St",
      },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("removeCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        id: "company-id",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
    client = new Redis();
  });

  it("should return 200 with a message if there are related invoices", async () => {
    Invoice.find.mockResolvedValue([{ id: "invoice-id" }]);

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please first delete invoices related to company!",
    });
  });

  it("should return 200 with a message if there are related items", async () => {
    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([{ id: "item-id" }]);

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please first delete items related to company!",
    });
  });

  it("should return 200 with a message if there are related customers", async () => {
    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([]);
    Customer.find.mockResolvedValue([{ id: "customer-id" }]);

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please first delete customers related to company!",
    });
  });

  it("should return 404 if the company is not found", async () => {
    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([]);
    Customer.find.mockResolvedValue([]);
    Company.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Company.findById).toHaveBeenCalledWith("company-id");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it('should remove the company if companyToDelete.selected_company === "N"', async () => {
    const companyToDelete = {
      _id: "company-id",
      selected_company: "N",
      user: { _id: "user-id" },
    };

    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([]);
    Customer.find.mockResolvedValue([]);
    Company.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(companyToDelete),
    });
    Company.findByIdAndDelete.mockResolvedValue();
    client.del.mockResolvedValue();

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Company.findById).toHaveBeenCalledWith("company-id");
    expect(Company.findByIdAndDelete).toHaveBeenCalledWith("company-id");
    expect(client.del).toHaveBeenCalledWith("companiesofuser-id");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Company removed successfully",
    });
  });

  it('should set another company as selected if companyToDelete.selected_company === "Y" and otherCompany exists', async () => {
    const companyToDelete = {
      _id: "company-id",
      selected_company: "Y",
      user: { _id: "user-id" },
    };
    const otherCompany = {
      _id: "other-company-id",
      selected_company: "N",
      save: jest.fn().mockResolvedValue(),
    };

    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([]);
    Customer.find.mockResolvedValue([]);
    Company.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(companyToDelete),
    });
    Company.findOne.mockResolvedValue(otherCompany);
    Company.findByIdAndDelete.mockResolvedValue();
    client.del.mockResolvedValue();

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Company.findById).toHaveBeenCalledWith("company-id");
    expect(Company.findOne).toHaveBeenCalledWith({
      user: companyToDelete.user._id,
      _id: { $ne: "company-id" },
    });
    expect(otherCompany.selected_company).toBe("Y");
    expect(otherCompany.save).toHaveBeenCalled();
    expect(Company.findByIdAndDelete).toHaveBeenCalledWith("company-id");
    expect(client.del).toHaveBeenCalledWith("companiesofuser-id");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Company removed successfully",
    });
  });

  it('should update user company_existing flag N if companyToDelete.selected_company === "Y" and no other company found', async () => {
    const companyToDelete = {
      _id: "company-id",
      selected_company: "Y",
      user: { _id: "user-id" },
    };
    const user = {
      _id: "user-id",
      company_existing: "Y",
      save: jest.fn().mockResolvedValue(),
    };

    Invoice.find.mockResolvedValue([]);
    Item.find.mockResolvedValue([]);
    Customer.find.mockResolvedValue([]);
    Company.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(companyToDelete),
    });
    Company.findOne.mockResolvedValue(null);
    User.findById.mockResolvedValue(user);
    Company.findByIdAndDelete.mockResolvedValue();
    client.del.mockResolvedValue();

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Item.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Company.findById).toHaveBeenCalledWith("company-id");
    expect(Company.findOne).toHaveBeenCalledWith({
      user: companyToDelete.user._id,
      _id: { $ne: "company-id" },
    });
    expect(user.company_existing).toBe("N");
    expect(user.save).toHaveBeenCalled();
    expect(Company.findByIdAndDelete).toHaveBeenCalledWith("company-id");
    expect(client.del).toHaveBeenCalledWith("companiesofuser-id");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Company removed successfully",
    });
  });

  it("should return 200 if there is an error", async () => {
    const error = new Error("Test error");

    Invoice.find.mockImplementation(() => {
      throw error;
    });

    await removeCompany(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getCompaniesReport", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
        companyId: "",
        customerId: "",
        itemId: "",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return companies for the authenticated user if no companyId, customerId, and itemId is provided", async () => {
    const decodedToken = { id: "user-id" };
    const companies = [{ _id: "company-id", name: "Test Company" }];

    jwt.verify.mockReturnValue(decodedToken);
    Company.find.mockResolvedValue(companies);

    await getCompaniesReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "user-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return companies based on itemId", async () => {
    req.query.itemId = "item-id";
    const item = { _id: "item-id", company: { _id: "company-id" } };
    const companies = [
      { _id: "company-id", name: "Test Company", _doc: { _id: "company-id" } },
    ];

    Item.findOne.mockResolvedValue(item);
    Company.find.mockResolvedValue(companies);

    await getCompaniesReport(req, res);

    expect(Item.findOne).toHaveBeenCalledWith({ _id: "item-id" });
    expect(Company.find).toHaveBeenCalledWith({ _id: item.company._id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return companies based on customerId", async () => {
    req.query.customerId = "customer-id";
    const customer = { _id: "customer-id", company: { _id: "company-id" } };
    const companies = [
      { _id: "company-id", name: "Test Company", _doc: { _id: "company-id" } },
    ];

    Customer.findOne.mockResolvedValue(customer);
    Company.find.mockResolvedValue(companies);

    await getCompaniesReport(req, res);

    expect(Customer.findOne).toHaveBeenCalledWith({ _id: "customer-id" });
    expect(Company.find).toHaveBeenCalledWith({ _id: customer.company._id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return companies based on customerId when both itemId and customerId are provided", async () => {
    req.query.customerId = "customer-id";
    req.query.itemId = "item-id";
    const customer = { _id: "customer-id", company: { _id: "company-id" } };
    const companies = [
      { _id: "company-id", name: "Test Company", _doc: { _id: "company-id" } },
    ];

    Customer.findOne.mockResolvedValue(customer);
    Company.find.mockResolvedValue(companies);

    await getCompaniesReport(req, res);

    expect(Customer.findOne).toHaveBeenCalledWith({ _id: "customer-id" });
    expect(Company.find).toHaveBeenCalledWith({ _id: customer.company._id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return companies based on companyId", async () => {
    req.query.companyId = "company-id";
    const companies = [
      { _id: "company-id", name: "Test Company", _doc: { _id: "company-id" } },
    ];

    Company.find.mockResolvedValue(companies);

    await getCompaniesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "company-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    Company.find.mockImplementation(() => {
      throw error;
    });

    await getCompaniesReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getCompaniesExport", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return companies for the authenticated user", async () => {
    const decodedToken = { id: "user-id" };
    const companies = [
      {
        _id: "company-id",
        name: "Test Company",
        _doc: { _id: "company-id", name: "Test Company" },
      },
    ];

    jwt.verify.mockReturnValue(decodedToken);
    Company.find.mockResolvedValue(companies);

    await getCompaniesExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "user-id" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      companies.map((company) => ({
        ...company._doc,
        __typename: "Company",
      }))
    );
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getCompaniesExport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });

  it("should return 500 if Company.find throws an error", async () => {
    const decodedToken = { id: "user-id" };
    const error = new Error("Test error");

    jwt.verify.mockReturnValue(decodedToken);
    Company.find.mockImplementation(() => {
      throw error;
    });

    await getCompaniesExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "user-id" });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("importCompany", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "test-token",
        input: {
          name: "Test Company",
          gst_number: "GST12345",
          phone: "1234567890",
          address: "Test Address",
          email: "test@example.com",
          state: "Test State",
          selected_company: "Y",
        },
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new company if it does not already exist", async () => {
    const decodedToken = { id: "user-id" };
    const newCompany = {
      _id: "company-id",
      ...req.body.input,
      user: "user-id",
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(null);
    Company.create.mockResolvedValue(newCompany);

    await importCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "Test Company",
      user: "user-id",
    });
    expect(Company.create).toHaveBeenCalledWith({
      ...req.body.input,
      user: "user-id",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newCompany);
  });

  it("should return a 200 status if the company already exists", async () => {
    const decodedToken = { id: "user-id" };
    const existingCompany = {
      _id: "existing-company-id",
      ...req.body.input,
      user: "user-id",
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(existingCompany);

    await importCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "Test Company",
      user: "user-id",
    });
    expect(Company.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Company already exists!",
    });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await importCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});
