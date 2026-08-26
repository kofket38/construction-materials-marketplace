// ── Visibility type mirrors the Prisma enum ───────────────────────────────────
export type ProfileVisibility = "PUBLIC" | "PRIVATE";

// ── Credential type mirrors the Prisma enum ──────────────────────────────────
export type CredentialType =
  | "EDUCATION"
  | "CERTIFICATION"
  | "TRAINING"
  | "AWARD"
  | "OTHER";

// ── Child entities ────────────────────────────────────────────────────────────

export interface ProfessionalSpecialtyEntity {
  id: string;
  profileId: string;
  name: string;
  createdAt: Date;
}

export interface ProfessionalCredentialEntity {
  id: string;
  profileId: string;
  type: CredentialType;
  title: string;
  institution: string | null;
  yearObtained: number | null;
  description: string | null;
  credentialUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioItemEntity {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  projectType: string | null;
  location: string | null;
  completionDate: Date | null;
  images: string[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Profile entity (always includes child relations) ─────────────────────────

export interface ProfessionalProfileEntity {
  id: string;
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  profession: string | null;
  yearsExperience: number | null;
  company: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedinUrl: string | null;
  visibility: ProfileVisibility;
  specialties: ProfessionalSpecialtyEntity[];
  credentials: ProfessionalCredentialEntity[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateProfessionalProfileInput {
  userId: string;
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  profession?: string | null;
  yearsExperience?: number | null;
  company?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  visibility?: ProfileVisibility;
}

export interface UpdateProfessionalProfileInput {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  profession?: string | null;
  yearsExperience?: number | null;
  company?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  visibility?: ProfileVisibility;
}

export interface CreateCredentialInput {
  type?: CredentialType;
  title: string;
  institution?: string | null;
  yearObtained?: number | null;
  description?: string | null;
  credentialUrl?: string | null;
}

export interface UpdateCredentialInput {
  type?: CredentialType;
  title?: string;
  institution?: string | null;
  yearObtained?: number | null;
  description?: string | null;
  credentialUrl?: string | null;
}

export interface CreatePortfolioItemInput {
  title: string;
  description?: string | null;
  projectType?: string | null;
  location?: string | null;
  completionDate?: Date | null;
  images?: string[];
  displayOrder?: number;
}

export interface UpdatePortfolioItemInput {
  title?: string;
  description?: string | null;
  projectType?: string | null;
  location?: string | null;
  completionDate?: Date | null;
  images?: string[];
  displayOrder?: number;
}

// ── Directory (public discovery) ──────────────────────────────────────────────

export type ProfessionalDirectorySortBy =
  | "newest"
  | "oldest"
  | "experience"
  | "name";

export type ProfessionalDirectorySortOrder = "asc" | "desc";

export interface ProfessionalDirectoryQuery {
  page: number;
  limit: number;
  search?: string;
  profession?: string;
  specialty?: string;
  city?: string;
  sortBy: ProfessionalDirectorySortBy;
  sortOrder: ProfessionalDirectorySortOrder;
}

/** Lightweight card shape — deliberately excludes bio, credentials, and
 * contact details, which remain the responsibility of the detail endpoint. */
export interface ProfessionalDirectoryItem {
  id: string;
  displayName: string;
  headline: string | null;
  profession: string | null;
  yearsExperience: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  avatarUrl: string | null;
  specialties: string[];
}

export interface ProfessionalDirectoryResult {
  professionals: ProfessionalDirectoryItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Repository interface ──────────────────────────────────────────────────────

export interface ProfessionalProfileRepository {
  /**
   * Search PUBLISHED (visibility = PUBLIC) profiles for the public directory.
   * The PUBLIC filter is applied at the database query level so PRIVATE
   * profiles can never leak through any filter combination. Returns a
   * lightweight card representation plus standard pagination metadata.
   */
  searchPublished(
    query: ProfessionalDirectoryQuery,
  ): Promise<ProfessionalDirectoryResult>;

  /**
   * Find a profile by the owning user's ID, including all specialties and
   * credentials. Returns null when no profile exists for the user.
   */
  findByUserId(userId: string): Promise<ProfessionalProfileEntity | null>;

  /**
   * Find a profile by its own primary key, including all specialties and
   * credentials. Returns null when the profile does not exist.
   */
  findById(profileId: string): Promise<ProfessionalProfileEntity | null>;

  /**
   * Create a new professional profile for a user.
   * Throws DuplicateProfessionalProfileError when the user already has one.
   */
  create(
    input: CreateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity>;

  /**
   * Partially update a profile's scalar fields. Returns null when the profile
   * does not exist.
   */
  update(
    profileId: string,
    input: UpdateProfessionalProfileInput,
  ): Promise<ProfessionalProfileEntity | null>;

  /**
   * Delete a profile and all its child records (cascade). Returns true when
   * the profile was found and deleted, false when it did not exist.
   */
  delete(profileId: string): Promise<boolean>;

  /**
   * Atomically replace all specialties for a profile with the supplied list.
   * Duplicate names in the supplied list are silently deduplicated.
   * Returns the updated profile.
   */
  replaceSpecialties(
    profileId: string,
    names: string[],
  ): Promise<ProfessionalProfileEntity | null>;

  /**
   * Add a credential to a profile. Returns the updated profile.
   */
  addCredential(
    profileId: string,
    input: CreateCredentialInput,
  ): Promise<ProfessionalProfileEntity | null>;

  /**
   * Update a credential by its ID. Returns null when the credential does not
   * exist.
   */
  updateCredential(
    credentialId: string,
    input: UpdateCredentialInput,
  ): Promise<ProfessionalCredentialEntity | null>;

  /**
   * Delete a credential by its ID. Returns true when deleted, false when not
   * found.
   */
  deleteCredential(credentialId: string): Promise<boolean>;

  /**
   * Count the portfolio items that belong to a profile.
   */
  countPortfolioItems(profileId: string): Promise<number>;

  /**
   * List the portfolio items of a profile in display order:
   * displayOrder ascending, then newest first, with the item ID as the
   * deterministic tie-breaker.
   */
  findPortfolioItems(profileId: string): Promise<PortfolioItemEntity[]>;

  /**
   * Create a portfolio item on a profile. The caller must verify that the
   * profile exists before calling.
   */
  createPortfolioItem(
    profileId: string,
    input: CreatePortfolioItemInput,
  ): Promise<PortfolioItemEntity>;

  /**
   * Partially update a portfolio item. The update is scoped to the supplied
   * profile, so an item belonging to another profile is reported as missing
   * rather than being modified. Returns null when no matching item exists.
   */
  updatePortfolioItem(
    profileId: string,
    itemId: string,
    input: UpdatePortfolioItemInput,
  ): Promise<PortfolioItemEntity | null>;

  /**
   * Delete a portfolio item. The delete is scoped to the supplied profile,
   * so an item belonging to another profile cannot be deleted through this
   * method. Returns true when deleted, false when not found.
   */
  deletePortfolioItem(profileId: string, itemId: string): Promise<boolean>;
}
