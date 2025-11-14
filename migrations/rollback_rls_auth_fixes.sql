-- ============================================================================
-- Rollback Script: RLS Auth Function Re-evaluation Fixes
-- ============================================================================
-- Purpose: Restore all 44 RLS policies to their original state before
--          optimization (without (select auth.<function>()) wrapping)
-- Date: 2025-11-11
-- Source: Original policies from database before optimization
-- ============================================================================
--
-- USAGE:
--   Full rollback: Run entire script
--   Partial rollback: Run specific batch section
--   Emergency restore: Use backup files from /backups/supabase_backup_latest/schema/policies/
--
-- ============================================================================
-- BATCH 1: User Tables (9 policies)
-- ============================================================================

-- user_documents (4 policies)
DROP POLICY IF EXISTS "Users can read own documents" ON public.user_documents;
CREATE POLICY "Users can read own documents" ON "public"."user_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert own documents" ON public.user_documents;
CREATE POLICY "Users can insert own documents" ON "public"."user_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can update own documents" ON public.user_documents;
CREATE POLICY "Users can update own documents" ON "public"."user_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can delete own documents" ON public.user_documents;
CREATE POLICY "Users can delete own documents" ON "public"."user_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- user_profiles (4 policies)
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage profiles" ON "public"."user_profiles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- user_roles (1 policy)
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));

-- ============================================================================
-- BATCH 2: Categories & User Owner Access (7 policies)
-- ============================================================================

-- categories (2 policies)
DROP POLICY IF EXISTS "Allow authenticated delete own categories" ON public.categories;
CREATE POLICY "Allow authenticated delete own categories" ON "public"."categories" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))));

DROP POLICY IF EXISTS "Allow authenticated update own categories" ON public.categories;
CREATE POLICY "Allow authenticated update own categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));

-- user_owner_access (5 policies)
DROP POLICY IF EXISTS "Users read own access" ON public.user_owner_access;
CREATE POLICY "Users read own access" ON "public"."user_owner_access" FOR SELECT USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Owner admins read group access" ON public.user_owner_access;
CREATE POLICY "Owner admins read group access" ON "public"."user_owner_access" FOR SELECT USING (("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text")))));

DROP POLICY IF EXISTS "Super admins read all access" ON public.user_owner_access;
CREATE POLICY "Super admins read all access" ON "public"."user_owner_access" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))));

DROP POLICY IF EXISTS "Admins grant access" ON public.user_owner_access;
CREATE POLICY "Admins grant access" ON "public"."user_owner_access" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text"))))));

DROP POLICY IF EXISTS "Admins revoke access" ON public.user_owner_access;
CREATE POLICY "Admins revoke access" ON "public"."user_owner_access" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text"))))));

-- ============================================================================
-- BATCH 3: Documents Table (8 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Owner admins can delete documents" ON public.documents;
CREATE POLICY "Owner admins can delete documents" ON "public"."documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));

DROP POLICY IF EXISTS "Owner admins can insert documents" ON public.documents;
CREATE POLICY "Owner admins can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));

DROP POLICY IF EXISTS "Owner admins can update documents" ON public.documents;
CREATE POLICY "Owner admins can update documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));

DROP POLICY IF EXISTS "Owner-admin-only documents require owner admin role" ON public.documents;
CREATE POLICY "Owner-admin-only documents require owner admin role" ON "public"."documents" FOR SELECT TO "authenticated" USING (((("active" = true) AND ("access_level" = 'owner_admin_only'::"public"."document_access_level")) AND "user_has_document_access"("auth"."uid"(), "id")));

DROP POLICY IF EXISTS "Owner-restricted documents require owner membership" ON public.documents;
CREATE POLICY "Owner-restricted documents require owner membership" ON "public"."documents" FOR SELECT TO "authenticated" USING (((("active" = true) AND ("access_level" = 'owner_restricted'::"public"."document_access_level")) AND "user_has_document_access"("auth"."uid"(), "id")));

DROP POLICY IF EXISTS "Super admins and owner admins can view all documents" ON public.documents;
CREATE POLICY "Super admins and owner admins can view all documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id"))))));

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND (((("metadata" ->> 'user_id'::"text"))::"uuid") = "auth"."uid"())));

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND (((("metadata" ->> 'user_id'::"text"))::"uuid") = "auth"."uid"()))) WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND (((("metadata" ->> 'user_id'::"text"))::"uuid") = "auth"."uid"())));

-- ============================================================================
-- BATCH 4: Document Processing Tables (5 policies)
-- ============================================================================

-- document_processing_logs (3 policies)
DROP POLICY IF EXISTS "Admins can view all quiz generation logs" ON public.document_processing_logs;
CREATE POLICY "Admins can view all quiz generation logs" ON "public"."document_processing_logs" FOR SELECT USING ((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"
  WHERE (("user_permissions_summary"."user_id" = "auth"."uid"()) AND ("user_permissions_summary"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"
  WHERE (("user_permissions_summary"."user_id" = "auth"."uid"()) AND ("user_permissions_summary"."role" = 'owner_admin'::"text")))))));

