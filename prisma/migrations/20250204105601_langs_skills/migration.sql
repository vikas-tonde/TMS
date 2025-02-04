-- CreateTable
CREATE TABLE "Language" (
    "id" BIGSERIAL NOT NULL,
    "languageName" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" BIGSERIAL NOT NULL,
    "skillName" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkills" (
    "userId" BIGINT NOT NULL,
    "skillId" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "UserLanguages" (
    "userId" BIGINT NOT NULL,
    "languageId" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSkills_skillId_userId_key" ON "UserSkills"("skillId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLanguages_languageId_userId_key" ON "UserLanguages"("languageId", "userId");

-- AddForeignKey
ALTER TABLE "UserSkills" ADD CONSTRAINT "UserSkills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkills" ADD CONSTRAINT "UserSkills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLanguages" ADD CONSTRAINT "UserLanguages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLanguages" ADD CONSTRAINT "UserLanguages_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;
