// SkillMap — Neo4j schema initialization
// Run once on container start to establish uniqueness constraints and indexes.
// Safe to re-run: all statements use IF NOT EXISTS.

// Uniqueness constraints — prevent duplicate users by email and duplicate skills by name
CREATE CONSTRAINT user_email_unique IF NOT EXISTS
  FOR (u:User) REQUIRE u.email IS UNIQUE;

// googleId (Google OAuth sub claim) is the authoritative deduplication key for OAuth users.
// A unique constraint here makes duplicate creation impossible even under concurrent sign-ins.
CREATE CONSTRAINT user_googleid_unique IF NOT EXISTS
  FOR (u:User) REQUIRE u.googleId IS UNIQUE;

CREATE CONSTRAINT skill_name_unique IF NOT EXISTS
  FOR (s:Skill) REQUIRE s.name IS UNIQUE;

// Index on HAS_SKILL level for fast proficiency-based filtering
CREATE INDEX has_skill_level IF NOT EXISTS
  FOR ()-[r:HAS_SKILL]-() ON (r.level);