DROP POLICY IF EXISTS "Users can view quiz generation logs for accessible documents" ON public.document_processing_logs;
CREATE POLICY "Users can view quiz generation logs for accessible documents" ON "public"."document_processing_logs" FOR SELECT USING (((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL)) AND ("user_has_document_access_by_slug"("auth"."uid"(), "document_slug") = true)));

DROP POLICY IF EXISTS "Users can view their own document processing logs" ON public.document_processing_logs;
CREATE POLICY "Users can view their own document processing logs" ON "public"."document_processing_logs" FOR SELECT USING (("user_document_id" IN ( SELECT "user_documents"."id"
   FROM "public"."user_documents"
  WHERE ("user_documents"."user_id" = "auth"."uid"())))));

-- document_training_history (2 policies)
DROP POLICY IF EXISTS "Admins can view all training history" ON public.document_training_history;
CREATE POLICY "Admins can view all training history" ON "public"."document_training_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));

DROP POLICY IF EXISTS "Users can view training history for accessible documents" ON public.document_training_history;
CREATE POLICY "Users can view training history for accessible documents" ON "public"."document_training_history" FOR SELECT USING (((("user_id" = "auth"."uid"()) OR ("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE ((("documents"."owner_id" IN ( SELECT "owners"."id"
           FROM "public"."owners"
          WHERE ("document_training_history"."user_id" = "auth"."uid"()))) OR ("documents"."uploaded_by_user_id" = "auth"."uid"())) OR ("documents"."id" IN ( SELECT "d"."id"
           FROM "public"."documents" "d"
          WHERE ((("d"."access_level" = 'public'::"public"."document_access_level") OR (("d"."access_level" = 'registered'::"public"."document_access_level") AND ("auth"."uid"() IS NOT NULL))) OR (("d"."access_level" = 'owner_restricted'::"public"."document_access_level") AND (EXISTS ( SELECT 1
                   FROM ("public"."user_owner_access" "uoa"
                     JOIN "public"."owners" "o" ON (("o"."id" = "uoa"."owner_id")))
                  WHERE (("uoa"."user_id" = "auth"."uid"()) AND ("o"."id" = "d"."owner_id"))))) OR (("d"."access_level" = 'owner_admin_only'::"public"."document_access_level") AND (EXISTS ( SELECT 1
                   FROM ("public"."user_roles" "ur"
                     JOIN "public"."owners" "o" ON (("o"."id" = "ur"."owner_id")))
                  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner_admin'::"text") AND ("o"."id" = "d"."owner_id"))))))))))));

-- ============================================================================
-- BATCH 5: User Invitations (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Owner admins can view their invitations" ON public.user_invitations;
CREATE POLICY "Owner admins can view their invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner_admin'::"text") AND ("ur"."owner_id" = "user_invitations"."owner_id")))));

DROP POLICY IF EXISTS "Service role can manage invitations" ON public.user_invitations;
CREATE POLICY "Service role can manage invitations" ON "public"."user_invitations" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

DROP POLICY IF EXISTS "Super admins can view all invitations" ON public.user_invitations;
CREATE POLICY "Super admins can view all invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"text")))));

-- ============================================================================
-- BATCH 6: Quiz Tables (7 policies)
-- ============================================================================

-- quiz_attempts (3 policies)
DROP POLICY IF EXISTS "Service role can manage attempts" ON public.quiz_attempts;
CREATE POLICY "Service role can manage attempts" ON "public"."quiz_attempts" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

DROP POLICY IF EXISTS "Users can create own attempts" ON public.quiz_attempts;
CREATE POLICY "Users can create own attempts" ON "public"."quiz_attempts" FOR INSERT WITH CHECK (((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'authenticated'::"text")) OR ("auth"."role"() = 'anon'::"text")));

DROP POLICY IF EXISTS "Users can read own attempts" ON public.quiz_attempts;
CREATE POLICY "Users can read own attempts" ON "public"."quiz_attempts" FOR SELECT USING (((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text"))));

-- quiz_questions (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read quiz questions" ON public.quiz_questions;
CREATE POLICY "Authenticated users can read quiz questions" ON "public"."quiz_questions" FOR SELECT USING (((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text"))));

DROP POLICY IF EXISTS "Service role can manage quiz questions" ON public.quiz_questions;
CREATE POLICY "Service role can manage quiz questions" ON "public"."quiz_questions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- quizzes (2 policies)
DROP POLICY IF EXISTS "Authenticated users can read quizzes" ON public.quizzes;
CREATE POLICY "Authenticated users can read quizzes" ON "public"."quizzes" FOR SELECT USING (((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text"))));

DROP POLICY IF EXISTS "Service role can manage quizzes" ON public.quizzes;
CREATE POLICY "Service role can manage quizzes" ON "public"."quizzes" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

-- ============================================================================
-- BATCH 7: Document Attachments (6 policies)
-- ============================================================================

-- document_attachments (5 policies)
DROP POLICY IF EXISTS "document_attachments_delete_policy" ON public.document_attachments;
CREATE POLICY "document_attachments_delete_policy" ON "public"."document_attachments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON (((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id")))))
  WHERE ((("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"]))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles"
          WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))))))));

DROP POLICY IF EXISTS "document_attachments_insert_policy" ON public.document_attachments;
CREATE POLICY "document_attachments_insert_policy" ON "public"."document_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON (((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id")))))
  WHERE ((("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"]))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles"
          WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))))))));

