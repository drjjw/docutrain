-- ============================================================================
-- Complete RLS Policy Restoration Script
-- Generated: 2025-11-11T22:23:38.205Z
-- Source: backups/supabase_backup_latest/schema/policies/
-- Total Policies: 73
-- ============================================================================
--
-- WARNING: This script will DROP all existing policies and recreate them
-- from backup files. Use with caution!
--
-- ============================================================================
-- STEP 1: Drop all existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all quiz generation logs" ON "public"."document_processing_logs";
DROP POLICY IF EXISTS "Admins can view all training history" ON "public"."document_training_history";
DROP POLICY IF EXISTS "Admins grant access" ON "public"."user_owner_access";
DROP POLICY IF EXISTS "Admins revoke access" ON "public"."user_owner_access";
DROP POLICY IF EXISTS "Allow anon reads" ON "public"."chat_conversations";
DROP POLICY IF EXISTS "Allow anonymous inserts" ON "public"."chat_conversations";
DROP POLICY IF EXISTS "Allow anonymous read access" ON "public"."document_chunks_local";
DROP POLICY IF EXISTS "Allow anonymous read owners" ON "public"."owners";
DROP POLICY IF EXISTS "Allow anonymous update ratings" ON "public"."chat_conversations";
DROP POLICY IF EXISTS "Allow authenticated delete own categories" ON "public"."categories";
DROP POLICY IF EXISTS "Allow authenticated insert access" ON "public"."document_chunks_local";
DROP POLICY IF EXISTS "Allow authenticated insert categories" ON "public"."categories";
DROP POLICY IF EXISTS "Allow authenticated insert owners" ON "public"."owners";
DROP POLICY IF EXISTS "Allow authenticated inserts" ON "public"."chat_conversations";
DROP POLICY IF EXISTS "Allow authenticated read access" ON "public"."document_chunks";
DROP POLICY IF EXISTS "Allow authenticated update own categories" ON "public"."categories";
DROP POLICY IF EXISTS "Allow authenticated update owners" ON "public"."owners";
DROP POLICY IF EXISTS "Allow read access to categories" ON "public"."categories";
DROP POLICY IF EXISTS "Allow read access to system_config" ON "public"."system_config";
DROP POLICY IF EXISTS "Allow service role full access on categories" ON "public"."categories";
DROP POLICY IF EXISTS "Allow service role full access on documents" ON "public"."documents";
DROP POLICY IF EXISTS "Allow service role full access on owners" ON "public"."owners";
DROP POLICY IF EXISTS "Allow service role full access on system_config" ON "public"."system_config";
DROP POLICY IF EXISTS "Allow service role full access" ON "public"."document_chunks_local";
DROP POLICY IF EXISTS "Authenticated users can read quiz questions" ON "public"."quiz_questions";
DROP POLICY IF EXISTS "Authenticated users can read quizzes" ON "public"."quizzes";
DROP POLICY IF EXISTS "Global super admins manage all roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Global super admins read all roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Owner admins can delete documents" ON "public"."documents";
DROP POLICY IF EXISTS "Owner admins can insert documents" ON "public"."documents";
DROP POLICY IF EXISTS "Owner admins can update documents" ON "public"."documents";
DROP POLICY IF EXISTS "Owner admins can view their invitations" ON "public"."user_invitations";
DROP POLICY IF EXISTS "Owner admins read group access" ON "public"."user_owner_access";
DROP POLICY IF EXISTS "Owner admins read group roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Owner-admin-only documents require owner admin role" ON "public"."documents";
DROP POLICY IF EXISTS "Owner-restricted documents require owner membership" ON "public"."documents";
DROP POLICY IF EXISTS "Public and passcode documents readable by all" ON "public"."documents";
DROP POLICY IF EXISTS "Read owners for active documents" ON "public"."owners";
DROP POLICY IF EXISTS "Registered documents readable by authenticated users" ON "public"."documents";
DROP POLICY IF EXISTS "Service role can insert processing logs" ON "public"."document_processing_logs";
DROP POLICY IF EXISTS "Service role can insert training history" ON "public"."document_training_history";
DROP POLICY IF EXISTS "Service role can manage attempts" ON "public"."quiz_attempts";
DROP POLICY IF EXISTS "Service role can manage invitations" ON "public"."user_invitations";
DROP POLICY IF EXISTS "Service role can manage profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Service role can manage quiz questions" ON "public"."quiz_questions";
DROP POLICY IF EXISTS "Service role can manage quizzes" ON "public"."quizzes";
DROP POLICY IF EXISTS "Super admins and owner admins can view all documents" ON "public"."documents";
DROP POLICY IF EXISTS "Super admins can view all invitations" ON "public"."user_invitations";
DROP POLICY IF EXISTS "Super admins manage owners" ON "public"."owners";
DROP POLICY IF EXISTS "Super admins read all access" ON "public"."user_owner_access";
DROP POLICY IF EXISTS "Super admins read all owners" ON "public"."owners";
DROP POLICY IF EXISTS "Users can create own attempts" ON "public"."quiz_attempts";
DROP POLICY IF EXISTS "Users can delete own documents" ON "public"."user_documents";
DROP POLICY IF EXISTS "Users can insert own documents" ON "public"."user_documents";
DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can insert their own documents" ON "public"."documents";
DROP POLICY IF EXISTS "Users can read own attempts" ON "public"."quiz_attempts";
DROP POLICY IF EXISTS "Users can read own documents" ON "public"."user_documents";
DROP POLICY IF EXISTS "Users can read own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can update own documents" ON "public"."user_documents";
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can update their own documents" ON "public"."documents";
DROP POLICY IF EXISTS "Users can view quiz generation logs for accessible documents" ON "public"."document_processing_logs";
DROP POLICY IF EXISTS "Users can view their own document processing logs" ON "public"."document_processing_logs";
DROP POLICY IF EXISTS "Users can view training history for accessible documents" ON "public"."document_training_history";
DROP POLICY IF EXISTS "Users read own access" ON "public"."user_owner_access";
DROP POLICY IF EXISTS "Users read own roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "attachment_downloads_insert_policy" ON "public"."document_attachment_downloads";
DROP POLICY IF EXISTS "attachment_downloads_select_policy" ON "public"."document_attachment_downloads";
DROP POLICY IF EXISTS "document_attachments_delete_policy" ON "public"."document_attachments";
DROP POLICY IF EXISTS "document_attachments_insert_policy" ON "public"."document_attachments";
DROP POLICY IF EXISTS "document_attachments_select_policy" ON "public"."document_attachments";
DROP POLICY IF EXISTS "document_attachments_update_policy" ON "public"."document_attachments";

