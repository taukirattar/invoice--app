const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

//signup
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      return res.json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = crypto.randomInt(100000, 999999).toString();

    // Create new user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      verified: "N",
      verifyotp: otp,
      company_existing: "N",
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // Ignore self-signed certificates
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Verify Email",
      html: `<p>Use this OTP-<strong>${otp}</strong> to verify your email. Use Link http://localhost:5173/verify-email</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201);
    res.json({ message: "Sent email verification OTP successfully" });
  } catch (error) {
    console.error(error);
    res.status(500);
    res.json({ message: "Internal server error" });
  }
};

//login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (user.verified === "N") {
      res.status(200);
      return res.json({ message: "User Email not verified" });
    }

    if (!user) {
      res.status(200);
      return res.json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(200);
      return res.json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.SECRET_KEY,
      {
        expiresIn: "24h",
      }
    );

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(200);
    res.json({ message: error.message });
  }
};

//getusers

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "username"); // Retrieve only usernames
    res.status(200);
    res.json(users);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { otp } = req.body;
  console.log("otp", otp);
  try {
    const user = await User.findOneAndUpdate(
      { verifyotp: otp },
      { $set: { verifyotp: null, verified: "Y" } },
      { new: true }
    );

    if (!user) {
      res.status(200);
      return res.json({ message: "Invalid or expired OTP" });
    }

    res.status(200);
    return res.json({ message: "User verified successfully!" });
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.getUser = async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.id;

    const user = await User.findOne({ _id: userId });
    res.status(200);
    res.json(user);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: "User not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    user.resetotp = otp;
    await user.save();

    const transporter = nodemailer.createTransport({
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
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: "Password Reset",
      html: `<p>Use this OTP: <strong>${otp}</strong> to reset your password. Use the link: <a href="http://localhost:5173/reset-password">Reset Password</a></p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset email sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;

    const user = await User.findOne({ resetotp: otp });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetotp = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
