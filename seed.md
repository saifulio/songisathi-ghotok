# Seed accounts

Every login created by `npm run db:seed`. Passwords are plaintext **demo credentials** — they exist so the sample database can be signed into, and are stored as bcrypt hashes in `users.passwordHash`. Do not reuse any of them outside local development.

Sign in at `/signin` with **phone + password**. Regenerate this data at any time with:

```bash
npm run db:reset
```

Totals: 1 admin · 12 matchmakers · 11 guardians · 42 candidates (66 logins).

## Admin

Moderation queue at `/admin` — verifications, reports, payments.

| Name | Phone (username) | Password |
| --- | --- | --- |
| Farah Haque | `01700000001` | `admin123` |

## Matchmakers (ghotok)

Dashboard, interest inbox, search, add profile, biodata studio, AI matching, commission.

| Code | Name | Phone (username) | Password | District | Tier | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| GHT-0042 | Rahima Akter | `01712345678` | `ghotok123` | Sylhet | BUREAU | yes |
| GHT-0311 | Kamrul Islam | `01712000311` | `kamrul123` | Sylhet | BUREAU | yes |
| GHT-0198 | Nazma Begum | `01712000198` | `nazma123` | Mymensingh | SOLO | no |
| GHT-0402 | Monir Rahman | `01712000402` | `monir123` | Dhaka | SOLO | no |
| GHT-0155 | Shafiqul Alam | `01712000155` | `shafiq123` | Dhaka | AGENCY | yes |
| GHT-0287 | Rokeya Sultana | `01712000287` | `rokeya123` | Khulna | BUREAU | yes |
| GHT-0361 | Jashim Uddin | `01712000361` | `jashim123` | Chattogram | SOLO | yes |
| GHT-0501 | Sultana Parvin | `01720100001` | `demo123` | Dhaka | AGENCY | yes |
| GHT-0502 | Abdul Mannan | `01720100002` | `demo123` | Chattogram | BUREAU | yes |
| GHT-0503 | Ruhul Amin | `01720100003` | `demo123` | Sylhet | SOLO | yes |
| GHT-0504 | Ferdousi Begum | `01720100004` | `demo123` | Rajshahi | BUREAU | yes |
| GHT-0505 | Shamim Reza | `01720100005` | `demo123` | Khulna | SOLO | no |

## Guardians

Manage one profile on behalf of a relative: proposals, search, biodata studio, AI matching.

| Name | Phone (username) | Password | Relation | Manages |
| --- | --- | --- | --- | --- |
| Shirin Akter | `01811111111` | `guardian123` | Mother of Nusrat Jahan | PRN-31204 |
| Sanjida Haque | `01820200001` | `demo123` | Mother of Jannatul | PRN-50001 |
| Fahim Chowdhury | `01820200002` | `demo123` | Father of Mahfuz | PRN-50002 |
| Nabil Islam | `01820200003` | `demo123` | Elder brother of Jannatul | PRN-50003 |
| Mehjabin Chowdhury | `01820200004` | `demo123` | Elder sister of Hasib | PRN-50004 |
| Israt Islam | `01820200005` | `demo123` | Mother of Sanjida | PRN-50005 |
| Jubayer Mahmud | `01820200006` | `demo123` | Father of Nayeem | PRN-50006 |
| Sabbir Chowdhury | `01820200007` | `demo123` | Elder brother of Nowrin | PRN-50007 |
| Maliha Sultana | `01820200008` | `demo123` | Elder sister of Shakil | PRN-50008 |
| Sabina Nasrin | `01820200009` | `demo123` | Mother of Sabina | PRN-50009 |
| Fahim Mahmud | `01820200010` | `demo123` | Father of Mahfuz | PRN-50010 |

## Candidates — self-managed

Full access to their own profile: editable biodata studio, search with Send interest, AI matching. Rows marked DRAFT have not published yet (no PRN, not in the pool) — use one to try **Publish · make searchable**.

