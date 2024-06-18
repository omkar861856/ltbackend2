import { MongoClient } from "mongodb";
import bodyparser from "body-parser";
import cors from "cors";
import cookieparser from "cookie-parser";
import express, { response } from "express";
import * as dotenv from "dotenv";
import bcrypt from "bcrypt";
import { ServerApiVersion } from "mongodb";

import signInRouter from './routes/signin.js';
import signOutRouter from './routes/signout.js';
import signUpRouter from './routes/signup.js';
import updateUserRouter from './routes/update-user.js';
import allEnqyirysRouter from './routes/enquirys.js';
import allUsersRouter from './routes/users.js';


dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json())

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());
app.use(cookieparser());

const PORT = process.env.PORT;
export const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URL = process.env.MONGO_URL;

export async function hashedPassword(password) {
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
  console.log("Mongo Connected");
  return client;
}

export const client = await MongoConnect();

app.get("/", function (request, response) {
  response.send("🙋‍♂️ Welcome to LT Backend");
});

// Use routes sign in
app.use('/', signInRouter);

// Use routes sign out
app.use('/', signOutRouter);

// Use routes sign up
app.use('/', signUpRouter);

// update user
app.use('/user', updateUserRouter);

// enquiry
app.use('/enquirys', allEnqyirysRouter);
// enquiry
app.use('/users', allUsersRouter);


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


app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨`));
