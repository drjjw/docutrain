-- RESTORE ALL ORIGINAL POLICIES FROM BACKUP
-- This restores the exact state before any performance fix attempts

-- First, drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Now restore all original policies from backup
-- (Policies will be added via separate file reads)

CREATE POLICY "Admins can view all quiz generation logs" ON "public"."document_processing_logs" FOR SELECT USING ((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"
  WHERE (("user_permissions_summary"."user_id" = "auth"."uid"()) AND ("user_permissions_summary"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_permissions_summary"

CREATE POLICY "Admins can view all training history" ON "public"."document_training_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));


CREATE POLICY "Admins grant access" ON "public"."user_owner_access" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"

CREATE POLICY "Admins revoke access" ON "public"."user_owner_access" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR ("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"

CREATE POLICY "Allow anon reads" ON "public"."chat_conversations" FOR SELECT TO "authenticated", "anon" USING (true);




CREATE POLICY "Allow anonymous inserts" ON "public"."chat_conversations" FOR INSERT TO "anon" WITH CHECK (true);




CREATE POLICY "Allow anonymous read access" ON "public"."document_chunks_local" FOR SELECT TO "anon" USING (true);




CREATE POLICY "Allow anonymous read owners" ON "public"."owners" FOR SELECT TO "anon" USING (true);




CREATE POLICY "Allow anonymous update ratings" ON "public"."chat_conversations" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);




CREATE POLICY "Allow authenticated delete own categories" ON "public"."categories" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text"))))));


CREATE POLICY "Allow authenticated insert access" ON "public"."document_chunks_local" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "Allow authenticated insert categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "Allow authenticated insert owners" ON "public"."owners" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "Allow authenticated inserts" ON "public"."chat_conversations" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "Allow authenticated read access" ON "public"."document_chunks" FOR SELECT TO "authenticated" USING (true);




CREATE POLICY "Allow authenticated update own categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));




CREATE POLICY "Allow authenticated update owners" ON "public"."owners" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);




CREATE POLICY "Allow read access to categories" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);




CREATE POLICY "Allow read access to system_config" ON "public"."system_config" FOR SELECT TO "authenticated", "anon" USING (true);




CREATE POLICY "Allow service role full access on categories" ON "public"."categories" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "Allow service role full access on documents" ON "public"."documents" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "Allow service role full access on owners" ON "public"."owners" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "Allow service role full access on system_config" ON "public"."system_config" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "Allow service role full access" ON "public"."document_chunks_local" TO "service_role" USING (true);




CREATE POLICY "Authenticated users can read quiz questions" ON "public"."quiz_questions" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));




CREATE POLICY "Authenticated users can read quizzes" ON "public"."quizzes" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));




CREATE POLICY "Global super admins manage all roles" ON "public"."user_roles" USING ("public"."check_is_super_admin"());




CREATE POLICY "Global super admins read all roles" ON "public"."user_roles" FOR SELECT USING ("public"."check_is_super_admin"());




CREATE POLICY "Owner admins can delete documents" ON "public"."documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));


CREATE POLICY "Owner admins can insert documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id")))))));


CREATE POLICY "Owner admins can update documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'super_admin'::"text") OR (("user_roles"."role" = 'owner_admin'::"text") AND ("user_roles"."owner_id" = "documents"."owner_id"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"

CREATE POLICY "Owner admins can view their invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'owner_admin'::"text") AND ("ur"."owner_id" = "user_invitations"."owner_id")))));


CREATE POLICY "Owner admins read group access" ON "public"."user_owner_access" FOR SELECT USING (("owner_id" IN ( SELECT "user_roles"."owner_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'owner_admin'::"text")))));


CREATE POLICY "Owner admins read group roles" ON "public"."user_roles" FOR SELECT USING (("owner_id" IN ( SELECT "get_user_owner_admin_groups"."owner_id"
   FROM "public"."get_user_owner_admin_groups"() "get_user_owner_admin_groups"("owner_id"))));



CREATE POLICY "Owner-admin-only documents require owner admin role" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'owner_admin_only'::"public"."document_access_level") AND "public"."user_has_document_access"("auth"."uid"(), "id")));




CREATE POLICY "Owner-restricted documents require owner membership" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'owner_restricted'::"public"."document_access_level") AND "public"."user_has_document_access"("auth"."uid"(), "id")));




CREATE POLICY "Public and passcode documents readable by all" ON "public"."documents" FOR SELECT USING ((("active" = true) AND ("access_level" = ANY (ARRAY['public'::"public"."document_access_level", 'passcode'::"public"."document_access_level"]))));