-- ============================================================================
-- STEP 2: Create all policies from backup
-- ============================================================================

-- Policy: Admins can view all quiz generation logs (from public_Admins can view all quiz generation logs.sql)
CREATE POLICY "Admins can view all quiz generation logs" ON "public"."document_processing_logs" FOR SELECT USING ((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"
  WHERE (("user_permissions_summary"."user_id" = "auth"."uid"()) AND ("user_permissions_summary"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"

-- Policy: Admins can view all training history (from public_Admins can view all training history.sql)
CREATE POLICY "Admins can view all training history" ON "public"."document_training_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));

-- Policy: Admins grant access (from public_Admins grant access.sql)
CREATE POLICY "Admins grant access" ON "public"."user_owner_access" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"

-- Policy: Admins revoke access (from public_Admins revoke access.sql)
CREATE POLICY "Admins revoke access" ON "public"."user_owner_access" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"

-- Policy: Allow anon reads (from public_Allow anon reads.sql)
CREATE POLICY "Allow anon reads" ON "public"."chat_conversations" FOR SELECT TO "authenticated", "anon" USING (true);

-- Policy: Allow anonymous inserts (from public_Allow anonymous inserts.sql)
CREATE POLICY "Allow anonymous inserts" ON "public"."chat_conversations" FOR INSERT TO "anon" WITH CHECK (true);

-- Policy: Allow anonymous read access (from public_Allow anonymous read access.sql)
CREATE POLICY "Allow anonymous read access" ON "public"."document_chunks_local" FOR SELECT TO "anon" USING (true);

-- Policy: Allow anonymous read owners (from public_Allow anonymous read owners.sql)
CREATE POLICY "Allow anonymous read owners" ON "public"."owners" FOR SELECT TO "anon" USING (true);

-- Policy: Allow anonymous update ratings (from public_Allow anonymous update ratings.sql)
CREATE POLICY "Allow anonymous update ratings" ON "public"."chat_conversations" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);

-- Policy: Allow authenticated delete own categories (from public_Allow authenticated delete own categories.sql)
CREATE POLICY "Allow authenticated delete own categories" ON "public"."categories" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))));

