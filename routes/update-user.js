import { client } from "../../ltbackend2/index.js";
import express from 'express'

const router = express.Router();

const updateUserProfile = async (req, res) => {
    const { email, name, photoURL } = req.body;

    if ((!name && !photoURL)) {
        return res.status(400).json({ message: 'At least one field (name or photoUrl) are required' });
    }

    try {
        const db = client.db('LT');
        const collection = db.collection('Users');

        const updateFields = {};
        if (name) updateFields.name = name;
        if (photoURL) updateFields.photoURL = photoURL;
        console.log(updateFields)

        const result = await collection.updateOne(
            { email },
            { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'User not found or no changes made' });
        }

        res.json({ message: 'User profile updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


router.patch('/update-profile', updateUserProfile);



export default router;
