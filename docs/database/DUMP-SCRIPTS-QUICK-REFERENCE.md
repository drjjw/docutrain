# Database Dump Scripts - Quick Reference

## 🚀 Quick Start

**Export entire database NOW:**
```bash
./scripts/dump-database-quick.sh
```

**List what's in your database:**
```bash
./scripts/dump-tables-list.sh
```

## 📋 All Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `dump-database-quick.sh` | Quick full dump | `./scripts/dump-database-quick.sh` |
| `dump-database.sh` | Interactive dump with options | `./scripts/dump-database.sh` |
| `dump-tables-list.sh` | Show all tables & row counts | `./scripts/dump-tables-list.sh` |
| `restore-database.sh` | Restore from dump | `./scripts/restore-database.sh` |
| `inspect-dump.sh` | View dump contents | `./scripts/inspect-dump.sh` |

## 📁 File Locations

- **Scripts**: `./scripts/`
- **Dumps**: `./database-dumps/`
- **Documentation**: `DATABASE-DUMP-GUIDE.md`

## 🎯 Common Tasks

### Backup before making changes
```bash
./scripts/dump-database-quick.sh
# Make your changes
# If needed: ./scripts/restore-database.sh
```

### Check what's in a dump file
```bash
./scripts/inspect-dump.sh
```

### Export specific format
```bash
./scripts/dump-database.sh
# Choose option 1-5
```

### See current database state
```bash
./scripts/dump-tables-list.sh
```

## 🔧 Manual Export (Advanced)

```bash
PROJECT_ID="mlxctdgnojvkgfqldaob"
DB_URL=$(supabase db dump --db-url --project-id "$PROJECT_ID" 2>&1 | grep "postgresql://")

# Full dump
pg_dump "$DB_URL" --no-owner --no-privileges --clean --if-exists -f backup.sql

# Schema only
pg_dump "$DB_URL" --schema-only -f schema.sql

# Specific tables
pg_dump "$DB_URL" -t documents -t embeddings -f tables.sql

# Export as CSV
psql "$DB_URL" -c "COPY documents TO STDOUT WITH CSV HEADER" > documents.csv
```

## ⚡ Pro Tips

1. **Quick backup before risky operations**: Always run `dump-database-quick.sh` first
2. **Inspect before restore**: Use `inspect-dump.sh` to verify dump contents
3. **Check database state**: Use `dump-tables-list.sh` to see current data
4. **Dumps are gitignored**: Safe to create many backups without cluttering repo

## 🆘 Troubleshooting

**"supabase: command not found"**
```bash
brew install supabase/tap/supabase
supabase login
```

**"pg_dump: command not found"**
```bash
brew install postgresql
```

**Scripts not executable?**
```bash
chmod +x scripts/dump-*.sh scripts/restore-*.sh scripts/inspect-*.sh
```

## 📊 Project Info

- **Project**: Manuals-Chat
- **ID**: `mlxctdgnojvkgfqldaob`
- **Region**: us-east-1
- **PostgreSQL**: 17.6.1

---

**See full documentation**: `DATABASE-DUMP-GUIDE.md`

