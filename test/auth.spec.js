const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const {
  register,
  login,
  getAllUsers,
  verifyEmail,
  getUser,
} = require("../controllers/authController");

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("bcryptjs");
jest.mock("crypto");
jest.mock("nodemailer");

jest.mock("../models/user", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

describe("register", () => {
  let req, res, mockTransporter, mockSendMail;

  beforeEach(() => {
    req = {
      body: {
        username: "testuser",
        email: "testuser@example.com",
        password: "password123",
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockTransporter = {
      sendMail: jest.fn(),
    };

    mockSendMail = jest.fn();

    nodemailer.createTransport.mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successful registration and email sending", async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashedpassword123");
    crypto.randomInt.mockReturnValue(123456);
    User.create.mockResolvedValue({
      _id: "user-id",
      username: "testuser",
      email: "testuser@example.com",
      password: "hashedpassword123",
      verified: "N",
      verifyotp: 123456,
      company_existing: "N",
    });
    mockTransporter.sendMail.mockResolvedValue({});

    await register(req, res);

    console.log("res.status calls:", res.status.mock.calls); // Log res.status calls
    console.log("res.json calls:", res.json.mock.calls);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
    expect(crypto.randomInt).toHaveBeenCalledWith(100000, 999999);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "testuser",
        email: "testuser@example.com",
        password: "hashedpassword123",
        verified: "N",
        verifyotp: "123456",
        company_existing: "N",
      })
    );
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      })
    );
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.SMTP_USER,
        to: "testuser@example.com",
        subject: "Verify Email",
        html: "<p>Use this OTP-<strong>123456</strong> to verify your email. Use Link http://localhost:5173/verify-email</p>",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Sent email verification OTP successfully",
    });
  });

  test("User already exists", async () => {
    User.findOne.mockResolvedValue({ _id: "existingUserId" });

    await register(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "User already exists" });
  });

  test("Internal server error", async () => {
    User.findOne.mockImplementation(() => {
      throw new Error("Database error");
    });

    await register(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("login", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        email: "testuser@example.com",
        password: "password123",
      },
    };

    res = {
      status: jest.fn(),
      json: jest.fn(),
    };

    process.env.SECRET_KEY = "testsecretkey";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("User email not verified", async () => {
    User.findOne.mockResolvedValue({ verified: "N" });

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "User Email not verified",
    });
  });

  test("Invalid credentials when user not found", async () => {
    User.findOne.mockResolvedValue(null);

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Cannot read properties of null (reading 'verified')",
    });
  });

  test("Invalid credentials when password is incorrect", async () => {
    User.findOne.mockResolvedValue({
      verified: "Y",
      password: "hashedpassword123",
    });
    bcrypt.compare.mockResolvedValue(false);

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "password123",
      "hashedpassword123"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid credentials" });
  });

  test("Successful login", async () => {
    User.findOne.mockResolvedValue({
      verified: "Y",
      password: "hashedpassword123",
      _id: "user-id",
      email: "testuser@example.com",
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("testtoken");

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      "password123",
      "hashedpassword123"
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: "user-id", email: "testuser@example.com" },
      "testsecretkey",
      { expiresIn: "24h" }
    );
    expect(res.json).toHaveBeenCalledWith({ token: "testtoken" });
  });

  test("Internal server error", async () => {
    User.findOne.mockRejectedValue(new Error("Database error"));

    await login(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "testuser@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("getAllUsers", () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Get all users successfully", async () => {
    const usersData = [
      { _id: "user-id1", username: "user1" },
      { _id: "user-id2", username: "user2" },
    ];

    User.find.mockResolvedValue(usersData);

    await getAllUsers(req, res);

    expect(User.find).toHaveBeenCalledWith({}, "username");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(usersData);
  });

  test("Internal server error", async () => {
    const errorMessage = "Database error";

    User.find.mockRejectedValue(new Error(errorMessage));

    await getAllUsers(req, res);

    expect(User.find).toHaveBeenCalledWith({}, "username");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("verifyEmail", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        otp: "123456",
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

  test("Verify email successfully", async () => {
    const user = { _id: "user-id", verifyotp: "123456" };

    User.findOneAndUpdate.mockResolvedValue(user);

    await verifyEmail(req, res);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { verifyotp: "123456" },
      { $set: { verifyotp: null, verified: "Y" } },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "User verified successfully!",
    });
  });

  test("Invalid or expired OTP", async () => {
    User.findOneAndUpdate.mockResolvedValue(null);

    await verifyEmail(req, res);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { verifyotp: "123456" },
      { $set: { verifyotp: null, verified: "Y" } },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired OTP",
    });
  });

  test("Internal server error", async () => {
    const errorMessage = "Database error";

    User.findOneAndUpdate.mockRejectedValue(new Error(errorMessage));

    await verifyEmail(req, res);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { verifyotp: "123456" },
      { $set: { verifyotp: null, verified: "Y" } },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});

describe("getUser", () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {
        token: "mockToken",
      },
    };
    res = {
      status: jest.fn(),
      json: jest.fn(),
    };
    process.env.SECRET_KEY = "testSecretKey";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Get user successfully", async () => {
    const userId = "userId";
    const user = {
      _id: "userId",
      username: "testuser",
      email: "testuser@example.com",
    };

    jwt.verify.mockReturnValue({ id: userId });
    User.findOne.mockResolvedValue(user);

    await getUser(req, res);

    expect(jwt.verify).toHaveBeenCalledWith("mockToken", "testSecretKey");
    expect(User.findOne).toHaveBeenCalledWith({ _id: userId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(user);
  });

  test("Internal server error", async () => {
    const errorMessage = "Database error";

    jwt.verify.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await getUser(req, res);

    expect(jwt.verify).toHaveBeenCalledWith("mockToken", "testSecretKey");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
  });
});
