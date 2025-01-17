-- CreateTable
CREATE TABLE "Training" (
    "id" BIGSERIAL NOT NULL,
    "trainingName" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModules" (
    "trainingId" BIGINT NOT NULL,
    "moduleId" INTEGER NOT NULL,

    CONSTRAINT "TrainingModules_pkey" PRIMARY KEY ("trainingId","moduleId")
);

-- CreateTable
CREATE TABLE "UserTraining" (
    "id" BIGSERIAL NOT NULL,
    "trainingId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserTraining_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrainingModules" ADD CONSTRAINT "TrainingModules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModules" ADD CONSTRAINT "TrainingModules_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