-- Policy: Allow authenticated insert access (from public_Allow authenticated insert access.sql)
CREATE POLICY "Allow authenticated insert access" ON "public"."document_chunks_local" FOR INSERT TO "authenticated" WITH CHECK (true);

-- Policy: Allow authenticated insert categories (from public_Allow authenticated insert categories.sql)
CREATE POLICY "Allow authenticated insert categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (true);

-- Policy: Allow authenticated insert owners (from public_Allow authenticated insert owners.sql)
CREATE POLICY "Allow authenticated insert owners" ON "public"."owners" FOR INSERT TO "authenticated" WITH CHECK (true);

-- Policy: Allow authenticated inserts (from public_Allow authenticated inserts.sql)
CREATE POLICY "Allow authenticated inserts" ON "public"."chat_conversations" FOR INSERT TO "authenticated" WITH CHECK (true);

-- Policy: Allow authenticated read access (from public_Allow authenticated read access.sql)
CREATE POLICY "Allow authenticated read access" ON "public"."document_chunks" FOR SELECT TO "authenticated" USING (true);

-- Policy: Allow authenticated update own categories (from public_Allow authenticated update own categories.sql)
CREATE POLICY "Allow authenticated update own categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));

-- Policy: Allow authenticated update owners (from public_Allow authenticated update owners.sql)
CREATE POLICY "Allow authenticated update owners" ON "public"."owners" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

-- Policy: Allow read access to categories (from public_Allow read access to categories.sql)
CREATE POLICY "Allow read access to categories" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);

-- Policy: Allow read access to system_config (from public_Allow read access to system_config.sql)
CREATE POLICY "Allow read access to system_config" ON "public"."system_config" FOR SELECT TO "authenticated", "anon" USING (true);

-- Policy: Allow service role full access on categories (from public_Allow service role full access on categories.sql)
CREATE POLICY "Allow service role full access on categories" ON "public"."categories" TO "service_role" USING (true) WITH CHECK (true);

-- Policy: Allow service role full access on documents (from public_Allow service role full access on documents.sql)
CREATE POLICY "Allow service role full access on documents" ON "public"."documents" TO "service_role" USING (true) WITH CHECK (true);

-- Policy: Allow service role full access on owners (from public_Allow service role full access on owners.sql)
CREATE POLICY "Allow service role full access on owners" ON "public"."owners" TO "service_role" USING (true) WITH CHECK (true);

-- Policy: Allow service role full access on system_config (from public_Allow service role full access on system_config.sql)
CREATE POLICY "Allow service role full access on system_config" ON "public"."system_config" TO "service_role" USING (true) WITH CHECK (true);

-- Policy: Allow service role full access (from public_Allow service role full access.sql)
CREATE POLICY "Allow service role full access" ON "public"."document_chunks_local" TO "service_role" USING (true);

-- Policy: Authenticated users can read quiz questions (from public_Authenticated users can read quiz questions.sql)
CREATE POLICY "Authenticated users can read quiz questions" ON "public"."quiz_questions" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));

-- Policy: Authenticated users can read quizzes (from public_Authenticated users can read quizzes.sql)
CREATE POLICY "Authenticated users can read quizzes" ON "public"."quizzes" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));

-- Policy: Global super admins manage all roles (from public_Global super admins manage all roles.sql)
CREATE POLICY "Global super admins manage all roles" ON "public"."user_roles" USING ("public"."check_is_super_admin"());

-- Policy: Global super admins read all roles (from public_Global super admins read all roles.sql)
CREATE POLICY "Global super admins read all roles" ON "public"."user_roles" FOR SELECT USING ("public"."check_is_super_admin"());

-- Policy: Owner admins can delete documents (from public_Owner admins can delete documents.sql)
CREATE POLICY "Owner admins can delete documents" ON "public"."documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));

-- Policy: Owner admins can insert documents (from public_Owner admins can insert documents.sql)
CREATE POLICY "Owner admins can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));

-- Policy: Owner admins can update documents (from public_Owner admins can update documents.sql)
CREATE POLICY "Owner admins can update documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"

