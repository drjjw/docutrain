# Database Dump & Restore Guide

This guide covers exporting and importing your Supabase database for the Manuals-Chat project.

## Prerequisites

1. **Install Supabase CLI** (if not already installed):
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Install PostgreSQL tools** (pg_dump, psql, pg_restore):
   ```bash
   brew install postgresql
   ```

## Export Scripts

### Quick Export (Recommended)
Exports the entire database (schema + data) with no prompts:

```bash
./scripts/dump-database-quick.sh
```

**Output**: `database-dumps/full_dump_YYYYMMDD_HHMMSS.sql`

### Interactive Export
Choose what to export (schema, data, or both):

```bash
./scripts/dump-database.sh
```

Options:
1. Full dump (schema + data) - SQL format
2. Schema only
3. Data only
4. Full dump - Custom format (for pg_restore)
5. All of the above

## Restore Script

Restore from a previously created dump:

```bash
./scripts/restore-database.sh
```

The script will:
1. Show available dump files
2. Let you select which one to restore
3. Confirm before making changes
4. Restore to your database

## Manual Commands

### Export Manually

**Full database**:
```bash
PROJECT_ID="mlxctdgnojvkgfqldaob"
DB_URL=$(supabase db dump --db-url --project-id "$PROJECT_ID" 2>&1 | grep "postgresql://")
pg_dump "$DB_URL" --no-owner --no-privileges --clean --if-exists -f backup.sql
```

**Schema only**:
```bash
pg_dump "$DB_URL" --schema-only --no-owner --no-privileges -f schema.sql
```

**Data only**:
```bash
pg_dump "$DB_URL" --data-only --no-owner --no-privileges -f data.sql
```

**Specific tables**:
```bash
pg_dump "$DB_URL" --table=documents --table=embeddings -f specific_tables.sql
```

### Restore Manually

**From SQL dump**:
```bash
psql "$DB_URL" -f backup.sql
```

**From custom format**:
```bash
pg_restore --no-owner --no-privileges -d "$DB_URL" backup.dump
```

## Important Notes

### What's Included in Dumps

✅ **Included**:
- All tables and data
- Indexes
- Sequences
- Functions
- Triggers
- Views
- Types
- Schemas (public, extensions, etc.)

❌ **Not Included** (by design with `--no-owner --no-privileges`):
- Ownership information
- Role/privilege grants
- Connection parameters

### File Formats

**SQL Format** (`.sql`):
- Human-readable
- Can be edited
- Restore with `psql`
- Best for version control

**Custom Format** (`.dump`):
- Binary format
- Compressed
- Faster for large databases
- Restore with `pg_restore`
- Allows selective restore

## Common Use Cases

### 1. Regular Backups
```bash
# Add to crontab for daily backups
0 2 * * * cd /Users/jordanweinstein/GitHub/chat && ./scripts/dump-database-quick.sh
```

### 2. Before Major Changes
```bash
./scripts/dump-database-quick.sh
# Make your changes
# If something breaks, use restore-database.sh
```

### 3. Migrate to Another Project
```bash
# Export from source
./scripts/dump-database-quick.sh

# Update PROJECT_ID in restore-database.sh to target project
# Run restore
./scripts/restore-database.sh
```

### 4. Export Specific Data for Analysis
```bash
PROJECT_ID="mlxctdgnojvkgfqldaob"
DB_URL=$(supabase db dump --db-url --project-id "$PROJECT_ID" 2>&1 | grep "postgresql://")

# Export just documents table
pg_dump "$DB_URL" --table=documents --data-only -f documents_data.sql

# Export as CSV
psql "$DB_URL" -c "COPY documents TO STDOUT WITH CSV HEADER" > documents.csv
```

## Troubleshooting

### "supabase: command not found"
Install the Supabase CLI:
```bash
brew install supabase/tap/supabase
```

### "pg_dump: command not found"
Install PostgreSQL tools:
```bash
brew install postgresql
```

### "Could not get database URL"
Login to Supabase:
```bash
supabase login
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x scripts/dump-database.sh
chmod +x scripts/dump-database-quick.sh
chmod +x scripts/restore-database.sh
```

### Large Database Takes Long Time
Use custom format for compression:
```bash
pg_dump "$DB_URL" --format=custom -f backup.dump
```

## Storage & Management

### Dump Directory Structure
```
database-dumps/
├── full_dump_20251018_143022.sql
├── full_dump_20251018_143022.dump
├── schema_20251018_143022.sql
└── data_20251018_143022.sql
```

### Clean Old Backups
```bash
# Keep only last 10 dumps
cd database-dumps
ls -t *.sql | tail -n +11 | xargs rm -f
```

### Check Dump Size
```bash
du -h database-dumps/*.sql
```

## Project Information

- **Project Name**: Manuals-Chat
- **Project ID**: mlxctdgnojvkgfqldaob
- **Region**: us-east-1
- **PostgreSQL Version**: 17.6.1.021

## Related Documentation

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)

