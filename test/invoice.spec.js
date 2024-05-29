const jwt = require("jsonwebtoken");
const Company = require("../models/company");
const Customer = require("../models/customer");
const Invoice = require("../models/invoice");
const Item = require("../models/item");

const {
  createInvoice,
  getInvoiceByCompany,
  removeInvoice,
  getInvoice,
  getInvoicesReport,
  getInvoicesExport,
  importInvoice,
} = require("../controllers/invoiceController");

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

jest.mock("../models/company", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/invoice", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock("../models/customer", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/item", () => ({
  findOne: jest.fn(),
}));

describe("createInvoice", () => {
  let req, res;
  const fixedDate = new Date("2024-05-20T17:01:20.531Z");

  beforeEach(() => {
    req = {
      body: {
        token: "test-token",
        inputs: [
          {
            amount: 100,
            customer_id: "customer-id",
            discount: 10,
            due_date: "2023-06-01",
            gst: 5,
            invoice_number: "INV-123",
            item_id: "item-id",
            qty: 2,
            total_amount: 190,
          },
        ],
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    jest.useFakeTimers("modern");
    jest.setSystemTime(fixedDate);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create new invoices if they do not already exist", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };
    const newInvoice = {
      _id: "invoice-id",
      ...req.body.inputs[0],
      company: company._id,
      invoice_date: fixedDate,
      due_date: new Date(req.body.inputs[0].due_date).toISOString(),
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.findOne.mockResolvedValue(null);
    Invoice.create.mockResolvedValue(newInvoice);

    await createInvoice(req, res);

    console.log("res.status calls:", res.status.mock.calls); // Log res.status calls
    console.log("res.json calls:", res.json.mock.calls);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.findOne).toHaveBeenCalledWith({
      invoice_number: "INV-123",
      company: company._id,
    });
    expect(Invoice.create).toHaveBeenCalledWith({
      amount: 100,
      customer: "customer-id",
      discount: 10,
      gst: 5,
      invoice_number: "INV-123",
      item: "item-id",
      qty: 2,
      total_amount: 190,
      company: company._id,
      invoice_date: fixedDate,
      due_date: new Date(req.body.inputs[0].due_date).toISOString(),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([newInvoice]);
  });

  it("should return 404 if the company is not found", async () => {
    const decodedToken = { id: "user-id" };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(null);

    await createInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 409 if the invoice already exists", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };
    const existingInvoice = { _id: "invoice-id" };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.findOne.mockResolvedValue(existingInvoice);

    await createInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.findOne).toHaveBeenCalledWith({
      invoice_number: "INV-123",
      company: company._id,
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice already exists!",
    });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await createInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getInvoiceByCompany", () => {
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

  it("should return invoices with customer names if company is found", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };
    const invoices = [
      {
        _id: "invoice-id-1",
        customer: "customer-id-1",
        _doc: {
          _id: "invoice-id-1",
        },
      },
      {
        _id: "invoice-id-2",
        customer: "customer-id-2",
        _doc: {
          _id: "invoice-id-2",
        },
      },
    ];
    const customers = [
      { _id: "customer-id-1", name: "Customer 1" },
      { _id: "customer-id-2", name: "Customer 2" },
    ];

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.find.mockResolvedValue(invoices);
    Customer.findOne
      .mockResolvedValueOnce(customers[0])
      .mockResolvedValueOnce(customers[1]);

    await getInvoiceByCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.find).toHaveBeenCalledWith({ company: "company-id" });
    expect(Customer.findOne).toHaveBeenCalledWith({ _id: "customer-id-1" });
    expect(Customer.findOne).toHaveBeenCalledWith({ _id: "customer-id-2" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { ...invoices[0]._doc, customer_name: "Customer 1" },
      { ...invoices[1]._doc, customer_name: "Customer 2" },
    ]);
  });

  it("should return 404 if the company is not found", async () => {
    const decodedToken = { id: "user-id" };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(null);

    await getInvoiceByCompany(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getInvoiceByCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("removeInvoice", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
        invoice_number: "12345",
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

  it("should remove invoices successfully", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.deleteMany.mockResolvedValue({ deletedCount: 1 });

    await removeInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.deleteMany).toHaveBeenCalledWith({
      invoice_number: "12345",
      company: "company-id",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoices removed successfully",
    });
  });

  it("should return 404 if the company is not found", async () => {
    const decodedToken = { id: "user-id" };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(null);

    await removeInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await removeInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getInvoice", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "test-token",
        invoice_number: "12345",
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

  it("should return the invoice if found", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };
    const invoice = {
      _id: "invoice-id",
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([invoice]),
        }),
      }),
    });

    await getInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.find).toHaveBeenCalledWith({
      invoice_number: "12345",
      company: "company-id",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([invoice]);
  });

  it("should return 404 if the company is not found", async () => {
    const decodedToken = { id: "user-id" };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(null);

    await getInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  it("should return 404 if the invoice is not found", async () => {
    const decodedToken = { id: "user-id" };
    const company = {
      _id: "company-id",
      user: "user-id",
      selected_company: "Y",
    };

    jwt.verify.mockReturnValue(decodedToken);
    Company.findOne.mockResolvedValue(company);
    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      }),
    });

    await getInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "test-token",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      user: "user-id",
      selected_company: "Y",
    });
    expect(Invoice.find).toHaveBeenCalledWith({
      invoice_number: "12345",
      company: "company-id",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
  });

  it("should return 500 if there is an error", async () => {
    const error = new Error("Test error");

    jwt.verify.mockImplementation(() => {
      throw error;
    });

    await getInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("getInvoicesReport", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("No companyId, customerId, or itemId provided", async () => {
    req.query.token = "validToken";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(Invoice.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("No companyId, itemId provided but customerId provided", async () => {
    req.query.token = "validToken";
    req.query.customerId = "customerId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      customer: "customerId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("No companyId, customerId provided but itemId provided", async () => {
    req.query.token = "validToken";
    req.query.itemId = "itemId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      item: "itemId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("No companyId provided but itemId and customerId provided", async () => {
    req.query.token = "validToken";
    req.query.customerId = "customerId1";
    req.query.itemId = "itemId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      customer: "customerId1",
      item: "itemId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("CompanyId provided but itemId and customerId not provided", async () => {
    req.query.companyId = "companyId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];

    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "companyId1" });
    expect(Invoice.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("CompanyId and customerId provided but itemId not provided", async () => {
    req.query.companyId = "companyId1";
    req.query.customerId = "customerId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];

    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "companyId1" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      customer: "customerId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("CompanyId and itemId provided but customerId not provided", async () => {
    req.query.companyId = "companyId1";
    req.query.itemId = "itemId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
      },
    ];

    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "companyId1" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      item: "itemId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("CompanyId, customerId, itemId all provided", async () => {
    req.query.companyId = "companyId1";
    req.query.customerId = "customerId1";
    req.query.itemId = "itemId1";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
      },
    ];

    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "companyId1" });
    expect(Invoice.find).toHaveBeenCalledWith({
      company: "companyId1",
      customer: "customerId1",
      item: "itemId1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("Companies does not exist when companyId is not provided", async () => {
    req.query.token = "validToken";
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([]);

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  test("Companies does not exist when companyId is provided", async () => {
    req.query.companyId = "companyId1";

    Company.find.mockResolvedValue([]);

    await getInvoicesReport(req, res);

    expect(Company.find).toHaveBeenCalledWith({ _id: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  test("Error scenario", async () => {
    req.query.token = "invalidToken";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await getInvoicesReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
  });
});

describe("getInvoicesExport", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Valid token, companies found, invoices found", async () => {
    req.query.token = "validToken";
    const invoices = [
      {
        _id: "invoiceId",
        item: { rate: 10, item_name: "itemName" },
        company: { name: "companyName" },
        customer: { name: "customerName" },
        _doc: { _id: "invoiceId" },
      },
    ];
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([{ _id: "companyId1" }]);

    Invoice.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(invoices),
        }),
      }),
    });

    await getInvoicesExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(Invoice.find).toHaveBeenCalledWith({ company: "companyId1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      invoices.map((invoice) => ({
        ...invoice._doc,
        rate: invoice.item.rate,
        companyName: invoice.company.name,
        itemName: invoice.item.item_name,
        customerName: invoice.customer.name,
        __typename: "InvoicesWithRelations",
      }))
    );
  });

  test("Valid token, companies not found", async () => {
    req.query.token = "validToken";
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.find.mockResolvedValue([]);

    await getInvoicesExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.find).toHaveBeenCalledWith({ user: "userId" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Companies not found" });
  });

  test("Invalid token , error scneario", async () => {
    req.query.token = "invalidToken";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await getInvoicesExport(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "invalidToken",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
  });
});

describe("importInvoice", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        token: "validToken",
        input: {
          amount: 100,
          companyName: "companyName",
          customerName: "customerName",
          discount: 10,
          due_date: "2023-12-31",
          gst: 5,
          invoice_number: "INV123",
          invoice_date: "2023-12-01",
          itemName: "itemName",
          qty: 2,
          total_amount: 200,
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

  test("Successful import of a new invoice", async () => {
    const newinvoice = {
      _id: "newInvoiceId",
      amount: 100,
      companyName: "companyName",
      customerName: "customerName",
      discount: 10,
      due_date: "2023-12-31",
      gst: 5,
      invoice_number: "INV123",
      invoice_date: "2023-12-01",
      itemName: "itemName",
      qty: 2,
      total_amount: 200,
    };

    jwt.verify.mockReturnValue({ id: "userId" });
    Company.findOne.mockResolvedValue({ _id: "companyId" });
    Item.findOne.mockResolvedValue({ _id: "itemId" });
    Invoice.findOne.mockResolvedValue(null);
    Customer.findOne.mockResolvedValue({ _id: "customerId" });
    Invoice.create.mockResolvedValue(newinvoice);

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "companyName",
      user: "userId",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "itemName",
      company: "companyId",
    });
    expect(Invoice.findOne).toHaveBeenCalledWith({
      invoice_number: "INV123",
      item: "itemId",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      name: "customerName",
      company: "companyId",
    });
    expect(Invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_number: "INV123",
        invoice_date: new Date("2023-12-01").toISOString(),
        due_date: new Date("2023-12-31").toISOString(),
        discount: 10,
        qty: 2,
        gst: 5,
        amount: 100,
        total_amount: 200,
        company: "companyId",
        customer: "customerId",
        item: "itemId",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newinvoice);
  });

  test("Company not found", async () => {
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.findOne.mockResolvedValue(null);

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "companyName",
      user: "userId",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Company not found" });
  });

  test("Item not found", async () => {
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.findOne.mockResolvedValue({ _id: "companyId" });
    Item.findOne.mockResolvedValue(null);

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "companyName",
      user: "userId",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "itemName",
      company: "companyId",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Item not found" });
  });

  test("Invoice already exists", async () => {
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.findOne.mockResolvedValue({ _id: "companyId" });
    Item.findOne.mockResolvedValue({ _id: "itemId" });
    Invoice.findOne.mockResolvedValue({ _id: "existingInvoiceId" });

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "companyName",
      user: "userId",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "itemName",
      company: "companyId",
    });
    expect(Invoice.findOne).toHaveBeenCalledWith({
      invoice_number: "INV123",
      item: "itemId",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invoice already exists!",
    });
  });

  test("Customer not found", async () => {
    jwt.verify.mockReturnValue({ id: "userId" });
    Company.findOne.mockResolvedValue({ _id: "companyId" });
    Item.findOne.mockResolvedValue({ _id: "itemId" });
    Invoice.findOne.mockResolvedValue(null);
    Customer.findOne.mockResolvedValue(null);

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(Company.findOne).toHaveBeenCalledWith({
      name: "companyName",
      user: "userId",
    });
    expect(Item.findOne).toHaveBeenCalledWith({
      item_name: "itemName",
      company: "companyId",
    });
    expect(Invoice.findOne).toHaveBeenCalledWith({
      invoice_number: "INV123",
      item: "itemId",
    });
    expect(Customer.findOne).toHaveBeenCalledWith({
      name: "customerName",
      company: "companyId",
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Customer not found" });
  });

  test("Error scenario", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await importInvoice(req, res);

    expect(jwt.verify).toHaveBeenCalledWith(
      "validToken",
      process.env.SECRET_KEY
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
  });
});