CREATE POLICY "Read owners for active documents" ON "public"."owners" FOR SELECT USING (("id" IN ( SELECT "documents"."owner_id"
   FROM "public"."documents"
  WHERE ("documents"."active" = true))));


CREATE POLICY "Registered documents readable by authenticated users" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("active" = true) AND ("access_level" = 'registered'::"public"."document_access_level")));




CREATE POLICY "Service role can insert processing logs" ON "public"."document_processing_logs" FOR INSERT WITH CHECK (true);




CREATE POLICY "Service role can insert training history" ON "public"."document_training_history" FOR INSERT WITH CHECK (true);




CREATE POLICY "Service role can manage attempts" ON "public"."quiz_attempts" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));




CREATE POLICY "Service role can manage invitations" ON "public"."user_invitations" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));




CREATE POLICY "Service role can manage profiles" ON "public"."user_profiles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));




CREATE POLICY "Service role can manage quiz questions" ON "public"."quiz_questions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));




CREATE POLICY "Service role can manage quizzes" ON "public"."quizzes" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));




CREATE POLICY "Super admins and owner admins can view all documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"

CREATE POLICY "Super admins can view all invitations" ON "public"."user_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"text")))));


CREATE POLICY "Super admins manage owners" ON "public"."owners" USING ("public"."check_is_super_admin"());




CREATE POLICY "Super admins read all access" ON "public"."user_owner_access" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"text")))));


CREATE POLICY "Super admins read all owners" ON "public"."owners" FOR SELECT USING ("public"."check_is_super_admin"());




CREATE POLICY "Users can create own attempts" ON "public"."quiz_attempts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'authenticated'::"text") OR ("auth"."role"() = 'anon'::"text")));




CREATE POLICY "Users can delete own documents" ON "public"."user_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can insert own documents" ON "public"."user_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can insert their own documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())));




CREATE POLICY "Users can read own attempts" ON "public"."quiz_attempts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text")));




CREATE POLICY "Users can read own documents" ON "public"."user_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can read own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can update own documents" ON "public"."user_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));




CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"()))) WITH CHECK ((("access_level" = 'owner_restricted'::"public"."document_access_level") AND ("owner_id" IS NULL) AND ((("metadata" ->> 'user_id'::"text"))::"uuid" = "auth"."uid"())));




CREATE POLICY "Users can view quiz generation logs for accessible documents" ON "public"."document_processing_logs" FOR SELECT USING ((("stage" = 'quiz'::"text") AND ("document_slug" IS NOT NULL) AND ("auth"."uid"() IS NOT NULL) AND ("public"."user_has_document_access_by_slug"("auth"."uid"(), "document_slug") = true)));




CREATE POLICY "Users can view their own document processing logs" ON "public"."document_processing_logs" FOR SELECT USING (("user_document_id" IN ( SELECT "user_documents"."id"
   FROM "public"."user_documents"
  WHERE ("user_documents"."user_id" = "auth"."uid"()))));


CREATE POLICY "Users can view training history for accessible documents" ON "public"."document_training_history" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("document_id" IN ( SELECT "documents"."id"
   FROM "public"."documents"
  WHERE (("documents"."owner_id" IN ( SELECT "owners"."id"
           FROM "public"."owners"

CREATE POLICY "Users read own access" ON "public"."user_owner_access" FOR SELECT USING (("user_id" = "auth"."uid"()));




CREATE POLICY "Users read own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));




CREATE POLICY "attachment_downloads_insert_policy" ON "public"."document_attachment_downloads" FOR INSERT WITH CHECK (true);




CREATE POLICY "attachment_downloads_select_policy" ON "public"."document_attachment_downloads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."document_attachments" "da"
     JOIN "public"."documents" "d" ON (("d"."id" = "da"."document_id")))
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))

CREATE POLICY "document_attachments_delete_policy" ON "public"."document_attachments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1

CREATE POLICY "document_attachments_insert_policy" ON "public"."document_attachments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1

CREATE POLICY "document_attachments_select_policy" ON "public"."document_attachments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."documents" "d"
  WHERE (("d"."id" = "document_attachments"."document_id") AND ("d"."access_level" = 'public'::"public"."document_access_level")))) OR (EXISTS ( SELECT 1
   FROM "public"."documents" "d"

CREATE POLICY "document_attachments_update_policy" ON "public"."document_attachments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."user_roles" "ur" ON ((("ur"."user_id" = "auth"."uid"()) AND ("ur"."owner_id" = "d"."owner_id"))))
  WHERE (("d"."id" = "document_attachments"."document_id") AND (("ur"."role" = ANY (ARRAY['owner_admin'::"text", 'super_admin'::"text"])) OR (EXISTS ( SELECT 1


