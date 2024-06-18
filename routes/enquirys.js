import express from "express";
import { client } from '../../ltbackend2/index.js';

const router = express.Router();

router.get("/allenquirys", async (request, response) => {
  try {
    const enquirydb = await client
      .db("LT")
      .collection("Enquireys")
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

export default router;