-- Policy: Owner admins can view their invitations (from public_Owner admins can view their invitations.sql)
CREATE POLICY "Owner admins can view their invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner_admin'::"text") AND ("ur"."owner_id" = "user_invitations"."owner_id")))));

-- Policy: Owner admins read group access (from public_Owner admins read group access.sql)
CREATE POLICY "Owner admins read group access" ON "public"."user_owner_access" FOR SELECT USING (("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text")))));

-- Policy: Owner admins read group roles (from public_Owner admins read group roles.sql)
CREATE POLICY "Owner admins read group roles" ON "public"."user_roles" FOR SELECT USING (("owner_id" IN ( SELECT "get_user_owner_admin_groups"."owner_id"
   FROM "public"."get_user_owner_admin_groups"() "get_user_owner_admin_groups"("owner_id"))));

-- Policy: Owner-admin-only documents require owner admin role (from public_Owner-admin-only documents require owner admin role.sql)
CREATE POLICY "Owner-admin-only documents require owner admin role" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'owner_admin_only'::"public"."document_access_level") AND "public"."user_has_document_access"("auth"."uid"(), "id")));

-- Policy: Owner-restricted documents require owner membership (from public_Owner-restricted documents require owner membership.sql)
CREATE POLICY "Owner-restricted documents require owner membership" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'owner_restricted'::"public"."document_access_level") AND "public"."user_has_document_access"("auth"."uid"(), "id")));

-- Policy: Public and passcode documents readable by all (from public_Public and passcode documents readable by all.sql)
CREATE POLICY "Public and passcode documents readable by all" ON "public"."documents" FOR SELECT USING ((("active" = true) AND ("access_level" = ANY (ARRAY['public'::"public"."document_access_level", 'passcode'::"public"."document_access_level"]))));

-- Policy: Read owners for active documents (from public_Read owners for active documents.sql)
CREATE POLICY "Read owners for active documents" ON "public"."owners" FOR SELECT USING (("id" IN ( SELECT "documents"."owner_id"
   FROM "public"."documents"
  WHERE ("documents"."active" = true))));

-- Policy: Registered documents readable by authenticated users (from public_Registered documents readable by authenticated users.sql)
CREATE POLICY "Registered documents readable by authenticated users" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'registered'::"public"."document_access_level")));

-- Policy: Service role can insert processing logs (from public_Service role can insert processing logs.sql)
CREATE POLICY "Service role can insert processing logs" ON "public"."document_processing_logs" FOR INSERT WITH CHECK (true);

-- Policy: Service role can insert training history (from public_Service role can insert training history.sql)
CREATE POLICY "Service role can insert training history" ON "public"."document_training_history" FOR INSERT WITH CHECK (true);

-- Policy: Service role can manage attempts (from public_Service role can manage attempts.sql)
CREATE POLICY "Service role can manage attempts" ON "public"."quiz_attempts" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- Policy: Service role can manage invitations (from public_Service role can manage invitations.sql)
CREATE POLICY "Service role can manage invitations" ON "public"."user_invitations" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- Policy: Service role can manage profiles (from public_Service role can manage profiles.sql)
CREATE POLICY "Service role can manage profiles" ON "public"."user_profiles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- Policy: Service role can manage quiz questions (from public_Service role can manage quiz questions.sql)
CREATE POLICY "Service role can manage quiz questions" ON "public"."quiz_questions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- Policy: Service role can manage quizzes (from public_Service role can manage quizzes.sql)
CREATE POLICY "Service role can manage quizzes" ON "public"."quizzes" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- Policy: Super admins and owner admins can view all documents (from public_Super admins and owner admins can view all documents.sql)
CREATE POLICY "Super admins and owner admins can view all documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"

-- Policy: Super admins can view all invitations (from public_Super admins can view all invitations.sql)
CREATE POLICY "Super admins can view all invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"text")))));

-- Policy: Super admins manage owners (from public_Super admins manage owners.sql)
CREATE POLICY "Super admins manage owners" ON "public"."owners" USING ("public"."check_is_super_admin"());

-- Policy: Super admins read all access (from public_Super admins read all access.sql)
CREATE POLICY "Super admins read all access" ON "public"."user_owner_access" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))));

-- Policy: Super admins read all owners (from public_Super admins read all owners.sql)
CREATE POLICY "Super admins read all owners" ON "public"."owners" FOR SELECT USING ("public"."check_is_super_admin"());