| Name | Phone (username) | Password | PRN | Status |
| --- | --- | --- | --- | --- |
| Tasnim Rahman | `01911222333` | `selfmanaged123` | PRN-31206 | ACTIVE |
| Sabbir Ahmed | `01920300001` | `demo123` | PRN-60001 | ACTIVE |
| Sharmin Begum | `01920300002` | `demo123` | PRN-60002 | ACTIVE |
| Mahfuz Ahmed | `01920300003` | `demo123` | PRN-60003 | ACTIVE |
| Mehjabin Parvin | `01920300004` | `demo123` | PRN-60004 | ACTIVE |
| Asif Rahman | `01920300005` | `demo123` | PRN-60005 | ACTIVE |
| Tasnia Akter | `01920300006` | `demo123` | PRN-60006 | ACTIVE |
| Zahid Bhuiyan | `01920300007` | `demo123` | PRN-60007 | ACTIVE |
| Jannatul Nasrin | `01920300008` | `demo123` | — | DRAFT |
| Ridwan Bhuiyan | `01920300009` | `demo123` | PRN-60009 | ACTIVE |
| Rubaiya Khatun | `01920300010` | `demo123` | PRN-60010 | ACTIVE |
| Nayeem Siddique | `01920300011` | `demo123` | PRN-60011 | ACTIVE |
| Sabina Chowdhury | `01920300012` | `demo123` | PRN-60012 | ACTIVE |
| Nayeem Hossain | `01920300013` | `demo123` | PRN-60013 | ACTIVE |
| Marufa Khatun | `01920300014` | `demo123` | PRN-60014 | ACTIVE |
| Nabil Sarker | `01920300015` | `demo123` | PRN-60015 | ACTIVE |
| Nadia Parvin | `01920300016` | `demo123` | PRN-60016 | ACTIVE |
| Tareq Islam | `01920300017` | `demo123` | PRN-60017 | ACTIVE |
| Maliha Nasrin | `01920300018` | `demo123` | — | DRAFT |
| Sohel Mahmud | `01920300019` | `demo123` | PRN-60019 | ACTIVE |
| Farzana Islam | `01920300020` | `demo123` | PRN-60020 | ACTIVE |
| Jubayer Karim | `01920300021` | `demo123` | PRN-60021 | ACTIVE |
| Nusaiba Khatun | `01920300022` | `demo123` | PRN-60022 | ACTIVE |
| Asif Ahmed | `01920300023` | `demo123` | PRN-60023 | ACTIVE |
| Tanzila Parvin | `01920300024` | `demo123` | PRN-60024 | ACTIVE |
| Nazmul Sarker | `01920300025` | `demo123` | PRN-60025 | ACTIVE |
| Sumona Akter | `01920300026` | `demo123` | PRN-60026 | ACTIVE |
| Rakib Sarker | `01920300027` | `demo123` | PRN-60027 | ACTIVE |
| Tanzila Akter | `01920300028` | `demo123` | — | DRAFT |
| Rakib Ahmed | `01920300029` | `demo123` | PRN-60029 | ACTIVE |
| Tahmina Sultana | `01920300030` | `demo123` | PRN-60030 | ACTIVE |
| Hasib Siddique | `01920300031` | `demo123` | PRN-60031 | ACTIVE |
| Israt Sultana | `01920300032` | `demo123` | PRN-60032 | ACTIVE |
| Mahin Islam | `01920300033` | `demo123` | PRN-60033 | ACTIVE |
| Tahmina Nasrin | `01920300034` | `demo123` | PRN-60034 | ACTIVE |
| Rakib Karim | `01920300035` | `demo123` | PRN-60035 | ACTIVE |
| Jannatul Akter | `01920300036` | `demo123` | PRN-60036 | ACTIVE |
| Arif Ahmed | `01920300037` | `demo123` | PRN-60037 | ACTIVE |
| Nowrin Sultana | `01920300038` | `demo123` | — | DRAFT |
| Asif Siddique | `01920300039` | `demo123` | PRN-60039 | ACTIVE |
| Tahmina Sultana | `01920300040` | `demo123` | PRN-60040 | ACTIVE |

## Candidates — managed by someone else

Read-only: they can browse the pool, read their own biodata, and see their AI matches, but their matchmaker or guardian edits the profile and sends interest.

| Name | Phone (username) | Password | PRN | Managed by |
| --- | --- | --- | --- | --- |
| Nusrat Jahan | `01911111111` | `candidate123` | PRN-10245 | matchmaker |

---

Profile-level sample data (which biodata sits in whose book, the seeded interests, commission ledger, and admin queues) is in [docs/SAMPLE-DATA.txt](docs/SAMPLE-DATA.txt).
