import { MongoClient } from "mongodb";
import bodyparser from "body-parser";
import cors from "cors";
import cookieparser from "cookie-parser";
import express, { response } from "express";
import * as dotenv from "dotenv";
import bcrypt from "bcrypt";
import { ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken";

import nodemailer from 'nodemailer';
import pug from 'pug';
import path from 'path';



dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());
app.use(cookieparser());

const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URL = process.env.MONGO_URL;



async function hashedPassword(password) {
  const NO_OF_ROUNDS = 10;
  const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}

async function MongoConnect() {
  const client = await new MongoClient(MONGO_URL, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  }).connect();
  console.log("Mongo Connected ✨✨");
  return client;
}

const client = await MongoConnect();



app.get("/", function (request, response) {
  response.send("🙋‍♂️ Welcome to LT Backend");
});

app.post("/signin", async (request, response) => {
  const { email, password, login_location, loginDay, loginTime, login } = request.body;
  try {
    const userdb = await client.db("LT").collection("Users").findOne({ email });

    if (userdb) {
      const isSame = await bcrypt.compare(password, userdb.password);

      if (isSame) {
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

        //mark atttendence here
        const usersCollection = client.db("LT").collection("Users");

        try {
          const user = await usersCollection.findOne({ email });
          if (!user) {
            console.error("User not found");
            return;
          }

          const date = new Date();
          const loginTime = date.toLocaleTimeString(undefined, {
            timeZone: "Asia/Kolkata",
          });
          const loginDay = date.toLocaleDateString(undefined, {
            timeZone: "Asia/Kolkata",
          });

          const userAttendance = await usersCollection.findOne({
            email,
            "attendance.loginDay": loginDay,
          });

          if (!userAttendance) {
            const newAttendance = {
              loginDay,
              loginTime,
              login,
              login_location,
              logoutTime: "yet to be logged out",
              logoutDay: "yet to be logged out",
              logout: '',              
              breaks: [],
            };

            await usersCollection.updateOne(
              { email },
              { $push: { attendance: newAttendance } }
            );

            response
              .status(200)
              .send({
                msg: "Logged in",
                name: userdb.name,
                role: userdb.role,
                loginDay,
                loginTime,
                token,
                email,
              });
          } else {
            response
              .status(200)
              .send({ msg: "Cannot login more than once per day", email });
          }
        } catch (error) {
          console.error("Error marking attendance:", error);
        }      
      } else {
        response.status(400).send({ msg: "Invalid credentials" });
      }
    } else {
      response.status(400).send({ msg: "No user found" });
    }
  } catch (error) {
    console.error("Error during signin:", error);
    response.status(500).send({ msg: "Internal server error" });
  }
});

app.post("/signout", async function (request, response) {
  let { email, login } = request.body;

  console.log(login)

  const usersCollection = client.db("LT").collection("Users");

  
  try {

    let user = await usersCollection.findOne({ email,  "attendance.login": login});


    if (user) {
      const date = new Date();
      const logoutTime = date.toLocaleTimeString(undefined, {
        timeZone: "Asia/Kolkata",
      });
      const logoutDay = date.toLocaleDateString(undefined, {
        timeZone: "Asia/Kolkata",
      });

      // Update the latest attendance record with logout time
      const attendance = user.attendance;
      if (attendance && attendance.length > 0) {
        const dayAttendance = attendance[attendance.length - 1];
        dayAttendance.logout = date;
        dayAttendance.logoutTime = logoutTime;
        dayAttendance.logoutDay = logoutDay;

        const put = await usersCollection.updateOne(
          { email, "attendance.login": login },
          { $set: { "attendance.$.logout": date, "attendance.$.logoutTime": logoutTime, "attendance.$.logoutDay": logoutDay} }
        );    

         console.log(put) 

        response
          .status(200)
          .send({ msg: "Logout time recorded successfully" });
      } else {
        response
          .status(400)
          .send({ msg: "No attendance record found for today" });
      }
    } else {
      return response.status(404).send({ msg: "User not found" });
    }
  } catch (error) {
    console.error("Error updating logout time:", error);
    response.status(500).send({ msg: "Failed to update logout time" });
  }
});

// signin signup and signout user
app.post("/signup", async function (request, response) {
  let { name, email, password, role_radio } = request.body;

  let userdb = await client
    .db("LT")
    .collection("Users")
    .findOne({ email: email });
  if (userdb) {
    response.status(200).send({ msg: "User already present" });
  } else {
    const hashedPass = await hashedPassword(password);
    const userToInsert = {
      name: name,
      email: email,
      photoURL: "",
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

    let result = await client
      .db("LT")
      .collection("Users")
      .insertOne(userToInsert);
    response.status(201).send({ msg: "User added" });
  }
});

//service for sending emails using Nodemailer and Pug.


const transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "api", 
    pass: "ceb9400d790bf0179fc5a80dbad444d0"
  },
  debug: true, // show debug output
  logger: true // log information in console
});

