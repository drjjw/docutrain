# Database Dump Setup Guide

## Quick Setup (3 steps)

### 1. Add Database Password

Edit `supabase/.env.local` and add this line:
```bash
DB_PASSWORD=your_database_password_here
```

Get your password from: https://supabase.com/dashboard/project/mlxctdgnojvkgfqldaob/settings/database

### 2. Login to Supabase CLI

```bash
supabase login
```

### 3. Run Dump!

**For complete backup (schema + data in one file):**
```bash
./scripts/dump-complete.sh
```

**Or use the menu version:**
```bash
./scripts/dump-supabase-cli.sh
```

## Available Scripts

| Script | What it does |
|--------|-------------|
| `dump-complete.sh` | ⭐ **BEST** - Complete export (schema + data in ONE file, 224MB) |
| `dump-supabase-cli.sh` | Export with menu (choose schema/data/both) |
| `dump-database-quick.sh` | Alternative CLI approach |
| `dump-database.sh` | Interactive with options |
| `dump-tables-list.sh` | Show all tables & row counts |
| `restore-database.sh` | Restore from a dump |
| `inspect-dump.sh` | View dump contents |
| `setup-db-password.sh` | Interactive password setup |

## Recommended: Use Supabase CLI Dump

The `dump-supabase-cli.sh` script is tested and working:
- Uses Supabase CLI with automatic password
- Reads password from `supabase/.env.local`
- Handles authentication correctly
- Exports full schema and data

## Files & Locations

- **Password**: `supabase/.env.local` (gitignored ✓)
- **Dumps**: `database-dumps/` (gitignored ✓)
- **Scripts**: `scripts/`

## Project Info

- **Project**: Manuals-Chat
- **ID**: mlxctdgnojvkgfqldaob
- **Host**: db.mlxctdgnojvkgfqldaob.supabase.co
- **Port**: 5432
- **Database**: postgres
- **User**: postgres

## Example Workflow

```bash
# 1. Add password to supabase/.env.local
echo "DB_PASSWORD=your_password" > supabase/.env.local

# 2. Dump database
./scripts/dump-supabase-cli.sh

# 3. See what's in database
./scripts/dump-tables-list.sh

# 4. View a dump
./scripts/inspect-dump.sh

# 5. Restore if needed
./scripts/restore-database.sh
```

## Security Notes

- ✅ `supabase/.env.local` is gitignored
- ✅ `database-dumps/` is gitignored
- ✅ Password never exposed in logs
- ⚠️ Keep `.env.local` secure on your machine

## Troubleshooting

**"pg_dump: command not found"**
```bash
brew install postgresql
```

**"Password authentication failed"**
- Check password in `supabase/.env.local`
- Get fresh password from dashboard

**"Connection refused"**
- Check network/VPN connection
- Verify project is active in dashboard

## Manual Connection String

If you need to connect manually:
```bash
postgresql://postgres:YOUR_PASSWORD@db.mlxctdgnojvkgfqldaob.supabase.co:5432/postgres
```

