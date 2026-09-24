# Nexora Backend — Database & Migrations Guide

This directory contains the FastAPI backend application for Nexora.

## Database Migrations (Alembic)

Nexora uses **Alembic** for schema migrations and versioning. Schema creation and updates in production must only be executed via Alembic migrations.

### Environment Variable
Ensure `DATABASE_URL` is configured in your `.env` file or deployment environment:
```bash
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
```

### Common Migration Commands

- **Apply all pending migrations to latest version:**
  ```bash
  alembic upgrade head
  ```

- **Inspect current migration revision:**
  ```bash
  alembic current
  ```

- **View migration history:**
  ```bash
  alembic history
  ```

- **Create a new migration revision after model changes:**
  ```bash
  alembic revision --autogenerate -m "describe_changes"
  ```

- **Rollback the most recent migration:**
  ```bash
  alembic downgrade -1
  ```

> **IMPORTANT**: Never manually alter database tables or constraints directly in production. All schema modifications must go through reviewed Alembic migration scripts.

---

## Local Development Seed Data

To populate sample users, projects, and initial tasks for local testing:
```bash
python seed.py
```
*Note: Automatic database seeding is strictly disabled on production application startup.*