const sendVerificationEmail = async (to, email_verificationCode) => {
  const templatePath = path.join(process.cwd(), 'email_verification.pug');
  const html = pug.renderFile(templatePath, { email_verificationCode });

  const mailOptions = {
    from: "mailtrap@demomailtrap.com",
    to:to,
    subject: 'Email Verification',
    html: html,
  }; 
 
  try { 
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};



app.post('/send-verification-code', async (req, res) => {
  const { email } = req.body;
  const email_verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await client.db('LT').collection('Users').updateOne(
      { email: email },
      { $set: { email_verificationCode: email_verificationCode } },
      { upsert: true }
    );

    await sendVerificationEmail(email, email_verificationCode);
    res.status(200).send('Verification code sent');
  } catch (error) {
    res.status(500).send('Error sending verification code');
  }
});

app.post('/verify-code', async (req, res) => {
  const { email, email_verificationCode } = req.body;

  try {
    const user = await client.db('LT').collection('Users').findOne({ email: email });

    if (user && user.email_verificationCode === email_verificationCode) {
      res.status(200).send('Email verified successfully');
    } else {
      res.status(400).send('Invalid verification code');
    }
  } catch (error) {
    res.status(500).send('Error verifying code');
  }
});


//update

const updateUserProfile = async (req, res) => {
  const { email, name, photoURL } = req.body;

  if (!name && !photoURL) {
    return res
      .status(400)
      .json({ message: "At least one field (name or photoUrl) are required" });
  }

  try {
    const db = client.db("LT");
    const collection = db.collection("Users");

    const updateFields = {};
    if (name) updateFields.name = name;
    if (photoURL) updateFields.photoURL = photoURL;
    console.log(updateFields);

    const result = await collection.updateOne(
      { email },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found or no changes made" });
    }

    res.json({ message: "User profile updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

app.patch("/update-profile", updateUserProfile);


app.get("/allenquirys", async (request, response) => {
  try {
    const enquirydb = await client
      .db("LT")
      .collection("Enquirys")
      .find()
      .toArray();
    if (enquirydb) {
      response.status(200).send({ msg: "Enquiry found", enquirydb });
    } else {
      response.status(400).send({ msg: "No enquiry found" });
    }
  } catch (error) {
    console.error("Error during enqyiry search:", error);
    response.status(500).send({ msg: "Internal server error" });
  }
}); 

app.get("/allusers", async (request, response) => {
  try {
    const usersdb = await client.db("LT").collection("Users").find().toArray();
    if (usersdb) {
      response.status(200).send({ msg: "Users found", usersdb });
    } else {
      response.status(400).send({ msg: "No user found" });
    }
  } catch (error) {
    console.error("Error during user search:", error);
    response.status(500).send({ msg: "Internal server error" });
  }
});

// for blog editor

app.post("/editor/:id", async function (request, response) {
  try {
    const id = request.params.id;
    const content = request.content;
    let blogdb = await client.db("LT").collection("Drafts").findOne({ id });

    if (blogdb) {
      response
        .status(200)
        .send({ msg: `Draft of ${id} already present`, blogdb });
    } else {
      let result = await client.db("LT").collection("Drafts").insertOne({
        id,
        content,
      });
      response.status(201).send({ msg: `Draft of ${id} added`, result });
    }
  } catch (error) {
    response.status(500).send(error);
  }
});


// send touch history to db

app.post("/enquiry/touch", async function (request, response) {
  let {email, type, comment,contact, touchedBy} = request.body;
  let insert_data = await client
    .db("LT")
    .collection("Enquirys")
    .updateMany({
     email
    },{
      $push: {
        touchHistory: {
          type,
          comment,
          time: new Date(),
          touchedBy: touchedBy || 'user'
        }
      }
    });    
    if (insert_data.acknowledged===true) {
      const updatedUsers = await client.db('LT').collection('Enquirys').findOne({email});
      response.status(204).send({data:updatedUsers});
    } else {
      response.status(404).send({ message: 'No enquirys found' });
    }
});

// get touchHistory of a enquired user

// GET route to fetch touchHistory by email
app.get('/enquiry/touch-history', async (req, res) => {
  const {email, contact} = req.query

  try {
    const user = await client.db('LT').collection('Enquirys').findOne({email});

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Extract touchHistory from user document
    const touchHistory = user.touchHistory;

    res.status(200).send({history:touchHistory});
  } catch (error) {
    console.error('Error fetching touchHistory:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});



// post enquiry

app.post("/enquiry", async function (request, response) {
  let data = request.body;
  let enquiryData = [...data,touchHistory,touchReminder]
  let insert_data = await client
    .db("LT")
    .collection("Enquirys")
    .insertOne(enquiryData);
  if (insert_data) {
    response.status(200).send({ msg: "Enquirey registered" });
  } else {
    response.status(400).send({ msg: "Some error happened" });
  }
});



app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨✨`));
