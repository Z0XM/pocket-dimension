# Daily Birthday Reminder Service

A simple cron script that sends daily WhatsApp birthday reminders via Twilio. The message includes how many days have passed since the last birthday and how many days are left until the next birthday.

## Features

- ✅ Sends WhatsApp messages via Twilio
- ✅ Calculates days since last birthday
- ✅ Calculates days until next birthday
- ✅ Sends daily at 12 AM (configurable via Railway cron)
- ✅ Railway cron-ready script

## Setup

### 1. Get Twilio Credentials

1. Sign up at [https://www.twilio.com](https://www.twilio.com) (free trial with $5 credit)
2. Get your Account SID and Auth Token from the dashboard
3. Set up WhatsApp:
   - For testing: Enable WhatsApp Sandbox (free)
   - For production: Apply for WhatsApp Business API access

### 2. Configure Environment Variables in Railway

Add these environment variables to your Railway cron service:

```bash
# Birthday Configuration
BIRTHDAY_DAY=15          # Day of month (1-31)
BIRTHDAY_MONTH=6        # Month (1-12), e.g., 6 = June
BIRTHDAY_TARGET_PHONE=+1234567890  # Phone number with country code (E.164 format)
BIRTHDAY_TARGET_NAME=John Doe

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=whatsapp:+14155238886  # For sandbox, or your WhatsApp Business number
TWILIO_CONTENT_TEMPLATE_SID=your_content_template_sid  # Required for trial accounts
```

### 3. Phone Number Format

- Use E.164 format: `+1234567890` (country code + number)
- For WhatsApp Sandbox: Add the recipient number to your sandbox first
- For WhatsApp production: You need WhatsApp Business API approval

### 4. Set Up Railway Cron

1. Go to your Railway project dashboard
2. Add a new service → Select "Cron Job"
3. Set the **Root Directory** to: `apps/backend/reminder`
4. Configure the cron schedule:
   - Daily at 12 AM (midnight): `0 0 * * *`
   - Daily at 12:01 AM: `1 0 * * *`
   - Or any other time you prefer
5. Railway will automatically run `bun run start` which executes `src/index.ts`

The script will:
- Calculate days since last birthday
- Calculate days until next birthday
- Send a WhatsApp message with this information
- Exit with status 0 (success) or 1 (error)

## Message Format

The message sent daily uses a WhatsApp Content Template and will look like:

```
🎉 Happy Birthday [Name]! 🎂

📅 Days since your last birthday: X days
⏰ Days until your next birthday: Y days

[Unique daily birthday wish message]
```

**Note**: The message format is defined in your WhatsApp Content Template. The unique birthday wish (variable `{{4}}`) changes daily and includes:
- Fun, professional, Gen Z, and pop culture messages
- Festival messages on special dates (Republic Day, Independence Day, Teachers' Day, Gandhi Jayanti, etc.)
- Different styles rotated throughout the year

Make sure your template matches this structure with variables `{{1}}`, `{{2}}`, `{{3}}`, and `{{4}}` as described in the setup section.

## Testing Locally

1. Create a `.env` file in `apps/backend/reminder/`:
   ```bash
   BIRTHDAY_DAY=15
   BIRTHDAY_MONTH=6
   BIRTHDAY_TARGET_PHONE=+1234567890
   BIRTHDAY_TARGET_NAME=Test Friend
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=whatsapp:+14155238886
   TWILIO_CONTENT_TEMPLATE_SID=your_content_template_sid
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run the script:
   ```bash
   cd apps/backend/reminder
   bun run start
   ```

## WhatsApp Setup

### Creating a WhatsApp Content Template (Required for Trial Accounts)

**Important**: Trial accounts require using pre-approved message templates. Follow these steps:

1. Go to Twilio Console → Content → Templates
2. Click "Create Template" → Select "WhatsApp"
3. Create a template with the following structure:
   - **Template Name**: `birthday_reminder` (or any name you prefer)
   - **Category**: `UTILITY` (recommended) or `MARKETING`
   - **Language**: Select your language (e.g., `en`)
   - **Template Body**:
     ```
     🎉 Happy Birthday {{1}}! 🎂

     📅 Days since your last birthday: {{2}}
     ⏰ Days until your next birthday: {{3}}

     {{4}}

     Enjoy your year! 🎈
     ```

     **Important**: Variables cannot be at the start or end of the template. Make sure there's text before the first variable and after the last variable.
   - **Variables**: The template uses 4 variables:
     - `{{1}}` = Recipient's name
     - `{{2}}` = Days since last birthday (e.g., "365 days")
     - `{{3}}` = Days until next birthday (e.g., "0 days")
     - `{{4}}` = Unique birthday wish message (changes daily, includes festival messages on special dates)
4. Submit the template for approval (usually takes a few minutes to hours)
5. Once approved, copy the **Content SID** from the template details
6. Add it to your environment variables as `TWILIO_CONTENT_TEMPLATE_SID`

**Note**: For paid accounts, you can use free-form messages within the 24-hour customer service window, but templates are still recommended for reliability.

### WhatsApp Sandbox (Free for Testing)

1. Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Follow instructions to join the sandbox
3. Send "join [code]" to the sandbox number from your recipient's phone
4. Your `TWILIO_PHONE_NUMBER` will be `whatsapp:+14155238886` (Twilio's sandbox number)
5. **Important**: Recipients must be verified in your Twilio account for trial accounts

### WhatsApp Production

1. Apply for WhatsApp Business API access in Twilio
2. Get approved and configure your business profile
3. Use your approved WhatsApp Business number

## Railway Cron Schedule Examples

- Daily at 12 AM (midnight): `0 0 * * *`
- Daily at 12:01 AM: `1 0 * * *`
- Daily at 9 AM: `0 9 * * *`
- Every day at 8:30 AM: `30 8 * * *`

## How It Works

1. Railway cron executes the script daily at the configured time (recommended: 12 AM)
2. The script calculates:
   - Days since the last birthday (based on BIRTHDAY_DAY and BIRTHDAY_MONTH)
   - Days until the next birthday
3. Sends a WhatsApp message with this information
4. The script exits with appropriate status codes for Railway to track

## Customization

To customize the birthday message format:

1. **For Trial Accounts**: Edit your WhatsApp Content Template in Twilio Console → Content → Templates
2. **For Paid Accounts**: You can modify the template or switch to free-form messages (within 24-hour window) by editing `src/index.ts`

**Note**: The code uses WhatsApp Content Templates which are required for trial accounts. The template variables are:
- `{{1}}` = Recipient's name
- `{{2}}` = Days since last birthday
- `{{3}}` = Days until next birthday
- `{{4}}` = Unique birthday wish message (changes daily with 365 unique messages)
