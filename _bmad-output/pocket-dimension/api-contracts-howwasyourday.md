# API Contracts — howwasyourday

Day entries are saved via the **form action** on `/day/[dayInt]`, not REST.

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| POST | `/api/push/subscribe` | Required | Register subscription + timezone + reminder |
| POST | `/api/push/unsubscribe` | Required | Remove subscription |
| GET | `/api/push/status` | Required | Subscribed? + reminder time |
| PATCH | `/api/push/time` | Required | Update reminder `HH:MM` |

Scheduler: `src/lib/server/notification-scheduler.ts` (`node-cron` every minute, VAPID web-push).
