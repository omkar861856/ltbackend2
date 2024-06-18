// Assuming this is your corrected code
import express from "express";
import { client } from "../../ltbackend2/index.js"; // Assuming client is exported from index.js

const router = express.Router();

router.post("/signout", async function (request, response) {
  let { email } = request.body;

  const usersCollection = client.db("LT").collection("Users");

  try {
    let user = await usersCollection.findOne({ email: email });

    if (user) { 
      const date = new Date()
      const logoutTime = date.toLocaleTimeString(undefined, {timeZone: 'Asia/Kolkata',});;
      const logoutDay = date.toLocaleDateString(undefined, {timeZone: 'Asia/Kolkata',});;

      // Update the latest attendance record with logout time
      const attendance = user.attendance;      
      if (attendance && attendance.length > 0) {
        const dayAttendance = attendance[attendance.length - 1];
        dayAttendance.logoutTime = logoutTime;
        dayAttendance.logoutDay= logoutDay;

        await usersCollection.updateOne(
          { email, "attendance.date": dayAttendance.loginDay },
          { $set: { "attendance.$": dayAttendance } }
        );       

        response.status(200).send({ message: "Logout time recorded successfully" });
      } else {
        response 
          .status(400)
          .send({ message: "No attendance record found for today" }); 
      }
    } else {
      return response.status(404).send({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating logout time:", error);
    response.status(500).send({ message: "Failed to update logout time" });
  }
});

export default router; 
 