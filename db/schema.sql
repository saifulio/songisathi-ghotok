-- SongiSathi Ghotok — full MySQL schema (pure SQL, no Prisma).
-- Engine: MySQL / MariaDB.
--
-- Apply with:  npm run db:migrate      (runs db/migrate.mjs, which executes this file)
-- Reset  with: npm run db:reset         (drops every table, re-applies, then re-seeds)
--
-- Tables are created parents-first so the inline foreign keys resolve.
-- `updatedAt` columns use ON UPDATE CURRENT_TIMESTAMP so MySQL maintains them
-- (Prisma used to do this in application code).

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────── identity / auth ───────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
    `id`              INTEGER      NOT NULL AUTO_INCREMENT,
    `role`            ENUM('GHOTOK', 'GUARDIAN', 'CANDIDATE', 'ADMIN') NOT NULL,
    `fullName`        VARCHAR(191) NOT NULL,
    `phone`           VARCHAR(191) NOT NULL,
    `email`           VARCHAR(191) NULL,
    `passwordHash`    VARCHAR(191) NOT NULL,
    `isActive`        BOOLEAN      NOT NULL DEFAULT true,
    `emailVerifiedAt` DATETIME(3)  NULL,
    `createdAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_phone_key`(`phone`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ghotoks` (
    `id`                 INTEGER      NOT NULL AUTO_INCREMENT,
    `userId`             INTEGER      NOT NULL,
    `code`               VARCHAR(191) NOT NULL,
    `bureauName`         VARCHAR(191) NULL,
    `district`           VARCHAR(191) NOT NULL,
    `tier`               ENUM('SOLO', 'BUREAU', 'AGENCY') NOT NULL DEFAULT 'SOLO',
    `verified`           BOOLEAN      NOT NULL DEFAULT false,
    `marriagesClosed`    INTEGER      NOT NULL DEFAULT 0,
    `yearsActive`        INTEGER      NOT NULL DEFAULT 0,
    `activeProfileLimit` INTEGER      NOT NULL DEFAULT 20,
    -- What this matchmaker asks a family to pay for taking their profile on,
    -- in taka. Published in the directory a family searches, and copied onto a
    -- management request as the amount that was agreed when it was sent. 0
    -- means they have not published a figure — "ask them", not "free".
    `serviceFee`         INTEGER      NOT NULL DEFAULT 0,
    `referralCode`       VARCHAR(191) NULL,
    `memberSince`        INTEGER      NOT NULL,
    `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ghotoks_userId_key`(`userId`),
    UNIQUE INDEX `ghotoks_code_key`(`code`),
    UNIQUE INDEX `ghotoks_referralCode_key`(`referralCode`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ghotoks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `guardians` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT,
    `userId`      INTEGER      NOT NULL,
    `relation`    VARCHAR(191) NULL,
    `district`    VARCHAR(191) NULL,
    `selfManaged` BOOLEAN      NOT NULL DEFAULT false,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `guardians_userId_key`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `guardians_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
    `id`        INTEGER      NOT NULL AUTO_INCREMENT,
    `userId`    INTEGER      NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3)  NOT NULL,
    `usedAt`    DATETIME(3)  NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_tokenHash_key`(`tokenHash`),
    INDEX `email_verification_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id`        INTEGER      NOT NULL AUTO_INCREMENT,
    `userId`    INTEGER      NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3)  NOT NULL,
    `usedAt`    DATETIME(3)  NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_tokenHash_key`(`tokenHash`),
    INDEX `password_reset_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── biodata / profiles ───────────────────────────

CREATE TABLE IF NOT EXISTS `profiles` (
    `id`                  INTEGER      NOT NULL AUTO_INCREMENT,
    `prn`                 VARCHAR(191) NULL,
    `fullName`            VARCHAR(191) NOT NULL,
    `gender`              ENUM('MALE', 'FEMALE') NOT NULL,
    `dob`                 DATETIME(3)  NULL,
    `heightLabel`         VARCHAR(191) NULL,
    `maritalStatus`       VARCHAR(191) NOT NULL DEFAULT 'Never married',
    `district`            VARCHAR(191) NOT NULL,
    `area`                VARCHAR(191) NULL,
    `degree`              VARCHAR(191) NULL,
    `institution`         VARCHAR(191) NULL,
    `undergraduate`       VARCHAR(191) NULL,
    `profession`          VARCHAR(191) NULL,
    `organisation`        VARCHAR(191) NULL,
    `familyType`          ENUM('NUCLEAR', 'JOINT') NULL,
    `fatherInfo`          VARCHAR(191) NULL,
    `motherInfo`          VARCHAR(191) NULL,
    `siblings`            VARCHAR(191) NULL,
    `familyIncome`        VARCHAR(191) NULL,
    `religion`            VARCHAR(191) NULL,
    `religiousPractice`   VARCHAR(191) NULL,
    `verified`            BOOLEAN      NOT NULL DEFAULT false,
    `photoLocked`         BOOLEAN      NOT NULL DEFAULT true,
    `status`              ENUM('DRAFT', 'ACTIVE', 'IN_DISCUSSION', 'MATCH_IN_PROGRESS', 'MARRIED', 'AUTO_ARCHIVED', 'PAUSED') NOT NULL DEFAULT 'DRAFT',
    `inNetworkPool`       BOOLEAN      NOT NULL DEFAULT false,
    `completeness`        INTEGER      NOT NULL DEFAULT 0,
    `managerType`         ENUM('GHOTOK', 'GUARDIAN', 'SELF') NOT NULL,
    `managedByGhotokId`   INTEGER      NULL,
    `managedByGuardianId` INTEGER      NULL,
    `candidateUserId`     INTEGER      NULL,
    `lastUpdatedAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `profiles_prn_key`(`prn`),
    UNIQUE INDEX `profiles_candidateUserId_key`(`candidateUserId`),
    INDEX `profiles_managedByGhotokId_idx`(`managedByGhotokId`),
    INDEX `profiles_managedByGuardianId_idx`(`managedByGuardianId`),
    INDEX `profiles_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `profiles_managedByGhotokId_fkey`   FOREIGN KEY (`managedByGhotokId`)   REFERENCES `ghotoks`(`id`)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `profiles_managedByGuardianId_fkey` FOREIGN KEY (`managedByGuardianId`) REFERENCES `guardians`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `profiles_candidateUserId_fkey`     FOREIGN KEY (`candidateUserId`)     REFERENCES `users`(`id`)     ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `profile_preferences` (
    `id`        INTEGER      NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER      NOT NULL,
    `label`     VARCHAR(191) NOT NULL,
    `enabled`   BOOLEAN      NOT NULL DEFAULT true,

    INDEX `profile_preferences_profileId_idx`(`profileId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `profile_preferences_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── sealed screening layer ───────────────────────────

-- ─────────────────────────── the photo gallery ───────────────────────────
-- Several photographs per profile, uploaded by whoever manages it — the
-- candidate themselves, a guardian, or the ghotok whose book it sits in.
--
-- The image itself lives here, as a data URL in `data`: the deployment has no
-- object store and no writable upload directory, so the database is the one
-- place a row and its bytes stay together. That makes `data` expensive to
-- read, so nothing SELECTs it by accident — the list queries name their
-- columns and leave it out, and only the endpoints that actually hand an
-- image over ask for it.
--
-- Every upload waits: `status` starts PENDING and only its own manager (and
-- an admin) can see it until the moderation queue passes it. Whether an
-- approved photo is then public or held back is not decided here — that is
-- profiles.photoLocked, one switch over the whole gallery, unlocked for a
-- particular family by an accepted PHOTO_REQUEST in `interests`.
CREATE TABLE IF NOT EXISTS `profile_photos` (
    `id`               INTEGER      NOT NULL AUTO_INCREMENT,
    `profileId`        INTEGER      NOT NULL,
    -- Who put it there. A profile's manager can change; who uploaded cannot.
    `uploadedByUserId` INTEGER      NULL,
    `data`             LONGTEXT     NOT NULL,
    `mimeType`         VARCHAR(64)  NOT NULL,
    `byteSize`         INTEGER      NOT NULL DEFAULT 0,
    `status`           ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    -- What the moderator said, shown back to the manager on a rejection so a
    -- re-upload can fix the actual problem.
    `reviewNote`       VARCHAR(191) NULL,
    `reviewedAt`       DATETIME(3)  NULL,
    `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `profile_photos_profileId_idx`(`profileId`),
    INDEX `profile_photos_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `profile_photos_profileId_fkey`        FOREIGN KEY (`profileId`)        REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `profile_photos_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`)    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `screening_questions` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `code`       VARCHAR(191) NOT NULL,
    `sortOrder`  INTEGER      NOT NULL,
    `questionBn` TEXT         NOT NULL,
    `questionEn` TEXT         NOT NULL,
    `helpText`   TEXT         NULL,
    `type`       ENUM('CHOICE', 'TEXT') NOT NULL DEFAULT 'CHOICE',

    UNIQUE INDEX `screening_questions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `screening_options` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER      NOT NULL,
    `label`      VARCHAR(191) NOT NULL,
    `sortOrder`  INTEGER      NOT NULL DEFAULT 0,

    INDEX `screening_options_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `screening_options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `screening_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `screening_responses` (
    `id`             INTEGER     NOT NULL AUTO_INCREMENT,
    `profileId`      INTEGER     NOT NULL,
    `questionId`     INTEGER     NOT NULL,
    `answerValue`    TEXT        NOT NULL,
    `sealed`         BOOLEAN     NOT NULL DEFAULT false,
    `sealedAt`       DATETIME(3) NULL,
    `answeredByRole` ENUM('GUARDIAN', 'CANDIDATE', 'GHOTOK') NOT NULL DEFAULT 'GUARDIAN',
    `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `screening_responses_profileId_questionId_key`(`profileId`, `questionId`),
    INDEX `screening_responses_profileId_idx`(`profileId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `screening_responses_profileId_fkey`  FOREIGN KEY (`profileId`)  REFERENCES `profiles`(`id`)            ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `screening_responses_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `screening_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── AI matching ───────────────────────────

CREATE TABLE IF NOT EXISTS `match_suggestions` (
    `id`              INTEGER     NOT NULL AUTO_INCREMENT,
    `ghotokId`        INTEGER     NOT NULL,
    `weekOf`          DATETIME(3) NOT NULL,
    `profileAId`      INTEGER     NOT NULL,
    `profileBId`      INTEGER     NOT NULL,
    `score`           INTEGER     NOT NULL,
    `status`          ENUM('OPEN', 'ACCEPTED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `screeningPassed` BOOLEAN     NOT NULL DEFAULT true,
    `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `match_suggestions_ghotokId_idx`(`ghotokId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `match_suggestions_ghotokId_fkey`   FOREIGN KEY (`ghotokId`)   REFERENCES `ghotoks`(`id`)  ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT `match_suggestions_profileAId_fkey` FOREIGN KEY (`profileAId`) REFERENCES `profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `match_suggestions_profileBId_fkey` FOREIGN KEY (`profileBId`) REFERENCES `profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `match_factors` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT,
    `suggestionId` INTEGER      NOT NULL,
    `label`        VARCHAR(191) NOT NULL,
    `percentage`   INTEGER      NOT NULL,
    `note`         TEXT         NULL,

    INDEX `match_factors_suggestionId_idx`(`suggestionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `match_factors_suggestionId_fkey` FOREIGN KEY (`suggestionId`) REFERENCES `match_suggestions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── interest inbox ───────────────────────────

CREATE TABLE IF NOT EXISTS `interests` (
    `id`                 INTEGER      NOT NULL AUTO_INCREMENT,
    `kind`               ENUM('INTEREST', 'PHOTO_REQUEST', 'CONTACT_RELEASE') NOT NULL DEFAULT 'INTEREST',
    `fromGhotokId`       INTEGER      NULL,
    `fromGuardianId`     INTEGER      NULL,
    `fromLabel`          VARCHAR(191) NOT NULL,
    `theirProfileId`     INTEGER      NOT NULL,
    `yourProfileId`      INTEGER      NOT NULL,
    `status`             ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `message`            TEXT         NULL,
    `compatibilityScore` INTEGER      NULL,
    `screeningResult`    VARCHAR(191) NULL,
    `declineReason`      VARCHAR(191) NULL,
    `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `interests_yourProfileId_idx`(`yourProfileId`),
    INDEX `interests_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `interests_fromGhotokId_fkey`   FOREIGN KEY (`fromGhotokId`)   REFERENCES `ghotoks`(`id`)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `interests_fromGuardianId_fkey` FOREIGN KEY (`fromGuardianId`) REFERENCES `guardians`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `interests_theirProfileId_fkey` FOREIGN KEY (`theirProfileId`) REFERENCES `profiles`(`id`)  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `interests_yourProfileId_fkey`  FOREIGN KEY (`yourProfileId`)  REFERENCES `profiles`(`id`)  ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── hiring a matchmaker ───────────────────────────
-- A family asking a ghotok to take their profile on, for the fee that ghotok
-- publishes. The other direction from `interests`: this is about who manages a
-- profile, not about a match, so it is its own table rather than a fourth
-- interests.kind — the two rows share no columns beyond a status.
--
-- `feeAmount` is copied from ghotoks.serviceFee when the request is sent, so a
-- later change to the published price does not silently rewrite what both
-- sides agreed to. Accepting is what moves the profile into the ghotok's book;
-- the request row is the record of how it got there.
CREATE TABLE IF NOT EXISTS `management_requests` (
    `id`                INTEGER      NOT NULL AUTO_INCREMENT,
    `profileId`         INTEGER      NOT NULL,
    `ghotokId`          INTEGER      NOT NULL,
    -- Who sent it: the guardian or candidate account, not the profile — a
    -- profile's manager can change, and this is the record of who asked.
    `requestedByUserId` INTEGER      NOT NULL,
    `feeAmount`         INTEGER      NOT NULL DEFAULT 0,
    `status`            ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `message`           TEXT         NULL,
    `declineReason`     VARCHAR(191) NULL,
    `decidedAt`         DATETIME(3)  NULL,
    `createdAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `management_requests_profileId_idx`(`profileId`),
    INDEX `management_requests_ghotokId_idx`(`ghotokId`),
    INDEX `management_requests_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `management_requests_profileId_fkey`         FOREIGN KEY (`profileId`)         REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `management_requests_ghotokId_fkey`          FOREIGN KEY (`ghotokId`)          REFERENCES `ghotoks`(`id`)  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `management_requests_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`)    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── commission & closing ───────────────────────────

CREATE TABLE IF NOT EXISTS `marriages` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT,
    `ghotokId`       INTEGER      NOT NULL,
    `pairLabel`      VARCHAR(191) NOT NULL,
    `prns`           VARCHAR(191) NULL,
    `weddingDate`    DATETIME(3)  NOT NULL,
    `brideFee`       INTEGER      NOT NULL DEFAULT 0,
    `groomFee`       INTEGER      NOT NULL DEFAULT 0,
    `agreedAmount`   INTEGER      NOT NULL DEFAULT 0,
    `receivedAmount` INTEGER      NOT NULL DEFAULT 0,
    `status`         ENUM('PAID', 'PART_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marriages_ghotokId_idx`(`ghotokId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `marriages_ghotokId_fkey` FOREIGN KEY (`ghotokId`) REFERENCES `ghotoks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- One row per subscription payment, from either audience the platform bills:
-- a matchmaker upgrading their plan (ghotokId), or a family buying Premium on
-- their own account (userId). Exactly one of the two is set — the payer is
-- whoever the row names, and CHK_payments_payer is what keeps it to one.
-- Both are matched against the merchant statement by hand in the admin queue,
-- and confirming one is what grants the thing paid for.
CREATE TABLE IF NOT EXISTS `payments` (
    `id`            INTEGER      NOT NULL AUTO_INCREMENT,
    `ghotokId`      INTEGER      NULL,
    `userId`        INTEGER      NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `method`        ENUM('BKASH', 'NAGAD', 'ROCKET') NOT NULL,
    `amount`        INTEGER      NOT NULL,
    `tier`          ENUM('SOLO', 'BUREAU', 'AGENCY', 'PREMIUM') NOT NULL,
    `billing`       ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY',
    `status`        ENUM('PENDING', 'CONFIRMED', 'FLAGGED') NOT NULL DEFAULT 'PENDING',
    `paidAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payments_transactionId_key`(`transactionId`),
    INDEX `payments_ghotokId_idx`(`ghotokId`),
    INDEX `payments_userId_idx`(`userId`),
    INDEX `payments_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `payments_ghotokId_fkey` FOREIGN KEY (`ghotokId`) REFERENCES `ghotoks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `payments_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `users`(`id`)   ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `CHK_payments_payer` CHECK ((`ghotokId` IS NULL) <> (`userId` IS NULL))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- What a family's Premium subscription entitles them to, and until when.
-- No row means the free plan — that is the default every member account
-- starts on, so it is an absence rather than a row we have to write at signup.
-- `status` is set by the admin queue; `expiresAt` is what the API actually
-- reads, so a lapsed subscription falls back to free without a nightly job.
CREATE TABLE IF NOT EXISTS `member_subscriptions` (
    `id`         INTEGER     NOT NULL AUTO_INCREMENT,
    `userId`     INTEGER     NOT NULL,
    `tier`       ENUM('PREMIUM') NOT NULL DEFAULT 'PREMIUM',
    `billing`    ENUM('MONTHLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY',
    `status`     ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startedAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt`  DATETIME(3) NOT NULL,
    `paymentId`  INTEGER     NULL,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `member_subscriptions_userId_key`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `member_subscriptions_userId_fkey`    FOREIGN KEY (`userId`)    REFERENCES `users`(`id`)    ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `member_subscriptions_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The published price list, for both audiences. `audience` says whose plan a
-- row is: GHOTOK rows carry the matchmaker tiers (and their active-profile
-- limit), the MEMBER row is Premium for a family. profileLimit is 0 on a
-- member row — what Premium lifts is the monthly interest cap, not a book.
CREATE TABLE IF NOT EXISTS `pricing_tiers` (
    `id`           INTEGER      NOT NULL AUTO_INCREMENT,
    `audience`     ENUM('GHOTOK', 'MEMBER') NOT NULL DEFAULT 'GHOTOK',
    `code`         ENUM('SOLO', 'BUREAU', 'AGENCY', 'PREMIUM') NOT NULL,
    `nameEn`       VARCHAR(191) NOT NULL,
    `nameBn`       VARCHAR(191) NOT NULL,
    `monthlyPrice` INTEGER      NOT NULL,
    `annualPrice`  INTEGER      NOT NULL,
    `profileLimit` INTEGER      NOT NULL,

    UNIQUE INDEX `pricing_tiers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── admin / moderation ───────────────────────────

CREATE TABLE IF NOT EXISTS `verifications` (
    `id`        INTEGER     NOT NULL AUTO_INCREMENT,
    `ghotokId`  INTEGER     NOT NULL,
    `status`    ENUM('PENDING', 'APPROVED', 'MORE_INFO', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `note`      TEXT        NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `verifications_ghotokId_key`(`ghotokId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `verifications_ghotokId_fkey` FOREIGN KEY (`ghotokId`) REFERENCES `ghotoks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `verification_checks` (
    `id`             INTEGER      NOT NULL AUTO_INCREMENT,
    `verificationId` INTEGER      NOT NULL,
    `label`          VARCHAR(191) NOT NULL,
    `passed`         BOOLEAN      NOT NULL DEFAULT false,
    `note`           TEXT         NULL,

    INDEX `verification_checks_verificationId_idx`(`verificationId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `verification_checks_verificationId_fkey` FOREIGN KEY (`verificationId`) REFERENCES `verifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reports` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `title`      VARCHAR(191) NOT NULL,
    `subjectRef` VARCHAR(191) NOT NULL,
    `severity`   ENUM('SERIOUS', 'MODERATE', 'MINOR') NOT NULL,
    `reportedBy` VARCHAR(191) NOT NULL,
    `body`       TEXT         NOT NULL,
    `status`     ENUM('OPEN', 'SUSPENDED', 'WARNED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reports_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `report_evidence` (
    `id`       INTEGER      NOT NULL AUTO_INCREMENT,
    `reportId` INTEGER      NOT NULL,
    `text`     VARCHAR(191) NOT NULL,

    INDEX `report_evidence_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `report_evidence_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── misc ───────────────────────────

CREATE TABLE IF NOT EXISTS `testimonials` (
    `id`         INTEGER      NOT NULL AUTO_INCREMENT,
    `ghotokId`   INTEGER      NOT NULL,
    `quote`      TEXT         NOT NULL,
    `byLabel`    VARCHAR(191) NOT NULL,
    `monthLabel` VARCHAR(191) NULL,
    `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `testimonials_ghotokId_idx`(`ghotokId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `testimonials_ghotokId_fkey` FOREIGN KEY (`ghotokId`) REFERENCES `ghotoks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_log` (
    `id`         INTEGER     NOT NULL AUTO_INCREMENT,
    `ghotokId`   INTEGER     NULL,
    `profileId`  INTEGER     NULL,
    `text`       TEXT        NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_log_ghotokId_idx`(`ghotokId`),
    INDEX `activity_log_profileId_idx`(`profileId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `activity_log_ghotokId_fkey`  FOREIGN KEY (`ghotokId`)  REFERENCES `ghotoks`(`id`)  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `activity_log_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────── manager-to-manager messages ───────────────────────────
-- One conversation per matched pair, not per request: the two managers are
-- talking about the match, however many interests, photo requests, or release
-- requests passed between them. The pair is stored lowest id first, so the
-- unique index is what stops a second thread being opened the other way round.
--
-- There is no conversation between candidates, and none between a manager and
-- the other side's candidate. That is the product, not an omission — the
-- landing page sells it in as many words.

CREATE TABLE IF NOT EXISTS `conversations` (
    `id`          INTEGER     NOT NULL AUTO_INCREMENT,
    `profileAId`  INTEGER     NOT NULL,
    `profileBId`  INTEGER     NOT NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conversations_pair_key`(`profileAId`, `profileBId`),
    INDEX `conversations_profileBId_idx`(`profileBId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `conversations_profileAId_fkey` FOREIGN KEY (`profileAId`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `conversations_profileBId_fkey` FOREIGN KEY (`profileBId`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id`             INTEGER     NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER     NOT NULL,
    -- The user who wrote it. A profile's manager can change; who typed cannot.
    `senderUserId`   INTEGER     NOT NULL,
    `body`           TEXT        NOT NULL,
    `readAt`         DATETIME(3) NULL,
    `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `messages_senderUserId_fkey`   FOREIGN KEY (`senderUserId`)   REFERENCES `users`(`id`)         ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
