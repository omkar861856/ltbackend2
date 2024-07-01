import { MongoClient } from "mongodb";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import pug from "pug";
import path from "path";

dotenv.config();

const app = express();

// CORS configuration
const whitelist = [
  "https://ltenquiry.netlify.app",
  "https://learnmoretechnologies.netlify.app",
  "http://localhost:3030",
];
const corsOptions = {
  origin: (origin, callback) => {
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const { PORT, JWT_SECRET, MONGO_URL } = process.env;

// Utility functions
const hashedPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const MongoConnect = async () => {
  const client = new MongoClient(MONGO_URL, {
    serverApi: {
      version: "1",
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  console.log("Mongo Connected ✨✨");
  return client;
};

const client = await MongoConnect();

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "api",
    pass: "ceb9400d790bf0179fc5a80dbad444d0",
  },
  debug: true,
  logger: true,
});

const sendVerificationEmail = async (to, email_verificationCode) => {
  const templatePath = path.join(process.cwd(), "email_verification.pug");
  const html = pug.renderFile(templatePath, { email_verificationCode });

  const mailOptions = {
    from: "mailtrap@demomailtrap.com",
    to,
    subject: "Email Verification",
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Routes
app.get("/cors", (req, res) => {
  res.send("CORS policy is working!");
});

app.get("/", (req, res) => {
  res.send("🙋‍♂️ Welcome to LT Backend");
});

app.post("/signup", async (req, res) => {
  const { name, email, password, role_radio } = req.body;
  const userCollection = client.db("LT").collection("Users");

  const existingUser = await userCollection.findOne({ email });
  if (existingUser) {
    return res.status(200).send({ msg: "User already present" });
  }

  const hashedPass = await hashedPassword(password);
  const newUser = {
    name,
    email,
    photoURL: "",
    createdAt: new Date(),
    createdAtDay: new Date().toLocaleDateString(undefined, {
      timeZone: "Asia/Kolkata",
    }),
    createdAtTime: new Date().toLocaleTimeString(undefined, {
      timeZone: "Asia/Kolkata",
    }),
    password: hashedPass,
    role: role_radio,
    holidays: [],
    leaves: [],
    attendance: [],
  };

  await userCollection.insertOne(newUser);
  res.status(201).send({ msg: "User added" });
});

app.post("/signin", async (req, res) => {
  const { email, password, login_location, loginDay, loginTime, login } =
    req.body;
  const userCollection = client.db("LT").collection("Users");

  try {
    const user = await userCollection.findOne({ email });
    if (!user) {
      return res.status(400).send({ msg: "No user found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send({ msg: "Invalid credentials" });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

    const date = new Date();
    const loginTime = date.toLocaleTimeString(undefined, {
      timeZone: "Asia/Kolkata",
    });
    const loginDay = date.toLocaleDateString(undefined, {
      timeZone: "Asia/Kolkata",
    });

    const userAttendance = await userCollection.findOne({
      email,
      "attendance.loginDay": loginDay,
    });

    if (!userAttendance) {
      const newAttendance = {
        loginDay,
        loginTime,
        login,
        isLoggedIn: true,
        login_location,
        logoutTime: "yet to be logged out",
        logoutDay: "yet to be logged out",
        logout: "",
        breaks: [],
      };

      await userCollection.updateOne(
        { email },
        { $push: { attendance: newAttendance } }
      );

      return res.status(200).send({
        msg: "Logged in",
        name: user.name,
        role: user.role,
        loginDay,
        loginTime,
        photoURL: user.photoURL,
        token,
        email,
      });
    }

    res.status(200).send({ msg: "Cannot login more than once per day", email });
  } catch (error) {
    console.error("Error during signin:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});

app.post("/signout", async (req, res) => {
  const { email, login } = req.body;
  const userCollection = client.db("LT").collection("Users");

  try {
    const user = await userCollection.findOne({
      email,
      "attendance.login": login,
    });
    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    const date = new Date();
    const logoutTime = date.toLocaleTimeString(undefined, {
      timeZone: "Asia/Kolkata",
    });
    const logoutDay = date.toLocaleDateString(undefined, {
      timeZone: "Asia/Kolkata",
    });

    const attendance = user.attendance[user.attendance.length - 1];
    attendance.logout = date;
    attendance.logoutTime = logoutTime;
    attendance.logoutDay = logoutDay;
    attendance.isLoggedIn = false;

    await userCollection.updateOne(
      { email, "attendance.login": login },
      {
        $set: {
          "attendance.$.logout": date,
          "attendance.$.logoutTime": logoutTime,
          "attendance.$.logoutDay": logoutDay,
          "attendance.$.isLoggedIn": false,
        },
      }
    );

    res.status(200).send({ msg: "Logout time recorded successfully" });
  } catch (error) {
    console.error("Error updating logout time:", error);
    res.status(500).send({ msg: "Failed to update logout time" });
  }
});

app.post("/send-verification-code", async (req, res) => {
  const { email } = req.body;
  const email_verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  try {
    await client
      .db("LT")
      .collection("Users")
      .updateOne(
        { email },
        { $set: { email_verificationCode } },
        { upsert: true }
      );

    await sendVerificationEmail(email, email_verificationCode);
    res.status(200).send("Verification code sent");
  } catch (error) {
    res.status(500).send("Error sending verification code");
  }
});

app.post("/verify-code", async (req, res) => {
  const { email, email_verificationCode } = req.body;

  try {
    const user = await client.db("LT").collection("Users").findOne({ email });
    if (user && user.email_verificationCode === email_verificationCode) {
      res.status(200).send("Email verified successfully");
    } else {
      res.status(400).send("Invalid verification code");
    }
  } catch (error) {
    res.status(500).send("Error verifying code");
  }
});

app.patch("/update-profile", cors(corsOptions), async (req, res) => {
  const { email, name, photoURL } = req.body;

  try {
    const updateFields = { name, photoURL };
    const result = await client
      .db("LT")
      .collection("Users")
      .updateOne({ email }, { $set: updateFields });

    if (result.modifiedCount === 0) {
      return res.status(200).send({ message: "No changes made" });
    }

    res.status(204).send({ message: "User profile updated successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.post("/enquiry", async (req, res) => {
  const enquiryData = {
    ...req.body,
    touchHistory: [],
    touchReminder: [],
  };

  try {
    await client.db("LT").collection("Enquirys").insertOne(enquiryData);
    res.status(200).send({ msg: "Enquiry registered" });
  } catch (error) {
    res.status(400).send({ msg: "Some error happened" });
  }
});

app.get("/allenquirys", async (req, res) => {
  try {
    const enquiries = await client
      .db("LT")
      .collection("Enquirys")
      .find()
      .toArray();
    if (enquiries) {
      res.status(200).send({ msg: "Enquiries found", enquiries });
    } else {
      res.status(400).send({ msg: "No enquiries found" });
    }
  } catch (error) {
    console.error("Error during enquiry search:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});

app.get("/allusers", async (req, res) => {
  try {
    const users = await client.db("LT").collection("Users").find().toArray();
    if (users) {
      res.status(200).send({ msg: "Users found", users });
    } else {
      res.status(400).send({ msg: "No users found" });
    }
  } catch (error) {
    console.error("Error during user search:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});

app.post("/editor/:id", async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    const draft = await client.db("LT").collection("Drafts").findOne({ id });
    if (draft) {
      return res
        .status(200)
        .send({ msg: `Draft of ${id} already present`, draft });
    }

    const result = await client
      .db("LT")
      .collection("Drafts")
      .insertOne({ id, content });
    res.status(201).send({ msg: `Draft of ${id} added`, result });
  } catch (error) {
    res.status(500).send({ msg: "Error adding draft", error });
  }
});

app.post("/enquiry/touch", async (req, res) => {
  const { email, type, comment, contact, touchedBy } = req.body;

  try {
    const result = await client
      .db("LT")
      .collection("Enquirys")
      .updateMany(
        { email },
        {
          $push: {
            touchHistory: {
              type,
              comment,
              time: new Date(),
              touchedBy: touchedBy || "user",
            },
          },
        }
      );

    if (result.acknowledged) {
      const updatedEnquiry = await client
        .db("LT")
        .collection("Enquirys")
        .findOne({ email });
      res.status(204).send({ data: updatedEnquiry });
    } else {
      res.status(404).send({ msg: "No enquiries found" });
    }
  } catch (error) {
    console.error("Error updating touch history:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});

app.get("/enquiry/touch-history", async (req, res) => {
  const { email } = req.query;

  try {
    const enquiry = await client
      .db("LT")
      .collection("Enquirys")
      .findOne({ email });

    if (!enquiry) {
      return res.status(404).send({ msg: "User not found" });
    }

    res.status(200).send({ history: enquiry.touchHistory });
  } catch (error) {
    console.error("Error fetching touch history:", error);
    res.status(500).send({ msg: "Internal server error" });
  }
});

app.listen(PORT, () =>
  console.log(`The server started on port: ${PORT} ✨✨✨`)
);