-- Policy: Users can create own attempts (from public_Users can create own attempts.sql)
CREATE POLICY "Users can create own attempts" ON "public"."quiz_attempts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));

-- Policy: Users can delete own documents (from public_Users can delete own documents.sql)
CREATE POLICY "Users can delete own documents" ON "public"."user_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Policy: Users can insert own documents (from public_Users can insert own documents.sql)
CREATE POLICY "Users can insert own documents" ON "public"."user_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

-- Policy: Users can insert own profile (from public_Users can insert own profile.sql)
CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

-- Policy: Users can insert their own documents (from public_Users can insert their own documents.sql)
CREATE POLICY "Users can insert their own documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())));

-- Policy: Users can read own attempts (from public_Users can read own attempts.sql)
CREATE POLICY "Users can read own attempts" ON "public"."quiz_attempts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));

-- Policy: Users can read own documents (from public_Users can read own documents.sql)
CREATE POLICY "Users can read own documents" ON "public"."user_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- Policy: Users can read own profile (from public_Users can read own profile.sql)
CREATE POLICY "Users can read own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- Policy: Users can update own documents (from public_Users can update own documents.sql)
CREATE POLICY "Users can update own documents" ON "public"."user_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));

-- Policy: Users can update own profile (from public_Users can update own profile.sql)
CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));

-- Policy: Users can update their own documents (from public_Users can update their own documents.sql)
CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"()))) WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())));

-- Policy: Users can view quiz generation logs for accessible documents (from public_Users can view quiz generation logs for accessible documents.sql)
CREATE POLICY "Users can view quiz generation logs for accessible documents" ON "public"."document_processing_logs" FOR SELECT USING ((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL) AND ("public"."user_has_document_access_by_slug"("auth"."uid"(), "document_slug") = true)));

-- Policy: Users can view their own document processing logs (from public_Users can view their own document processing logs.sql)
CREATE POLICY "Users can view their own document processing logs" ON "public"."document_processing_logs" FOR SELECT USING (("user_document_id" IN ( SELECT "user_documents"."id"
   FROM "public"."user_documents"
  WHERE ("user_documents"."user_id" = "auth"."uid"()))));

-- Policy: Users can view training history for accessible documents (from public_Users can view training history for accessible documents.sql)
CREATE POLICY "Users can view training history for accessible documents" ON "public"."document_training_history" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE (("documents"."owner_id" IN ( SELECT "owners"."id"
           FROM "public"."owners"

-- Policy: Users read own access (from public_Users read own access.sql)
CREATE POLICY "Users read own access" ON "public"."user_owner_access" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- Policy: Users read own roles (from public_Users read own roles.sql)
CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- Policy: attachment_downloads_insert_policy (from public_attachment_downloads_insert_policy.sql)
CREATE POLICY "attachment_downloads_insert_policy" ON "public"."document_attachment_downloads" FOR INSERT WITH CHECK (true);

-- Policy: attachment_downloads_select_policy (from public_attachment_downloads_select_policy.sql)
CREATE POLICY "attachment_downloads_select_policy" ON "public"."document_attachment_downloads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."document_attachments" "da"
     JOIN "public"."documents" "d" ON (("d"."id" = "da"."document_id")))
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))

-- Policy: document_attachments_delete_policy (from public_document_attachments_delete_policy.sql)
CREATE POLICY "document_attachments_delete_policy" ON "public"."document_attachments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1

-- Policy: document_attachments_insert_policy (from public_document_attachments_insert_policy.sql)
CREATE POLICY "document_attachments_insert_policy" ON "public"."document_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1

-- Policy: document_attachments_select_policy (from public_document_attachments_select_policy.sql)
CREATE POLICY "document_attachments_select_policy" ON "public"."document_attachments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'public'::"public"."document_access_level")))) OR (EXISTS ( SELECT 1
   FROM "public"."documents" "d"

-- Policy: document_attachments_update_policy (from public_document_attachments_update_policy.sql)
CREATE POLICY "document_attachments_update_policy" ON "public"."document_attachments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1


-- ============================================================================
-- STEP 3: Verification Queries
-- ============================================================================

-- Count total policies
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- List all policies by table
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- Restoration Complete
-- ============================================================================
-- Expected policy count: 73
-- Verify the count matches above before considering restoration complete.
-- ============================================================================
