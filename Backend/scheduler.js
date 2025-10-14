// scheduler.js
import cron from "node-cron";
import Medicine from "../models/Medicine.js";
import User from "../models/User.js";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Function to send SMS reminder
const sendReminder = async (medicine, user) => {
    if (!user.phoneNumber) {
        console.log(`❌ User ${user.email} has no phone number. Skipping SMS reminder.`);
        return;
    }

    try {
        // ✅ Format message
        const message = `💊 Hello ${user.name || 'User'}, it's time to take your medicine!
Reminder: ${medicine.name}
Dose: ${medicine.dose}
Stock Remaining: ${medicine.stock - 1}`;

        // ✅ Send SMS
        const result = await client.messages.create({
            body: message,
            from: twilioNumber,
            to: user.phoneNumber
        });

        console.log(`📩 SMS sent successfully to ${user.phoneNumber} — SID: ${result.sid}`);

        // ✅ Decrement stock after SMS is sent
        if (medicine.stock > 0) {
            await Medicine.findByIdAndUpdate(
                medicine._id,
                { $inc: { stock: -1 }, lastRemindedAt: new Date() },
                { new: true }
            );
            console.log(`🧾 Stock updated for ${medicine.name}`);
        }

    } catch (error) {
        console.error(`❌ Failed to send SMS to ${user.phoneNumber}`);
        console.error("Twilio Error:", error.message);
    }
};

// ✅ Scheduler runs every minute
const reminderScheduler = () => {
    cron.schedule("* * * * *", async () => {
        const now = new Date();

        // ⏳ Adjusting for IST (UTC+5:30) if needed
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);

        const currentTime = `${String(istDate.getHours()).padStart(2, '0')}:${String(istDate.getMinutes()).padStart(2, '0')}`;
        const currentDay = istDate.toLocaleString('en-US', { weekday: 'long' }).toLowerCase().substring(0, 3);
        const startOfToday = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());

        console.log(`\n⏰ Running reminder check at IST ${currentTime} (${currentDay})`);

        try {
            const dueReminders = await Medicine.find({
                time: currentTime,
                $or: [
                    { recurrence: "daily" },
                    { days: currentDay }
                ],
                $or: [
                    { lastRemindedAt: { $exists: false } },
                    { lastRemindedAt: { $lt: startOfToday } }
                ],
                stock: { $gt: 0 }
            }).populate("userId");

            console.log(`🩺 Found ${dueReminders.length} reminders due.`);

            for (const medicine of dueReminders) {
                const user = medicine.userId;
                if (user && user.phoneNumber) {
                    console.log(`➡ Sending reminder to ${user.phoneNumber} for ${medicine.name}`);
                    await sendReminder(medicine, user);
                } else {
                    console.log(`❌ Skipping reminder for ${medicine.name} — no phone number`);
                }
            }

        } catch (error) {
            console.error("❌ Error during reminder check:", error);
        }
    });
};

export default reminderScheduler;

