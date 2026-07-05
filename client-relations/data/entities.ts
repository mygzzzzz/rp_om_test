import { OptionalProps } from '@mikro-orm/core'
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

export type ClientGroupStatus = 'active' | 'inactive'

/**
 * Grupa Klientów — "Centrum relacji biznesowych".
 * Jedno ID dla całej grupy deweloperskiej (spółka główna + N spółek celowych).
 * Spółki celowe/inwestycje = natywne customer companies, powiązane przez
 * custom field `client_group_id` na customer_company_profile (patrz ce.ts).
 */
@Entity({ tableName: 'pg_client_groups' })
@Index({ name: 'pg_client_groups_org_tenant_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'pg_client_groups_status_idx', properties: ['tenantId', 'organizationId', 'status'] })
export class ClientGroup {
  [OptionalProps]?: 'status' | 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  /** Nadrzędny status portfelowy: active = klient płacący, inactive = do pozyskania/reaktywacji */
  @Property({ type: 'text', default: 'inactive' })
  status: ClientGroupStatus = 'inactive'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/**
 * Odpowiedź NPS klienta (dewelopera) — Faza 1: dane symulowane / wgrywane seedem.
 * Docelowo zasilane webhookiem z narzędzia ankietowego (Faza 2).
 * companyId -> natywne customer_entities(kind='company').id
 */
@Entity({ tableName: 'pg_nps_responses' })
@Index({ name: 'pg_nps_org_tenant_company_idx', properties: ['organizationId', 'tenantId', 'companyId'] })
@Index({ name: 'pg_nps_submitted_idx', properties: ['tenantId', 'submittedAt'] })
export class NpsResponse {
  [OptionalProps]?: 'createdAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  /** FK logiczne do customer_entities (company). Bez twardego FK — encja żyje w innym module. */
  @Property({ name: 'company_id', type: 'uuid' })
  companyId!: string

  /** 0–10, walidacja w API (zod) */
  @Property({ type: 'int' })
  score!: number

  @Property({ type: 'text', nullable: true })
  comment?: string | null

  @Property({ name: 'respondent_name', type: 'text', nullable: true })
  respondentName?: string | null

  @Property({ name: 'submitted_at', type: Date })
  submittedAt!: Date

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
