import { Migration } from '@mikro-orm/migrations'

/**
 * Migracja referencyjna. W praktyce wygeneruj ją narzędziem frameworka:
 *   yarn mercato db:generate --module client-relations
 * i porównaj z tym plikiem — schemat powinien być identyczny.
 */
export class Migration20260703InitClientRelations extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "pg_client_groups" (
        "id" uuid primary key default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "name" text not null,
        "status" text not null default 'inactive',
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null
      );
    `)
    this.addSql(`create index if not exists "pg_client_groups_org_tenant_idx" on "pg_client_groups" ("organization_id", "tenant_id");`)
    this.addSql(`create index if not exists "pg_client_groups_status_idx" on "pg_client_groups" ("tenant_id", "organization_id", "status");`)

    this.addSql(`
      create table if not exists "pg_nps_responses" (
        "id" uuid primary key default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "company_id" uuid not null,
        "score" int not null check ("score" between 0 and 10),
        "comment" text null,
        "respondent_name" text null,
        "submitted_at" timestamptz not null,
        "created_at" timestamptz not null default now()
      );
    `)
    this.addSql(`create index if not exists "pg_nps_org_tenant_company_idx" on "pg_nps_responses" ("organization_id", "tenant_id", "company_id");`)
    this.addSql(`create index if not exists "pg_nps_submitted_idx" on "pg_nps_responses" ("tenant_id", "submitted_at");`)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "pg_nps_responses";`)
    this.addSql(`drop table if exists "pg_client_groups";`)
  }
}
