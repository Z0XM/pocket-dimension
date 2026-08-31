# Source Tree — `@pocket-dimension/db`

```
shared/db/
├── package.json
├── drizzle.config.ts
├── .env.example
├── migrations/              # SQL + meta/_journal.json
├── src/
│   ├── index.ts             # export { db, schema }
│   ├── lib/
│   │   ├── db.ts            # lazy Proxy client
│   │   └── env.ts           # lazy DATABASE_URL
│   └── schema/
│       ├── index.ts         # merge
│       ├── common.ts        # id, timestamps, actionsByUser
│       ├── auth.ts
│       ├── watchlist.ts
│       ├── howwasyourday.ts
│       ├── chhanchhan.ts
│       ├── meviayou.ts
│       └── zeo.ts
└── dist/
```
