// scheduler.js
import cron from "node-cron";
import Medicine from "../models/medicine.js";
import User from "../models/user.js";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER; 
const client = twilio(accountSid, authToken);

const sendReminder = async (medicine, user) => {
    if (!user.phoneNumber) {
        console.log(`❌ User ${user.email} has no phone number. Skipping SMS reminder.`);
        return;
    }
    
    try {
        const message = `Hello ${user.name || 'User'}, it's time to take your medicine. 
        \nReminder: ${medicine.name}
        \nDose: ${medicine.dose}
        \nStock Remaining: ${medicine.stock - 1}`; // Show the stock after decrement

        await client.messages.create({
            body: message,
            from: twilioNumber,
            to: user.phoneNumber 
        });

        // ✅ NEW LOGIC: Decrement stock by 1 after successful SMS sent
        if (medicine.stock > 0) {
            await Medicine.findByIdAndUpdate(
                medicine._id, 
                { $inc: { stock: -1 }, lastRemindedAt: new Date() },
                { new: true }
            );
        }

        console.log(`✅ Reminder sent and stock for "${medicine.name}" decremented for user: ${user.email}`);

    } catch (error) {
        console.error(`❌ Failed to send SMS to ${user.phoneNumber}:`, error);
        console.error("Twilio Error Details:", error);
    }
};

const reminderScheduler = () => {
    cron.schedule("* * * * *", async () => {
        console.log("⏰ Running reminder check...");

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.toLocaleString('en-US', { weekday: 'long' }).toLowerCase().substring(0, 3);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        try {
            const dueReminders = await Medicine.find({
                $expr: {
                    $and: [
                        { $eq: [ "$time", currentTime ] },
                        {
                            $or: [
                                { $eq: ["$recurrence", "daily"] },
                                { $in: [currentDay, "$days"] }
                            ]
                        }
                    ]
                },
                $or: [
                    { lastRemindedAt: { $exists: false } },
                    { lastRemindedAt: { $lt: startOfToday } }
                ],
                stock: { $gt: 0 } // Only find medicines that have stock
            }).populate('userId');

            console.log(`⏰ Found ${dueReminders.length} reminders due for the minute.`);
            
            if (dueReminders.length > 0) {
                for (const medicine of dueReminders) {
                    const user = medicine.userId;
                    
                    if (user && user.phoneNumber) {
                        console.log(`Attempting to send SMS to ${user.phoneNumber} for medicine: ${medicine.name}`);
                        await sendReminder(medicine, user);
                    } else if (user) {
                        console.log(`❌ User ${user.email} has no phone number. Skipping SMS reminder.`);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error running reminder check:", error);
        }
    });
};

export default reminderScheduler;
