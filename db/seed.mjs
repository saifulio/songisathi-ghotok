// SongiSathi Ghotok — sample data seed (pure MySQL, no Prisma).
// Run with: npm run db:seed
// Passwords are hashed with bcrypt; the plaintext logins live in docs/SAMPLE-DATA.txt.

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { withTransaction, insert } from './pool.js';

const hash = (pw) => bcrypt.hashSync(pw, 10);
const dobFromAge = (age) => new Date(Date.UTC(2026 - age, 0, 1));

// Delete every table's rows, children first (FK-safe).
async function clearAll(tx) {
  const order = [
    'activity_log', 'testimonials', 'report_evidence', 'reports',
    'verification_checks', 'verifications', 'payments', 'marriages',
    'match_factors', 'match_suggestions', 'interests', 'screening_responses',
    'screening_options', 'screening_questions', 'profile_preferences',
    'profiles', 'guardians', 'ghotoks', 'pricing_tiers',
    'password_reset_tokens', 'email_verification_tokens', 'users',
  ];
  await tx.execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of order) await tx.execute(`DELETE FROM \`${t}\``);
  await tx.execute('SET FOREIGN_KEY_CHECKS = 1');
}

async function main() {
  await withTransaction(async (tx) => {
    console.log('Clearing existing data…');
    await clearAll(tx);

    // ── pricing tiers ──
    console.log('Seeding pricing tiers…');
    const tiers = [
      ['SOLO', 'Solo', 'একক ঘটক', 1200, 960, 20],
      ['BUREAU', 'Bureau', 'ব্যুরো', 2500, 2000, 50],
      ['AGENCY', 'Agency', 'এজেন্সি', 5000, 4000, 150],
    ];
    for (const t of tiers) {
      await insert(tx, 'INSERT INTO pricing_tiers (code, nameEn, nameBn, monthlyPrice, annualPrice, profileLimit) VALUES (?, ?, ?, ?, ?, ?)', t);
    }

    // ── screening questions (the sealed layer) ──
    console.log('Seeding screening questions…');
    const QS = [
      { code: 'q1', questionBn: 'বিয়ের পর কোথায় থাকার পরিকল্পনা?', questionEn: 'Where does the family expect the couple to live after marriage?', helpText: 'The single most common cause of a broken engagement.', type: 'CHOICE', options: ['With the groom’s family', 'Separate household', 'Either, to be decided together'] },
      { code: 'q2', questionBn: 'যৌতুক সম্পর্কে পরিবারের অবস্থান কী?', questionEn: 'What is the family’s position on dowry?', helpText: 'Dowry is illegal in Bangladesh. SongiSathi never matches a family that expects it with one that refuses it.', type: 'CHOICE', options: ['We neither give nor accept dowry', 'Gifts only, freely given', 'Prefer not to answer'] },
      { code: 'q3', questionBn: 'বিয়ের পর চাকরি চালিয়ে যাওয়া নিয়ে প্রত্যাশা?', questionEn: 'Expectation about continuing employment after marriage', helpText: 'Asked of both sides.', type: 'CHOICE', options: ['Should continue working', 'Should stop working', 'The couple decides'] },
      { code: 'q4', questionBn: 'ধর্মীয় অনুশীলনের মাত্রা?', questionEn: 'Level of religious practice in the household', helpText: null, type: 'CHOICE', options: ['Strictly practising', 'Moderately practising', 'Culturally observant'] },
      { code: 'q5', questionBn: 'আগের বিবাহ বা সন্তান আছে এমন পাত্র/পাত্রী বিবেচনা করবেন?', questionEn: 'Would the family consider a candidate with a prior marriage or children?', helpText: null, type: 'CHOICE', options: ['Yes, without reservation', 'Yes, if there are no children', 'No'] },
      { code: 'q6', questionBn: 'অন্য পরিবারের আগে থেকে জানা উচিত এমন কোনো স্বাস্থ্য বিষয়?', questionEn: 'Any health matter the other family should know before proceeding?', helpText: 'Compared by the system only, never displayed. Leave blank if there is nothing to disclose.', type: 'TEXT', options: [] },
    ];
    const questionIdByCode = {};
    for (let i = 0; i < QS.length; i++) {
      const q = QS[i];
      const questionId = await insert(
        tx,
        'INSERT INTO screening_questions (code, sortOrder, questionBn, questionEn, helpText, type) VALUES (?, ?, ?, ?, ?, ?)',
        [q.code, i + 1, q.questionBn, q.questionEn, q.helpText, q.type]
      );
      questionIdByCode[q.code] = questionId;
      for (let j = 0; j < q.options.length; j++) {
        await insert(tx, 'INSERT INTO screening_options (questionId, label, sortOrder) VALUES (?, ?, ?)', [questionId, q.options[j], j + 1]);
      }
    }

    // ── users + ghotoks ──
    console.log('Seeding users, ghotoks, guardians…');
    const ghotokDefs = [
      { code: 'GHT-0042', name: 'Rahima Akter', phone: '01712345678', pw: 'ghotok123', bureauName: 'Rahima Marriage Bureau', district: 'Sylhet', tier: 'BUREAU', verified: true, marriagesClosed: 27, yearsActive: 22, activeProfileLimit: 50, referralCode: 'RAHIMA-SYL', memberSince: 2003 },
      { code: 'GHT-0311', name: 'Kamrul Islam', phone: '01712000311', pw: 'kamrul123', bureauName: 'Sylhet Bureau', district: 'Sylhet', tier: 'BUREAU', verified: true, marriagesClosed: 19, yearsActive: 6, activeProfileLimit: 50, referralCode: 'KAMRUL-SYL', memberSince: 2024 },
      { code: 'GHT-0198', name: 'Nazma Begum', phone: '01712000198', pw: 'nazma123', bureauName: null, district: 'Mymensingh', tier: 'SOLO', verified: false, marriagesClosed: 8, yearsActive: 3, activeProfileLimit: 20, referralCode: 'NAZMA-MYM', memberSince: 2025 },
      { code: 'GHT-0402', name: 'Monir Rahman', phone: '01712000402', pw: 'monir123', bureauName: null, district: 'Dhaka', tier: 'SOLO', verified: false, marriagesClosed: 0, yearsActive: 1, activeProfileLimit: 20, referralCode: 'MONIR-DHK', memberSince: 2026 },
      { code: 'GHT-0155', name: 'Shafiqul Alam', phone: '01712000155', pw: 'shafiq123', bureauName: 'Alam Agency', district: 'Dhaka', tier: 'AGENCY', verified: true, marriagesClosed: 41, yearsActive: 12, activeProfileLimit: 150, referralCode: 'SHAFIQ-DHK', memberSince: 2018 },
      { code: 'GHT-0287', name: 'Rokeya Sultana', phone: '01712000287', pw: 'rokeya123', bureauName: null, district: 'Khulna', tier: 'BUREAU', verified: true, marriagesClosed: 14, yearsActive: 5, activeProfileLimit: 50, referralCode: 'ROKEYA-KHL', memberSince: 2021 },
      { code: 'GHT-0361', name: 'Jashim Uddin', phone: '01712000361', pw: 'jashim123', bureauName: null, district: 'Chattogram', tier: 'SOLO', verified: true, marriagesClosed: 9, yearsActive: 4, activeProfileLimit: 20, referralCode: 'JASHIM-CTG', memberSince: 2022 },
    ];
    const ghotokIdByCode = {};
    for (const g of ghotokDefs) {
      const userId = await insert(
        tx,
        'INSERT INTO users (role, fullName, phone, passwordHash, email) VALUES (?, ?, ?, ?, ?)',
        ['GHOTOK', g.name, g.phone, hash(g.pw), `${g.code.toLowerCase()}@songisathi.test`]
      );
      const ghotokId = await insert(
        tx,
        `INSERT INTO ghotoks (userId, code, bureauName, district, tier, verified, marriagesClosed, yearsActive, activeProfileLimit, referralCode, memberSince)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, g.code, g.bureauName, g.district, g.tier, g.verified, g.marriagesClosed, g.yearsActive, g.activeProfileLimit, g.referralCode, g.memberSince]
      );
      ghotokIdByCode[g.code] = ghotokId;
    }

    // admin
    await insert(tx, 'INSERT INTO users (role, fullName, phone, passwordHash, email) VALUES (?, ?, ?, ?, ?)',
      ['ADMIN', 'Farah Haque', '01700000001', hash('admin123'), 'farah@songisathi.test']);

    // guardian (Shirin Akter — mother of Nusrat Jahan, self-managed family)
    const shirinUserId = await insert(tx, 'INSERT INTO users (role, fullName, phone, passwordHash, email) VALUES (?, ?, ?, ?, ?)',
      ['GUARDIAN', 'Shirin Akter', '01811111111', hash('guardian123'), 'shirin@songisathi.test']);
    const shirinId = await insert(tx, 'INSERT INTO guardians (userId, relation, district, selfManaged) VALUES (?, ?, ?, ?)',
      [shirinUserId, 'Mother of Nusrat Jahan', 'Dhaka', true]);

    // candidate login (Nusrat Jahan)
    const nusratUserId = await insert(tx, 'INSERT INTO users (role, fullName, phone, passwordHash, email) VALUES (?, ?, ?, ?, ?)',
      ['CANDIDATE', 'Nusrat Jahan', '01911111111', hash('candidate123'), 'nusrat@songisathi.test']);

    // ── profiles (biodata) ──
    console.log('Seeding profiles…');
    const R = ghotokIdByCode['GHT-0042']; // Rahima
    const K = ghotokIdByCode['GHT-0311']; // Kamrul
    const profileDefs = [
      { prn: 'PRN-10245', name: 'Nusrat Jahan', gender: 'FEMALE', age: 26, height: '5′4″', degree: 'MBA', institution: 'IBA, University of Dhaka', undergraduate: 'BBA, University of Dhaka', profession: 'Banker', organisation: 'A private commercial bank', district: 'Dhaka', area: 'Dhanmondi', familyType: 'NUCLEAR', fatherInfo: 'Retired, government service', motherInfo: 'Homemaker', siblings: 'One younger brother, undergraduate student', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'ACTIVE', verified: true, locked: false, pool: true, completeness: 92, ghotokId: R, candidateUserId: nusratUserId },
      { prn: 'PRN-10188', name: 'Tanvir Ahmed', gender: 'MALE', age: 31, height: '5′9″', degree: 'MSc Computer Science', institution: 'BUET', profession: 'Software engineer', organisation: 'Settled in Auckland', district: 'Sylhet', area: 'Auckland (settled)', familyType: 'NUCLEAR', fatherInfo: 'Retired teacher', siblings: 'One sister, married', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'IN_DISCUSSION', verified: true, locked: false, pool: true, completeness: 88, ghotokId: R },
      { prn: 'PRN-10302', name: 'Sadia Islam', gender: 'FEMALE', age: 24, height: '5′2″', degree: 'BSc Pharmacy', institution: 'SUST', profession: 'Pharmacist', district: 'Sylhet', area: 'Zindabazar', familyType: 'JOINT', religion: 'Islam — Sunni', practice: 'Strictly practising', status: 'MATCH_IN_PROGRESS', verified: false, locked: true, pool: false, completeness: 74, ghotokId: R },
      { prn: 'PRN-10077', name: 'Rezaul Karim', gender: 'MALE', age: 29, height: '5′11″', degree: 'LLB', institution: 'Chittagong University', profession: 'Advocate', district: 'Chattogram', area: 'Khulshi', familyType: 'JOINT', religion: 'Islam — Sunni', practice: 'Strictly practising', status: 'ACTIVE', verified: true, locked: false, pool: true, completeness: 90, ghotokId: R },
      { prn: 'PRN-10411', name: 'Farhana Akter', gender: 'FEMALE', age: 27, height: '5′3″', degree: 'BBA', institution: 'North South University', profession: 'HR executive', district: 'Dhaka', area: 'Uttara', familyType: 'NUCLEAR', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'MARRIED', verified: true, locked: false, pool: false, completeness: 95, ghotokId: R },
      { prn: 'PRN-10015', name: 'Mahmudul Hasan', gender: 'MALE', age: 34, height: '5′8″', degree: 'MBBS', institution: 'Rajshahi Medical College', profession: 'Doctor', district: 'Rajshahi', area: 'Boalia', familyType: 'NUCLEAR', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'ACTIVE', verified: true, locked: false, pool: true, completeness: 91, ghotokId: R },
      { prn: 'PRN-10466', name: 'Ayesha Siddika', gender: 'FEMALE', age: 23, height: '5′1″', degree: 'Honours in Bangla', institution: 'Mymensingh', profession: 'Student', district: 'Mymensingh', area: 'Mymensingh Sadar', familyType: 'JOINT', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'AUTO_ARCHIVED', verified: false, locked: true, pool: false, completeness: 61, ghotokId: R },
      { prn: 'PRN-10233', name: 'Imran Chowdhury', gender: 'MALE', age: 30, height: '5′10″', degree: 'MEng', institution: 'University of Toronto', profession: 'Civil engineer', district: 'Chattogram', area: 'Toronto (settled)', familyType: 'NUCLEAR', religion: 'Islam — Sunni', practice: 'Culturally observant', status: 'IN_DISCUSSION', verified: true, locked: false, pool: true, completeness: 87, ghotokId: R },
      { prn: 'PRN-20881', name: 'Sumaiya Haque', gender: 'FEMALE', age: 24, height: '5′2″', degree: 'BSc Pharmacy', institution: 'SUST', profession: 'Pharmacist', district: 'Sylhet', area: 'Zindabazar', familyType: 'JOINT', religion: 'Islam — Sunni', practice: 'Strictly practising', status: 'ACTIVE', verified: true, locked: true, pool: true, completeness: 89, ghotokId: K },
      { prn: 'PRN-24410', name: 'Rifat Jahan', gender: 'FEMALE', age: 29, height: '5′5″', degree: 'MSc Economics', institution: 'University of Dhaka', profession: 'Research associate', district: 'Chattogram', area: 'Khulshi', familyType: 'NUCLEAR', religion: 'Islam — Sunni', practice: 'Moderately practising', status: 'ACTIVE', verified: true, locked: true, pool: true, completeness: 90, ghotokId: K },
      { prn: 'PRN-31204', name: 'Farhana Akter', gender: 'FEMALE', age: 27, height: '5′3″', degree: 'BBA', institution: 'North South University', profession: 'HR executive', district: 'Dhaka', area: 'Uttara', familyType: 'NUCLEAR', religion: 'Islam — Sunni', practice: 'Culturally observant', status: 'ACTIVE', verified: false, locked: true, pool: true, completeness: 70, guardianId: shirinId },
    ];
    const profileIdByPrn = {};
    for (const p of profileDefs) {
      const profileId = await insert(
        tx,
        `INSERT INTO profiles
          (prn, fullName, gender, dob, heightLabel, maritalStatus, district, area, degree, institution,
           undergraduate, profession, organisation, familyType, fatherInfo, motherInfo, siblings,
           religion, religiousPractice, verified, photoLocked, status, inNetworkPool, completeness,
           managerType, managedByGhotokId, managedByGuardianId, candidateUserId)
         VALUES (?, ?, ?, ?, ?, 'Never married', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.prn, p.name, p.gender, dobFromAge(p.age), p.height, p.district, p.area ?? null, p.degree,
          p.institution ?? null, p.undergraduate ?? null, p.profession, p.organisation ?? null,
          p.familyType ?? null, p.fatherInfo ?? null, p.motherInfo ?? null, p.siblings ?? null,
          p.religion, p.practice, p.verified, p.locked, p.status, p.pool, p.completeness,
          p.guardianId ? 'GUARDIAN' : 'GHOTOK', p.ghotokId ?? null, p.guardianId ?? null, p.candidateUserId ?? null,
        ]
      );
      profileIdByPrn[p.prn] = profileId;
    }

    // ── profile preferences (Nusrat) ──
    const nusratPrefs = [
      ['Postgraduate degree', true], ['Within 4 years of age', true], ['Same district', true],
      ['Settled abroad', false], ['Government service', false],
    ];
    for (const [label, enabled] of nusratPrefs) {
      await insert(tx, 'INSERT INTO profile_preferences (profileId, label, enabled) VALUES (?, ?, ?)',
        [profileIdByPrn['PRN-10245'], label, enabled]);
    }

    // ── sealed screening responses (Nusrat + Tanvir) ──
    console.log('Seeding sealed screening responses…');
    const nusratAnswers = { q1: 'Either, to be decided together', q2: 'We neither give nor accept dowry', q3: 'Should continue working', q4: 'Moderately practising', q5: 'Yes, if there are no children', q6: '' };
    const tanvirAnswers = { q1: 'Separate household', q2: 'We neither give nor accept dowry', q3: 'Should continue working', q4: 'Moderately practising', q5: 'Yes, without reservation', q6: '' };
    const sealedAt = new Date(Date.UTC(2026, 7, 8));
    for (const [prn, answers, role] of [['PRN-10245', nusratAnswers, 'GUARDIAN'], ['PRN-10188', tanvirAnswers, 'GHOTOK']]) {
      for (const code of Object.keys(answers)) {
        await insert(
          tx,
          'INSERT INTO screening_responses (profileId, questionId, answerValue, sealed, sealedAt, answeredByRole) VALUES (?, ?, ?, ?, ?, ?)',
          [profileIdByPrn[prn], questionIdByCode[code], answers[code], true, sealedAt, role]
        );
      }
    }

    // ── AI match suggestions (Rahima's Monday run) ──
    console.log('Seeding match suggestions…');
    const week = new Date(Date.UTC(2026, 7, 4));
    const sugs = [
      { a: 'PRN-10245', b: 'PRN-10188', score: 87, factors: [['Education', 94, 'Both postgraduate, business + technical'], ['Family type', 88, 'Nuclear, both fathers retired service'], ['Location', 79, 'Dhaka family, Auckland-settled groom'], ['Lifestyle', 85, 'Similar practice level, both non-smoking']] },
      { a: 'PRN-10302', b: 'PRN-10077', score: 81, factors: [['Education', 83, 'Professional degrees on both sides'], ['Family type', 90, 'Joint family, both Sylhet-rooted'], ['Location', 72, 'Sylhet and Chattogram — travel expected'], ['Lifestyle', 80, 'Age gap of five years, both agreed']] },
      { a: 'PRN-10466', b: 'PRN-10233', score: 74, factors: [['Education', 68, 'Honours vs. postgraduate'], ['Family type', 82, 'Both nuclear, elder-led decisions'], ['Location', 64, 'Mymensingh family, Toronto-settled groom'], ['Lifestyle', 81, 'Both open to settling abroad']] },
    ];
    for (const s of sugs) {
      const suggestionId = await insert(
        tx,
        'INSERT INTO match_suggestions (ghotokId, weekOf, profileAId, profileBId, score, status, screeningPassed) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [R, week, profileIdByPrn[s.a], profileIdByPrn[s.b], s.score, 'OPEN', true]
      );
      for (const [label, percentage, note] of s.factors) {
        await insert(tx, 'INSERT INTO match_factors (suggestionId, label, percentage, note) VALUES (?, ?, ?, ?)', [suggestionId, label, percentage, note]);
      }
    }

    // ── interest inbox (routed to Rahima's candidates) ──
    console.log('Seeding interests…');
    const interests = [
      { kind: 'INTEREST', fromGhotokId: K, fromGuardianId: null, fromLabel: 'Kamrul Islam · GHT-0311, Sylhet bureau', their: 'PRN-20881', your: 'PRN-10188', status: 'PENDING', compatibilityScore: 84, screeningResult: 'Compatible', message: 'Assalamu alaikum, Rahima apa. Sumaiya’s family has read Tanvir’s biodata carefully and would like to proceed. Her father would like to speak with the guardian first.' },
      { kind: 'PHOTO_REQUEST', fromGhotokId: ghotokIdByCode['GHT-0198'], fromGuardianId: null, fromLabel: 'Nazma Begum · GHT-0198, Mymensingh', their: 'PRN-31204', your: 'PRN-10077', status: 'PENDING', compatibilityScore: 71, screeningResult: 'Compatible', message: 'Apa, the family has asked to see a photograph before taking this further. Only the guardian will see it, and only for this proposal.' },
      { kind: 'INTEREST', fromGhotokId: null, fromGuardianId: shirinId, fromLabel: 'Guardian — Shirin Akter · self-managed family', their: 'PRN-31204', your: 'PRN-10233', status: 'PENDING', compatibilityScore: 66, screeningResult: 'Compatible', message: 'We came across Imran’s biodata through the network. Our daughter is in service and intends to continue after marriage — we wanted to say so plainly at the start.' },
      { kind: 'CONTACT_RELEASE', fromGhotokId: K, fromGuardianId: null, fromLabel: 'Kamrul Islam · GHT-0311, Sylhet bureau', their: 'PRN-24410', your: 'PRN-10015', status: 'ACCEPTED', compatibilityScore: 88, screeningResult: 'Compatible', message: 'Both families have met once. They would like to exchange numbers now and continue on their own. I have released our side; awaiting yours.' },
    ];
    for (const it of interests) {
      await insert(
        tx,
        `INSERT INTO interests (kind, fromGhotokId, fromGuardianId, fromLabel, theirProfileId, yourProfileId, status, compatibilityScore, screeningResult, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [it.kind, it.fromGhotokId, it.fromGuardianId, it.fromLabel, profileIdByPrn[it.their], profileIdByPrn[it.your], it.status, it.compatibilityScore, it.screeningResult, it.message]
      );
    }

    // ── commission ledger (Rahima) ──
    console.log('Seeding marriages / commission ledger…');
    const marriages = [
      ['Farhana Akter ↔ Sabbir Rahman', 'PRN-31204 · PRN-10914', new Date(Date.UTC(2026, 7, 5)), 25000, 15000, 40000, 40000, 'PAID'],
      ['Sumaiya Haque ↔ Arif Mahmud', 'PRN-20881 · PRN-10662', new Date(Date.UTC(2026, 6, 28)), 18000, 12000, 30000, 15000, 'PART_PAID'],
      ['Rifat Jahan ↔ Nayeem Uddin', 'PRN-24410 · PRN-10233', new Date(Date.UTC(2026, 6, 19)), 15000, 10000, 25000, 0, 'UNPAID'],
      ['Ayesha Siddika ↔ Rezaul Karim', 'PRN-19077 · PRN-10077', new Date(Date.UTC(2026, 6, 2)), 20000, 15000, 35000, 35000, 'PAID'],
      ['Marium Khatun ↔ Jahid Hasan', 'PRN-18220 · PRN-10488', new Date(Date.UTC(2026, 5, 14)), 12000, 8000, 20000, 20000, 'PAID'],
    ];
    for (const m of marriages) {
      await insert(tx, 'INSERT INTO marriages (ghotokId, pairLabel, prns, weddingDate, brideFee, groomFee, agreedAmount, receivedAmount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [R, ...m]);
    }

    // ── platform subscription payments (admin match queue) ──
    console.log('Seeding payments…');
    const payments = [
      [ghotokIdByCode['GHT-0311'], 'BKS8H2K91M', 'BKASH', 2000, 'BUREAU', 'PENDING'],
      [ghotokIdByCode['GHT-0198'], 'NGD4472PLQ', 'NAGAD', 960, 'SOLO', 'PENDING'],
      [ghotokIdByCode['GHT-0155'], 'BKS1120XZT', 'BKASH', 4000, 'AGENCY', 'PENDING'],
      [ghotokIdByCode['GHT-0287'], 'BKS9910AAB', 'BKASH', 2000, 'BUREAU', 'PENDING'],
      [ghotokIdByCode['GHT-0361'], 'RKT5567MNO', 'ROCKET', 960, 'SOLO', 'PENDING'],
    ];
    for (const p of payments) {
      await insert(tx, 'INSERT INTO payments (ghotokId, transactionId, method, amount, tier, status) VALUES (?, ?, ?, ?, ?, ?)', p);
    }

    // ── verification queue (admin) ──
    console.log('Seeding verifications…');
    const vDefs = [
      { code: 'GHT-0311', status: 'APPROVED', note: 'Two verified ghotoks in Sylhet vouched. Register photographs go back to 2019.', checks: [['NID', true, 'Front and back legible, name matches'], ['Photograph', true, 'Clear, recent, face visible'], ['Phone', true, 'Verified by OTP, not seen before'], ['Referrals', true, 'Two verified ghotoks vouched']] },
      { code: 'GHT-0198', status: 'PENDING', note: 'NID readable but the photograph is a tightly cropped group photo. Ask for a plain one before issuing the seal.', checks: [['NID', true, 'Legible, name matches'], ['Photograph', false, 'Cropped from a group photo'], ['Phone', true, 'Verified by OTP'], ['Referrals', false, 'None yet — first in her district']] },
      { code: 'GHT-0402', status: 'PENDING', note: 'Phone number was on a suspended account in June. Same NID, different name spelling. Do not approve without a call.', checks: [['NID', false, 'Name spelling differs from application'], ['Photograph', true, 'Clear and recent'], ['Phone', false, 'Previously on a suspended account'], ['Referrals', false, 'None']] },
    ];
    for (const v of vDefs) {
      const verificationId = await insert(tx, 'INSERT INTO verifications (ghotokId, status, note) VALUES (?, ?, ?)', [ghotokIdByCode[v.code], v.status, v.note]);
      for (const [label, passed, note] of v.checks) {
        await insert(tx, 'INSERT INTO verification_checks (verificationId, label, passed, note) VALUES (?, ?, ?, ?)', [verificationId, label, passed, note]);
      }
    }

    // ── reports (moderation) ──
    console.log('Seeding reports…');
    const rDefs = [
      { title: 'Contact details shared outside the platform', subjectRef: 'GHT-0402', severity: 'SERIOUS', reportedBy: 'A guardian in Uttara', body: 'The guardian says this ghotok passed her daughter’s phone number to another family before any interest was accepted. She has the WhatsApp message.', evidence: ['Screenshot supplied', 'No release logged on the profile', 'Second report this month'] },
      { title: 'Profile appears to be duplicated', subjectRef: 'PRN-31204', severity: 'MODERATE', reportedBy: 'Automatic check', body: 'The same name, date of birth and district appear under two managers. Likely a genuine handover rather than fraud.', evidence: ['Matching DOB and district', 'Different phone numbers', 'Both created in the last month'] },
      { title: 'Photograph does not match the biodata', subjectRef: 'PRN-10466', severity: 'MINOR', reportedBy: 'A ghotok in Sylhet', body: 'A released photograph appears to be of a different person than described. May simply be an old photograph.', evidence: ['Released once, to one family', 'Manager verified in 2025'] },
    ];
    for (const r of rDefs) {
      const reportId = await insert(tx, 'INSERT INTO reports (title, subjectRef, severity, reportedBy, body, status) VALUES (?, ?, ?, ?, ?, ?)', [r.title, r.subjectRef, r.severity, r.reportedBy, r.body, 'OPEN']);
      for (const text of r.evidence) {
        await insert(tx, 'INSERT INTO report_evidence (reportId, text) VALUES (?, ?)', [reportId, text]);
      }
    }

    // ── testimonials (Rahima) ──
    const testimonials = [
      [R, 'She did not push us once. When we said no to three proposals she simply said, then we wait.', 'Guardian of PRN-31204', 'July 2026'],
      [R, 'The questions were asked before we ever met them. That saved my daughter a great deal.', 'Guardian of PRN-18220', 'June 2026'],
    ];
    for (const t of testimonials) {
      await insert(tx, 'INSERT INTO testimonials (ghotokId, quote, byLabel, monthLabel) VALUES (?, ?, ?, ?)', t);
    }

    // ── activity log (Nusrat's profile) ──
    const nusratProfileId = profileIdByPrn['PRN-10245'];
    const activity = [
      [R, nusratProfileId, 'Rahima Akter passed you a proposal from Kamrul Islam'],
      [R, nusratProfileId, 'Photo access requested for one proposal'],
      [null, nusratProfileId, 'Private answers sealed'],
      [R, nusratProfileId, 'Profile confirmed active for another 90 days'],
    ];
    for (const a of activity) {
      await insert(tx, 'INSERT INTO activity_log (ghotokId, profileId, text) VALUES (?, ?, ?)', a);
    }
  });

  // ── summary ──
  const tablesToCount = ['users', 'ghotoks', 'guardians', 'profiles', 'match_suggestions', 'interests', 'marriages', 'payments', 'reports', 'verifications'];
  const counts = {};
  for (const t of tablesToCount) {
    const [rows] = await pool.execute(`SELECT COUNT(*) AS n FROM \`${t}\``);
    counts[t] = rows[0].n;
  }
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
