-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('EDUCATION', 'CERTIFICATION', 'TRAINING', 'AWARD', 'OTHER');

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "headline" VARCHAR(300),
    "bio" VARCHAR(2000),
    "avatarUrl" VARCHAR(500),
    "profession" VARCHAR(200),
    "yearsExperience" INTEGER,
    "company" VARCHAR(200),
    "city" VARCHAR(100),
    "region" VARCHAR(100),
    "country" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "website" VARCHAR(500),
    "linkedinUrl" VARCHAR(500),
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "type" "CredentialType" NOT NULL DEFAULT 'EDUCATION',
    "title" VARCHAR(300) NOT NULL,
    "institution" VARCHAR(300),
    "yearObtained" INTEGER,
    "description" VARCHAR(1000),
    "credentialUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_userId_key" ON "professional_profiles"("userId");

-- CreateIndex
CREATE INDEX "professional_profiles_userId_idx" ON "professional_profiles"("userId");

-- CreateIndex
CREATE INDEX "professional_profiles_visibility_idx" ON "professional_profiles"("visibility");

-- CreateIndex
CREATE INDEX "professional_profiles_city_idx" ON "professional_profiles"("city");

-- CreateIndex
CREATE INDEX "professional_profiles_profession_idx" ON "professional_profiles"("profession");

-- CreateIndex
CREATE UNIQUE INDEX "professional_specialties_profileId_name_key" ON "professional_specialties"("profileId", "name");

-- CreateIndex
CREATE INDEX "professional_specialties_profileId_idx" ON "professional_specialties"("profileId");

-- CreateIndex
CREATE INDEX "professional_credentials_profileId_idx" ON "professional_credentials"("profileId");

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_specialties" ADD CONSTRAINT "professional_specialties_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_credentials" ADD CONSTRAINT "professional_credentials_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
