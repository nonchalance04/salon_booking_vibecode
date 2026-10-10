# Step-by-step TextBee setup and SMS testing

This guide covers the existing system at `/home/nonchalance/salonUI/salon_booking_vibecode`. It explains both appointment-access OTPs and automatic booking notifications. Commands below assume Bash/Linux and Node.js 24.

**Only the salon's Android gateway phone needs TextBee installed. Customers receive normal SMS messages.**

The delivery route is: booking system → TextBee API → salon Android phone/SIM → customer's Messages app.

## 1. Prepare two phones and a test environment

Have these ready:

- A salon Android gateway phone (Android 7 or newer), an active SIM capable of sending SMS, and internet access.
- A separate phone you control, used as the test customer's number. It needs no special app.
- A running PostgreSQL database and the existing salon system installed with its dependencies and booking configuration.
- Access to the backend environment file and a terminal.

Use a development/test database containing only test bookings and numbers you control. Starting the notification worker can also send previously queued SMS, so inspect outstanding jobs before enabling delivery against an existing database.

Check the gateway SIM can send a normal text to the test phone manually. SIM load or SMS-plan charges apply independently of TextBee's platform plan.

## 2. Connect the salon phone to TextBee

1. Create an account at [TextBee's dashboard](https://app.textbee.dev/) and verify your email.
2. Download the Android APK from [TextBee's official download page](https://textbee.dev/download) onto the salon phone and install it.
3. Open TextBee. Connect it using the dashboard QR code or an API key, then register the device.
4. Grant **Send SMS** permission. Allow other permissions needed for your selected functions.
5. Set battery use to **Unrestricted** so Android can keep the gateway running.
6. Keep the phone powered on, connected to the internet, and connected to its cellular network.
7. Copy the API key and the registered **device ID** from the dashboard/app. This system expects a 24-character hexadecimal device ID.

On newer Android versions, you may need to enable **Allow restricted settings** in the app's information screen before granting SMS permission. See the [official setup instructions](https://textbee.dev/docs/getting-started/setting-up-textbee).

Customers will see the gateway SIM's phone number as the sender.

## 3. Configure the backend

Open this existing file:

`/home/nonchalance/salonUI/salon_booking_vibecode/backend/.env`

Update existing entries rather than adding conflicting duplicates:

```dotenv
NODE_ENV=development
PORT=3000
HOST=127.0.0.1
TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

NOTIFICATION_SMS_PROVIDER=textbee
NOTIFICATION_SMS_POLICY=minimal
PUBLIC_SITE_URL=REPLACE_WITH_CUSTOMER_REACHABLE_FRONTEND_ORIGIN
APPOINTMENT_OTP_PROVIDER=textbee
TEXTBEE_API_KEY=REPLACE_WITH_YOUR_API_KEY
TEXTBEE_DEVICE_ID=REPLACE_WITH_YOUR_DEVICE_ID
APPOINTMENT_OTP_SECRET=REPLACE_WITH_A_SEPARATE_RANDOM_SECRET

NOTIFICATION_POLL_MS=5000
NOTIFICATION_REMINDER_HOURS=24
```

Set `PUBLIC_SITE_URL` to the origin your customer phone can reach, with no path, and add that exact origin to `TRUSTED_ORIGINS`. A phone cannot use your computer’s `localhost` address. A tunnel/deployed site must also forward `/api` and serve `/a` through the frontend.

Preserve the system's existing valid `DATABASE_URL`, `JWT_SECRET`, payment settings, and other configuration. If your running API uses a different port, retain that port and set the frontend proxy target accordingly in step 5.

Generate a separate OTP secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `APPOINTMENT_OTP_SECRET`. Keep API keys and secrets in the backend environment; do not place them in frontend code or commit them to Git.

The settings serve different purposes:

| Setting | Enables |
| --- | --- |
| `APPOINTMENT_OTP_PROVIDER=textbee` | SMS verification when a customer requests appointment access |
| `NOTIFICATION_SMS_PROVIDER=textbee` | Existing queued SMS messages, including payment/confirmation notices and reminders |

Enable both for this guide. You can enable either independently later.

## 4. Apply the migration and generate the database client

In a terminal:

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/backend
npm run db:migrate
npm run db:generate
npm run db:status
```

Expected: migrations apply successfully, the Prisma client is generated, and migration status shows the database is up to date.

The OTP migration adds temporary access tables; it does not rotate existing private booking links.

## 5. Start the system's processes

Use separate terminals and leave them running. If a process is already running, restart it instead of launching a second copy. API and workers must use the same backend environment/database.

**Terminal 1 — API:**

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/backend
npm run dev
```

**Terminal 2 — SMS notification worker:**

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/backend
npm run worker:notifications
```

Expected startup output includes `notification_worker_started` and `SMS` in `enabledChannels`. The worker polls about every five seconds with the settings above. It runs separately from the API.

**Terminal 3 — booking-hold/access cleanup worker:**

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/backend
npm run worker:holds
```

This handles hold expiration and periodic removal of expired access records. It is not the process that sends booking notifications.

**Terminal 4 — frontend:**

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/frontend
npm run dev
```

Open [the local salon site](http://127.0.0.1:5173). The frontend defaults to forwarding `/api` requests to port 3000. For a different backend port, start the frontend with `API_PROXY_TARGET=http://127.0.0.1:YOUR_PORT npm run dev`.

To check that OTP is enabled, open [the OTP options endpoint](http://127.0.0.1:5173/api/appointments/otp/options). Expected response: `{"available":true}`.

## 6. Test TextBee delivery directly

This sends one real SMS to your test phone, independently of appointment logic. Run it in the backend directory after replacing the recipient below with a number you control. Use international format, such as `+639171234567`.

```bash
cd /home/nonchalance/salonUI/salon_booking_vibecode/backend
node --env-file=.env --input-type=module <<'JS'
const recipient = '+63_REPLACE_WITH_YOUR_TEST_NUMBER';
if (!/^\+[1-9]\d{7,14}$/.test(recipient)) {
  throw new Error('Replace recipient with your test phone number in international format.');
}
const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
  method: 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(10000),
  headers: {
    'x-api-key': process.env.TEXTBEE_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceId: process.env.TEXTBEE_DEVICE_ID,
    recipients: [recipient],
    message: 'Salon SMS test: your TextBee gateway is working.',
  }),
});
const body = await response.json().catch(() => null);
console.log({
  httpStatus: response.status,
  accepted: body?.data?.success === true,
  smsBatchId: body?.data?.smsBatchId,
});
JS
```

Expected:

1. The API reports acceptance and a batch ID.
2. TextBee message history shows the message progressing through its delivery states.
3. The test phone receives the text from the salon SIM's number.

API acceptance means queued, not necessarily delivered. Check the receiving phone. See [TextBee's sending and response documentation](https://textbee.dev/docs/sending-sms/sending-sms).

## 7. Create a booking that will receive SMS notifications

1. Open the customer site and select an available appointment time.
2. Enter test customer details and the test phone number, for example `09171234567` or `+639171234567`.
3. **Leave the optional email field empty for this SMS notification test.**
4. Reserve the appointment and save its booking code and private link.

Expected: the appointment initially shows **Pending Payment**. Creating the temporary hold alone does not queue a booking-confirmed SMS in the current implementation.

**Current channel rule:** routine notifications use **email when an email address exists**, otherwise SMS. Disabling the email provider does not automatically reroute email jobs to SMS. OTP requests always use the recorded phone number, even when the booking has an email address.

## 8. Test automatic payment and confirmation SMS

1. Use the test booking from step 7 while its hold is active.
2. Complete the appointment-fee payment using your configured PayMongo sandbox flow.
3. Return to the booking tab and wait for automatic payment verification.
4. Confirm the appointment changes to **Confirmed**.
5. Check TextBee history and the test phone.

Expected: one combined SMS saying the fee was paid, confirming the appointment time, and providing a private management link. Open the link on the receiving phone: it should show the correct appointment without an OTP. The separate `PAYMENT_RECEIVED` job is retained as `SKIPPED`, and routine completion SMS is suppressed too. The worker normally picks them up within a poll interval, but gateway/carrier delivery can take longer.

If PayMongo is not configured, development can instead use the existing payment simulator. Set `PAYMENT_PROVIDER=test` and a separate random `PAYMENT_TEST_SECRET` in the development backend environment, restart the API, then choose **Open test payment → Simulate successful payment** on a new booking. This simulates payment only; TextBee still sends real SMS. The simulator is unavailable in production. Restore your previous payment settings and restart the API after the test.

A verified payment confirms the appointment independently of SMS delivery. A failed SMS does not undo payment or confirmation.

## 9. Test appointment-access OTP

1. Open [the appointment page](http://127.0.0.1:5173/appointment) in a private/incognito window without an existing appointment session.
2. Under **Find your appointment**, enter the booking code and its recorded phone number.
3. Click **Send verification code**.
4. Read the six-digit code on the test phone.
5. Enter it and click **Verify and view appointment** within five minutes.
6. Reload the page. The appointment should reopen using the two-hour session.
7. Click **Close appointment**. The appointment session should end.

The customer does not need to copy or save a private access token for this flow.

Check these additional cases, spacing requests to stay within the limits:

| Test | Expected result |
| --- | --- |
| Enter an incorrect code | Access denied; remaining guesses are limited |
| Wait more than five minutes before verifying | Code rejected as expired |
| Resend after the 60-second cooldown | New code issued; old challenge invalidated |
| Try the wrong phone number | Neutral response, no code sent to that number |
| Make repeated requests | Rate limit enforced; wait for its window to reset |

Limits are three code requests per phone and booking per 15 minutes, ten requests per IP per 15 minutes, and five guesses per challenge. Requests during cooldown also consume the request budget. Use separate test windows rather than trying every case in one burst.

OTP SMS is sent by the API directly. It can work even when the notification worker is stopped; booking confirmations and reminders require that worker.

## 10. Verify SMS reminders are suppressed

1. Confirm a test appointment inside the configured reminder window with a phone number and no email.
2. Keep the notification worker running with `NOTIFICATION_SMS_POLICY=minimal`.
3. Check the queue and receiving phone.

Expected: no new SMS reminder is queued. Old unsent SMS reminder jobs become `SKIPPED` without contacting TextBee. Confirmed customers with email can still receive email reminders through their configured email provider. Rescheduling and cancellation SMS remain available because those communicate changes to the booking.

## 11. Troubleshoot missing messages

| Symptom | Check |
| --- | --- |
| Direct TextBee test fails | Account email verification, API key, matching device ID, SMS permission, phone connectivity, SIM load and TextBee quota |
| Direct test works; OTP form is absent | `APPOINTMENT_OTP_PROVIDER=textbee`, API restart, and options endpoint returning `available: true` |
| OTP works; booking SMS never arrives | Notification worker running with SMS enabled, and booking's optional email field left empty |
| No SMS immediately after reserving | The booking is still a hold; confirmation SMS is triggered after verified fee payment |
| Booking notice is routed to email | This is the current channel-selection rule when customer email exists |
| Messages remain pending in TextBee | Gateway phone offline, app paused, or missing permission; review phone Activity and dashboard history |
| API reports invalid environment | Replace placeholders with a valid API key, 24-character hexadecimal device ID, and OTP secret of at least 32 characters |
| OTP is rejected | Wrong/latest code, expiry, exhausted guesses, or a resend that invalidated the previous challenge |
| OTP page says to wait | Cooldown/request budget reached; allow the applicable window to pass |
| API rejects browser requests | Frontend origin must exactly match `TRUSTED_ORIGINS`; confirm frontend API proxy target |
| No SMS reminder | Expected with minimal policy; the confirmation already includes the appointment time |
| Combined confirmation fails | Check `PUBLIC_SITE_URL`, trusted origins, and `lastError` for `BOOKING_LINK_NOT_CONFIGURED` or `SMS_LINK_TOO_LONG` |

If you have database read access, this query shows queue state without exposing message contents, phone numbers, or credentials:

```sql
SELECT "id", "eventType", "channel", "status", "attemptCount",
       "lastError", "scheduledAt", "sentAt"
FROM "NotificationQueue"
ORDER BY "createdAt" DESC
LIMIT 20;
```

`SKIPPED` rows were intentionally not sent. In minimal mode SMS failures are not automatically retried to avoid duplicate charges. `EMAIL` rows explain email routing. `PENDING` rows are waiting or scheduled for retry; `FAILED` rows need investigation. `SENT` means the system's provider call succeeded, not that the handset necessarily received the message. OTP requests do not appear in `NotificationQueue`; a failed OTP send logs `appointment_otp_send_failed` with only the challenge ID.

## 12. Finish the test and prepare deployment

Record whether direct SMS, payment/confirmation messages, OTP access, reload/logout, and reminders each passed. Restore any temporary payment/reminder settings. Shut down local test processes with Ctrl+C when finished.

For a deployed system, use the production backend environment, HTTPS and its exact trusted frontend origin. Run `npm run build` in both backend and frontend; the backend production commands are `npm start`, `npm run start:notifications`, and `npm run start:holds`. Run migrations against the intended deployment database and keep the workers managed alongside the API. Use your normal frontend hosting/reverse proxy to serve the built site and forward `/api`.

Keep the dedicated gateway phone charged and online, monitor its SMS allowance and TextBee quota, and repeat a controlled delivery test after phone/SIM or credential changes.

This guide describes how to perform live tests. Creating it did not send any SMS or change your environment configuration.