DROP POLICY IF EXISTS "document_attachments_select_policy" ON public.document_attachments;
CREATE POLICY "document_attachments_select_policy" ON "public"."document_attachments" FOR SELECT USING ((((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE ((("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'public'::"public"."document_access_level")))) OR (EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE ((("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'passcode'::"public"."document_access_level")))) OR (EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE ((("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'registered'::"public"."document_access_level") AND ("auth"."uid"() IS NOT NULL))))) OR (EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     JOIN "public"."user_owner_access" "uoa" ON (("uoa"."owner_id" = "d"."owner_id")))
  WHERE ((("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'owner_restricted'::"public"."document_access_level") AND ("uoa"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON (((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id")))))
  WHERE ((("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'owner_admin_only'::"public"."document_access_level") AND (("ur"."role" = 'owner_admin'::"text") OR (EXISTS ( SELECT 1
           FROM "public"."user_roles"
          WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))));

DROP POLICY IF EXISTS "document_attachments_update_policy" ON public.document_attachments;
CREATE POLICY "document_attachments_update_policy" ON "public"."document_attachments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON (((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id")))))
  WHERE ((("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"]))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles"
          WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))))))));

-- document_attachment_downloads (1 policy)
DROP POLICY IF EXISTS "attachment_downloads_select_policy" ON public.document_attachment_downloads;
CREATE POLICY "attachment_downloads_select_policy" ON "public"."document_attachment_downloads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."document_attachments" "da"
     JOIN "public"."documents" "d" ON (("d"."id" = "da"."document_id")))
     LEFT JOIN "public"."user_roles" "ur" ON (((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id")))))
  WHERE ((("da"."id" = "document_attachment_downloads"."attachment_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"]))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles"
          WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))))))));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all 44 policies are restored
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND (
        (tablename = 'user_documents' AND policyname LIKE 'Users can%')
        OR (tablename = 'user_profiles' AND policyname LIKE 'Users can%')
        OR (tablename = 'user_profiles' AND policyname = 'Service role can manage profiles')
        OR (tablename = 'user_roles' AND policyname = 'Users read own roles')
        OR (tablename = 'categories' AND policyname LIKE 'Allow authenticated%')
        OR (tablename = 'user_owner_access' AND policyname IN ('Users read own access', 'Owner admins read group access', 'Super admins read all access', 'Admins grant access', 'Admins revoke access'))
        OR (tablename = 'documents' AND policyname IN ('Owner admins can delete documents', 'Owner admins can insert documents', 'Owner admins can update documents', 'Owner-admin-only documents require owner admin role', 'Owner-restricted documents require owner membership', 'Super admins and owner admins can view all documents', 'Users can insert their own documents', 'Users can update their own documents'))
        OR (tablename = 'document_processing_logs' AND policyname LIKE '%quiz generation logs%')
        OR (tablename = 'document_processing_logs' AND policyname LIKE '%document processing logs%')
        OR (tablename = 'document_training_history' AND policyname LIKE '%training history%')
        OR (tablename = 'user_invitations' AND policyname LIKE '%invitations%')
        OR (tablename = 'quiz_attempts' AND policyname LIKE '%attempts%')
        OR (tablename = 'quiz_questions' AND policyname LIKE '%quiz questions%')
        OR (tablename = 'quizzes' AND policyname LIKE '%quizzes%')
        OR (tablename = 'document_attachments' AND policyname LIKE 'document_attachments_%')
        OR (tablename = 'document_attachment_downloads' AND policyname = 'attachment_downloads_select_policy')
    )
ORDER BY tablename, policyname;

-- Expected: 44 rows

-- ============================================================================
-- NOTES
-- ============================================================================

-- This rollback script restores all policies to their original state
-- (without (select auth.<function>()) optimization)
--
-- To rollback a specific batch, run only that batch's section
-- To rollback all, run entire script
--
-- Original backup files are available at:
-- /backups/supabase_backup_latest/schema/policies/











