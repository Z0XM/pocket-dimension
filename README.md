# Pocket Dimension

A monorepo project built with Bun, Turbo, and TypeScript.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 22.12.0
- **Bun** 1.3.5 (or compatible version)
- **PostgreSQL** database (for local development)

## Installing Prerequisites on Ubuntu

### Install Node.js (>= 22.12.0)

#### Option 1: Using NodeSource Repository (Recommended)

```bash
# Update package index
sudo apt update

# Install required packages
sudo apt install -y ca-certificates curl gnupg

# Add NodeSource repository for Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### Option 2: Using nvm (Node Version Manager)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js 22.x
nvm install 22
nvm use 22

# Verify installation
node --version
npm --version
```

### Install Bun (1.3.5)

```bash
# Install Bun using the official installer
curl -fsSL https://bun.sh/install | bash

# Reload shell configuration
source ~/.bashrc

# Verify installation
bun --version
```

**Note**: If the above doesn't work, you can also install Bun using npm:

```bash
npm install -g bun@1.3.5
```

### Install PostgreSQL

```bash
# Update package index
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql

# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql

# Verify installation
psql --version
```

### Set Up PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create a new database (inside psql)
CREATE DATABASE pocket_dimension;

# Create a new user (optional, or use existing postgres user)
CREATE USER your_username WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pocket_dimension TO your_username;

# Exit psql
\q
```

**Note**: For local development, you can use the default `postgres` user. Update your `DATABASE_URL` in `.env` accordingly:
- With custom user: `postgresql://your_username:your_password@localhost:5432/pocket_dimension`
- With postgres user: `postgresql://postgres:postgres@localhost:5432/pocket_dimension`

### Verify All Installations

```bash
# Check Node.js version (should be >= 22.12.0)
node --version

# Check Bun version (should be 1.3.5 or compatible)
bun --version

# Check PostgreSQL version
psql --version

# Check if PostgreSQL is running
sudo systemctl status postgresql
```

## Project Structure

This is a monorepo containing:

- **Apps**:
  - `auth-service`: Elysia-based authentication service
  - `watchlist`: SvelteKit frontend application
  - `rhymes`: Astro frontend application

- **Shared Packages**:
  - `@pocket-dimension/auth`: Better Auth configuration
  - `@pocket-dimension/db`: Database schema and Drizzle ORM setup
  - `@pocket-dimension/utils`: Shared utilities

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pocket-dimension
```

### 2. Install Dependencies

Install all dependencies using Bun:

```bash
bun install
```

### 3. Set Up Environment Variables

Create a `.env` file in the required projects as needed. Follow the env.example of each project.

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pocket_dimension

# Auth Service
PORT=3001

# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_PATH=/api/auth
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:3003
BETTER_AUTH_COOKIE_DOMAIN=localhost

# Email (Resend)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@example.com

# Optional
NODE_ENV=development
```

**Note**: Replace placeholder values with your actual configuration. For local development:
- Set up a local PostgreSQL database and update `DATABASE_URL`
- Generate a secure random string for `BETTER_AUTH_SECRET`
- Get a Resend API key from [resend.com](https://resend.com) for email functionality

### 4. Set Up the Database

Run database migrations to set up the schema:

```bash
# Generate migrations (if needed)
bun run db:generate

# Run migrations
bun run db:migrate
```

### 5. Build Shared Packages

Build the shared packages that other apps depend on:

```bash
# Build all shared packages
bun run build:shared:auth
bun run build:shared:db
bun run build:shared:utils
```

Or build everything:

```bash
bun run build
```

## Running the Project

### Development Mode

#### Run All Apps

Start all applications in development mode:

```bash
bun run dev
```

#### Run Individual Apps

Run specific applications:

```bash
# Auth service
bun run dev:app:auth

# Watchlist app
bun run dev:app:watchlist

# Rhymes app
bun run dev:app:rhymes
```

### Production Mode

Build all packages and apps:

```bash
bun run build
```

Then start individual services as needed.

## Available Scripts

### Development
- `bun run dev` - Start all apps in development mode
- `bun run dev:app:auth` - Start auth service only
- `bun run dev:app:watchlist` - Start watchlist app only
- `bun run dev:app:rhymes` - Start rhymes app only

### Building
- `bun run build` - Build all packages and apps
- `bun run build:shared:auth` - Build auth shared package
- `bun run build:shared:db` - Build db shared package
- `bun run build:shared:utils` - Build utils shared package
- `bun run build:app:auth` - Build auth service
- `bun run build:app:watchlist` - Build watchlist app
- `bun run build:app:rhymes` - Build rhymes app

### Database
- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio (database GUI)

### Code Quality
- `bun run lint` - Lint all packages
- `bun run format` - Format code with Biome
- `bun run format:check` - Check code formatting
- `bun run check` - Run Biome checks
- `bun run typecheck` - Type check all packages

### Testing
- `bun run test` - Run all tests
- `bun run test:coverage` - Run tests with coverage

## Development Workflow

1. **Start the database**: Ensure PostgreSQL is running locally
2. **Set environment variables**: Create `.env` file` with required variables
3. **Run migrations**: `bun run db:migrate`
4. **Start development servers**: `bun run dev` or run individual apps
5. **Access applications** (ports are configurable via `PORT` env variable):
   - Auth Service: `http://localhost:3001` (configured via `PORT` env var)
     - Swagger API docs: `http://localhost:3001/swagger`
   - Watchlist: `http://localhost:3000` (default Vite port, configurable via `PORT` env var)
   - Rhymes: `http://localhost:3003` (configured in package.json)

## Database Management

### Drizzle Studio

Access the database GUI:

```bash
bun run db:studio
```

This opens Drizzle Studio in your browser where you can view and edit database records.

### Creating Migrations

After modifying database schemas in `shared/db/src/schema/`:

```bash
bun run db:generate
```

This generates migration files in `shared/db/migrations/`.

## Troubleshooting

### Port Already in Use

If you encounter port conflicts, check which ports are in use and update your environment variables or stop conflicting services.

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready` or check your PostgreSQL service
- Confirm `DATABASE_URL` is correct in your `.env` file
- Ensure the database exists: `createdb pocket_dimension` (if needed)

### Build Errors

- Ensure all dependencies are installed: `bun install`
- Build shared packages first before building apps
- Check for TypeScript errors: `bun run typecheck`

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Turbo
- **Language**: TypeScript
- **Backend**: Elysia
- **Frontend**: SvelteKit, Astro
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Linting/Formatting**: Biome
- **Testing**: Vitest

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and tests: `bun run lint && bun run test`
4. Format code: `bun run format`
5. Submit a pull request

## License

[Add your license information here]
