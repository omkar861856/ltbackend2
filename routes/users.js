import express from "express";
import { client } from '../../ltbackend2/index.js';

const router = express.Router();

router.get("/allusers", async (request, response) => {
  try {
    const usersdb = await client
      .db("LT")
      .collection("Users")
      .find()
      .toArray();
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

export default router;
