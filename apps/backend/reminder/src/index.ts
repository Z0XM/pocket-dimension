import twilio from "twilio";
import { getBirthdayMessage, getDayOfYear } from "./messages";

// Birthday configuration from environment variables
const BIRTHDAY_TARGET_PHONE = Bun.env.BIRTHDAY_TARGET_PHONE || "";
const BIRTHDAY_TARGET_NAME = Bun.env.BIRTHDAY_TARGET_NAME || "Friend";
const BIRTHDAY_DAY = Number(Bun.env.BIRTHDAY_DAY) || 1; // Day of month (1-31)
const BIRTHDAY_MONTH = Number(Bun.env.BIRTHDAY_MONTH) || 1; // Month (1-12)

// Twilio configuration
const TWILIO_ACCOUNT_SID = Bun.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = Bun.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = Bun.env.TWILIO_PHONE_NUMBER || "";
// WhatsApp Content Template SID (required for trial accounts)
// Create a template in Twilio Console > Content > Templates
// Template should have variables: {{1}} for name, {{2}} for days since, {{3}} for days until, {{4}} for unique birthday wish
const TWILIO_CONTENT_TEMPLATE_SID = Bun.env.TWILIO_CONTENT_TEMPLATE_SID || "";

// Initialize Twilio client
const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

/**
 * Calculate days since last birthday and days until next birthday
 */
function calculateBirthdayDays(): {
  daysSince: number;
  daysUntil: number;
  lastBirthday: Date;
  nextBirthday: Date;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11
  const currentDay = today.getDate();

  // Calculate last birthday
  let lastBirthdayYear = currentYear;
  const lastBirthday = new Date(currentYear, BIRTHDAY_MONTH - 1, BIRTHDAY_DAY);
  lastBirthday.setHours(0, 0, 0, 0);

  // If birthday hasn't occurred this year yet, last birthday was last year
  if (
    currentMonth < BIRTHDAY_MONTH ||
    (currentMonth === BIRTHDAY_MONTH && currentDay < BIRTHDAY_DAY)
  ) {
    lastBirthdayYear = currentYear - 1;
    lastBirthday.setFullYear(lastBirthdayYear);
  }

  // Calculate next birthday
  let nextBirthdayYear = currentYear;
  const nextBirthday = new Date(currentYear, BIRTHDAY_MONTH - 1, BIRTHDAY_DAY);
  nextBirthday.setHours(0, 0, 0, 0);

  // If birthday has already passed this year, next birthday is next year
  if (
    currentMonth > BIRTHDAY_MONTH ||
    (currentMonth === BIRTHDAY_MONTH && currentDay >= BIRTHDAY_DAY)
  ) {
    nextBirthdayYear = currentYear + 1;
    nextBirthday.setFullYear(nextBirthdayYear);
  }

  // Calculate days difference
  const daysSince = Math.floor((today.getTime() - lastBirthday.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntil = Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return { daysSince, daysUntil, lastBirthday, nextBirthday };
}

/**
 * Send daily birthday reminder via WhatsApp
 */
async function sendMessage(): Promise<{ success: boolean; message: string }> {
  if (!twilioClient) {
    return {
      success: false,
      message: "Twilio credentials not configured",
    };
  }

  if (!BIRTHDAY_TARGET_PHONE) {
    return {
      success: false,
      message: "Birthday target phone number not configured",
    };
  }

  if (!TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      message: "Twilio phone number not configured",
    };
  }

  if (!TWILIO_CONTENT_TEMPLATE_SID) {
    return {
      success: false,
      message: "Twilio Content Template SID not configured. Required for trial accounts.",
    };
  }

  const { daysSince, daysUntil } = calculateBirthdayDays();

  // Format days text
  const daysSinceText = `${daysSince} day${daysSince !== 1 ? "s" : ""}`;
  const daysUntilText = `${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;

  // Get unique birthday message for today
  const today = new Date();
  const dayOfYear = getDayOfYear(today);
  const uniqueBirthdayWish = getBirthdayMessage(dayOfYear);

  try {
    // Use WhatsApp Content Template (required for trial accounts)
    // Template variables: {{1}} = name, {{2}} = days since, {{3}} = days until, {{4}} = unique birthday wish
    const result = await twilioClient.messages.create({
      from: `whatsapp:${TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${BIRTHDAY_TARGET_PHONE}`,
      contentSid: TWILIO_CONTENT_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        1: BIRTHDAY_TARGET_NAME,
        2: daysSinceText,
        3: daysUntilText,
        4: uniqueBirthdayWish,
      }),
    });

    return {
      success: true,
      message: `Birthday WhatsApp message sent successfully to ${BIRTHDAY_TARGET_PHONE}. Message SID: ${result.sid}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error sending message: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Main function - Railway cron will execute this script daily at 12 AM
 */
async function main() {
  console.log(`[Daily Birthday Reminder] Sending message to ${BIRTHDAY_TARGET_NAME}...`);
  const today = new Date();
  console.log(`[Daily Birthday Reminder] Today: ${today.toISOString()}`);

  const { daysSince, daysUntil, lastBirthday, nextBirthday } = calculateBirthdayDays();
  console.log(`[Daily Birthday Reminder] Days since last birthday: ${daysSince}`);
  console.log(`[Daily Birthday Reminder] Days until next birthday: ${daysUntil}`);
  console.log(`[Daily Birthday Reminder] Last birthday: ${lastBirthday.toISOString()}`);
  console.log(`[Daily Birthday Reminder] Next birthday: ${nextBirthday.toISOString()}`);

  // Log the unique message being used
  const dayOfYear = getDayOfYear(today);
  console.log(`[Daily Birthday Reminder] Day of year: ${dayOfYear}`);
  console.log(`[Daily Birthday Reminder] Using unique message for day ${dayOfYear}`);

  const result = await sendMessage();

  if (result.success) {
    console.log(`[Daily Birthday Reminder] ✅ ${result.message}`);
    process.exit(0);
  } else {
    console.error(`[Daily Birthday Reminder] ❌ ${result.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error(`[Daily Birthday Reminder] Fatal error:`, error);
  process.exit(1);
});
