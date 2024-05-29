const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const Customer = require("../models/customer");
const Invoice = require("../models/invoice");
const Redis = require("ioredis");

const {
  getCustomers,
  addCustomer,
  updateCustomer,
  removeCustomer,
  getAllCustomers,
  getCustomersReport,
  getCustomersExport,
  importCustomer,
} = require("../controllers/customerController");

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

jest.mock("../models/customer", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

jest.mock("../models/invoice", () => ({
  find: jest.fn(),
}));

describe("getCustomers", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
    client = new Redis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return customers for a valid token and existing company", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId, name: "Company1" };
    const customers = [
      { _id: "customerId1", name: "Customer1", company: companyId },
      { _id: "customerId2", name: "Customer2", company: companyId },
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    client.get.mockResolvedValueOnce(null);
    Customer.find.mockResolvedValue(customers);
    client.set.mockResolvedValueOnce();

    await getCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(client.get).toHaveBeenCalledWith(`customersof${userId}${companyId}`);
    expect(Customer.find).toHaveBeenCalledWith({ company: company._id });
    expect(client.set).toHaveBeenCalledWith(
      `customersof${userId}${companyId}`,
      JSON.stringify(customers)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(customers);
  });

  it("should return customers from cache if available", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId };
    const customers = [
      { _id: "customerId1", name: "Customer1", company: companyId },
      { _id: "customerId2", name: "Customer2", company: companyId },
    ];

    jwt.verify.mockReturnValueOnce({ id: userId });
    Company.findOne.mockResolvedValueOnce(company);
    client.get.mockResolvedValueOnce(JSON.stringify(customers));

    await getCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "someToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(client.get).toHaveBeenCalledWith(`customersof${userId}${companyId}`);
    expect(Customer.find).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(customers);
  });

  it("should return 404 if the company is not found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(null);

    await getCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(client.get).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await getCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("addCustomer", () => {
  const req = {
    body: {
      token: "valid_token",
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      customer_company: "Company1",
      gstin: "GSTIN123",
      state: "State1",
      address: "Address1",
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

  it("should create a new customer if it does not already exist", async () => {
    const userId = "someUserId";
    const companyId = "someCompanyId";
    const company = { _id: companyId };
    const newCustomer = {
      _id: "customerId1",
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      customer_company: "Company1",
      gstin: "GSTIN123",
      state: "State1",
      address: "Address1",
      company: "someCompanyId",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Customer.findOne.mockResolvedValue(null);
    Customer.create.mockResolvedValue(newCustomer);
    client.del.mockResolvedValue();

    await addCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      email: "john@example.com",
      company: "someCompanyId",
    });
    expect(Customer.create).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
      customer_company: "Company1",
      gstin: "GSTIN123",
      state: "State1",
      address: "Address1",
      company: "someCompanyId",
    });
    expect(client.del).toHaveBeenCalledWith(
      `customersof${userId}${company._id}`
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newCustomer);
  });

  it("should return 409 if the customer already exists", async () => {
    const userId = "someUserId";
    const company = { _id: "companyId1", name: "Company1" };
    const existingCustomer = {
      _id: "customerId1",
      email: "john@example.com",
      company: "companyId1",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Customer.findOne.mockResolvedValue(existingCustomer);

    await addCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      selected_company: "Y",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      email: "john@example.com",
      company: "companyId1",
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Customer already exists!",
    });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await addCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.body.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("updateCustomer", () => {
  const req = {
    body: {
      id: "customerId1",
      name: "Updated Name",
      email: "updated@example.com",
      phone: "9876543210",
      customer_company: "Updated Company",
      gstin: "GSTIN456",
      state: "Updated State",
      address: "Updated Address",
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

  it("should update a customer if it exists", async () => {
    const updatedCustomer = {
      _id: "customerId1",
      name: "Updated Name",
      email: "updated@example.com",
      phone: "9876543210",
      customer_company: "Updated Company",
      gstin: "GSTIN456",
      state: "Updated State",
      address: "Updated Address",
      company: { _id: "companyId" },
    };

    const company = { _id: "companyId", user: { _id: "userId" } };

    Customer.findOneAndUpdate.mockResolvedValue(updatedCustomer);

    Company.findOne.mockResolvedValue(company);

    client.del.mockResolvedValue();

    await updateCustomer(req, res);

    expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "customerId1" },
      {
        name: "Updated Name",
        email: "updated@example.com",
        phone: "9876543210",
        customer_company: "Updated Company",
        gstin: "GSTIN456",
        state: "Updated State",
        address: "Updated Address",
      },
      { new: true }
    );
    expect(Company.findOne).toHaveBeenCalledWith({ _id: "companyId" });
    expect(client.del).toHaveBeenCalledWith("customersofuserIdcompanyId");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedCustomer);
  });

  it("should return 404 if the customer does not exist", async () => {
    Customer.findOneAndUpdate.mockResolvedValue(null);

    await updateCustomer(req, res);

    expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "customerId1" },
      {
        name: "Updated Name",
        email: "updated@example.com",
        phone: "9876543210",
        customer_company: "Updated Company",
        gstin: "GSTIN456",
        state: "Updated State",
        address: "Updated Address",
      },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Customer not found" });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    Customer.findOneAndUpdate.mockRejectedValue(new Error(errorMessage));

    await updateCustomer(req, res);

    expect(Customer.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "customerId1" },
      {
        name: "Updated Name",
        email: "updated@example.com",
        phone: "9876543210",
        customer_company: "Updated Company",
        gstin: "GSTIN456",
        state: "Updated State",
        address: "Updated Address",
      },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("removeCustomer", () => {
  const req = {
    query: {
      id: "customerId1",
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

  it("should remove a customer if there are no related invoices", async () => {
    const deletedCustomer = {
      _id: "customerId",
      company: { _id: "companyId" },
    };
    const company = { _id: "companyId", user: { _id: "userId" } };
    Invoice.find.mockResolvedValue([]);
    Customer.findByIdAndDelete.mockResolvedValue(deletedCustomer);
    Company.findOne.mockResolvedValue(company);
    client.del.mockResolvedValue();

    await removeCustomer(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ customer: "customerId1" });
    expect(Customer.findByIdAndDelete).toHaveBeenCalledWith("customerId1");
    expect(Company.findOne).toHaveBeenCalledWith({ _id: "companyId" });
    expect(client.del).toHaveBeenCalledWith("customersofuserIdcompanyId");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Customer removed successfully",
    });
  });

  it("should return 200 with a message if there are related invoices", async () => {
    const invoices = [{ _id: "invoiceId1", customer: "customerId1" }];
    Invoice.find.mockResolvedValue(invoices);

    await removeCustomer(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ customer: "customerId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please first delete invoices related to customer!",
    });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";
    Invoice.find.mockRejectedValue(new Error(errorMessage));

    await removeCustomer(req, res);

    expect(Invoice.find).toHaveBeenCalledWith({ customer: "customerId1" });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getAllCustomers", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return customers for a valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1" }, { _id: "companyId2" }];
    const customers = [
      { _id: "customerId1", name: "Customer1", company: "companyId1" },
      { _id: "customerId2", name: "Customer2", company: "companyId2" },
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Customer.find.mockImplementation((query) =>
      query.company === "companyId1"
        ? Promise.resolve(customers[0])
        : Promise.resolve(customers[1])
    );

    await getAllCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Customer.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(Customer.find).toHaveBeenCalledWith({ company: "companyId2" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(customers.flat());
  });

  it("should return 404 if companies are not found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getAllCustomers(req, res);

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

    await getAllCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
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

    await getAllCustomers(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.SECRET_KEY);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getCustomersReport", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return customers with company names for a valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1", name: "Company1" }];
    const customers = [
      [
        {
          _id: "customerId1",
          company: { _id: "companyId1", name: "Company1" },
          _doc: { _id: "customerId1" },
        },
        {
          _id: "customerId2",
          company: { _id: "companyId1", name: "Company1" },
          _doc: { _id: "customerId2" },
        },
      ],
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Customer.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(customers[0]),
    }));

    await getCustomersReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Customer.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      customers[0].map((customer) => ({
        ...customer._doc,
        companyName: customer.company.name,
        __typename: "CustomersWithCompanyNames",
      }))
    );
  });

  it("should return customers for a specific companyId", async () => {
    const companyId = "companyId1";
    const companies = [{ _id: companyId, name: "Company1" }];
    const customers = [
      {
        _id: "customerId1",
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: "customerId1" },
      },
      {
        _id: "customerId2",
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: "customerId2" },
      },
    ];

    req.query = { companyId };
    Company.find.mockResolvedValue(companies);
    Customer.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(customers),
    }));

    await getCustomersReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: companyId });
    expect(Customer.find).toHaveBeenCalledWith({ company: companyId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      customers.map((customer) => ({
        ...customer._doc,
        companyName: customer.company.name,
        __typename: "CustomersWithCompanyNames",
      }))
    );
  });

  it("should return customers for a specific customerId within a company", async () => {
    const companyId = "companyId1";
    const customerId = "customerId1";
    const companies = [{ _id: companyId, name: "Company1" }];
    const customers = [
      {
        _id: customerId,
        company: { _id: companyId, name: "Company1" },
        _doc: { _id: customerId },
      },
    ];

    req.query = { companyId, customerId };
    Company.find.mockResolvedValue(companies);
    Customer.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(customers),
    }));

    await getCustomersReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: companyId });
    expect(Customer.find).toHaveBeenCalledWith({
      company: companyId,
      _id: customerId,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      customers.map((customer) => ({
        ...customer._doc,
        companyName: customer.company.name,
        __typename: "CustomersWithCompanyNames",
      }))
    );
  });

  it("should return 200 and a message if no companies are found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getCustomersReport(req, res);

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

    await getCustomersReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getCustomersExport", () => {
  let req, res;

  beforeEach(() => {
    req = { query: { token: "someToken" } };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return customers with company names for a valid token and existing companies", async () => {
    const userId = "someUserId";
    const companies = [{ _id: "companyId1", name: "Company1" }];
    const customers = [
      {
        _id: "customerId1",
        name: "Customer1",
        company: { _id: "companyId1", name: "Company1" },
        _doc: { _id: "customerId1" },
      },
      {
        _id: "customerId2",
        name: "Customer2",
        company: { _id: "companyId1", name: "Company1" },
        _doc: { _id: "customerId2" },
      },
    ];

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue(companies);
    Customer.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(customers),
    }));

    await getCustomersExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: userId });
    expect(Customer.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      customers.map((customer) => ({
        ...customer._doc,
        companyName: customer.company.name,
        __typename: "CustomersWithCompanyNames",
      }))
    );
  });

  it("should return 200 with a message if companies are not found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.find.mockResolvedValue([]);

    await getCustomersExport(req, res);

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

    await getCustomersExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      req.query.token,
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("importCustomer", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "valid_token",
        input: {
          name: "Test Customer",
          email: "test@example.com",
          phone: "1234567890",
          customer_company: "Test Company",
          gstin: "ABC123",
          state: "Test State",
          address: "Test Address",
          companyName: "Test Company",
        },
      },
    };
    res = { status: jest.fn(), json: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should import a new customer if company is found and customer does not exist", async () => {
    const userId = "someUserId";
    const company = { _id: "companyId1", name: "Test Company" };
    const newCustomer = {
      _id: "customerId1",
      name: "Test Customer",
      email: "test@example.com",
      phone: "1234567890",
      customer_company: "Test Company",
      gstin: "ABC123",
      state: "Test State",
      address: "Test Address",
      company: "companyId1",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Customer.findOne.mockResolvedValue(null);
    Customer.create.mockResolvedValue(newCustomer);

    await importCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid_token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Test Company",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      email: "test@example.com",
      company: "companyId1",
    });
    expect(Customer.create).toHaveBeenCalledWith({
      name: "Test Customer",
      email: "test@example.com",
      phone: "1234567890",
      customer_company: "Test Company",
      gstin: "ABC123",
      state: "Test State",
      address: "Test Address",
      company: "companyId1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newCustomer);
  });

  it("should return 404 if company is not found", async () => {
    const userId = "someUserId";

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(null);

    await importCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid_token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Test Company",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 200 with a message if customer already exists", async () => {
    const userId = "someUserId";
    const company = { _id: "companyId1", name: "Test Company" };
    const existingCustomer = {
      _id: "existingCustomerId",
      name: "Test Customer",
    };

    jwt.verify.mockReturnValue({ id: userId });
    Company.findOne.mockResolvedValue(company);
    Customer.findOne.mockResolvedValue(existingCustomer);

    await importCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid_token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: userId,
      name: "Test Company",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      email: "test@example.com",
      company: "companyId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Customer already exists!",
    });
  });

  it("should return 500 if there is a server error", async () => {
    const errorMessage = "Internal Server Error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await importCustomer(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "valid_token",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});
