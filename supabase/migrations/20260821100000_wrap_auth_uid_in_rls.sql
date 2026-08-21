-- Wrap bare auth.uid() in (select auth.uid()) so Postgres initplans once per query.
-- Generated from live pg_policies; policy names/roles/cmd preserved.

drop policy if exists "Applicants can read own applications" on "public"."applications";
create policy "Applicants can read own applications"
  on "public"."applications"
  for select
  using (((select auth.uid()) = applicant_id));

drop policy if exists "Applicants can submit applications" on "public"."applications";
create policy "Applicants can submit applications"
  on "public"."applications"
  for insert
  with check ((((select auth.uid()) = applicant_id) AND (EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = applications.job_id) AND (jobs.user_id IS DISTINCT FROM (select auth.uid())))))));

drop policy if exists "Job posters can read applications for own jobs" on "public"."applications";
create policy "Job posters can read applications for own jobs"
  on "public"."applications"
  for select
  using ((EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = applications.job_id) AND (jobs.user_id = (select auth.uid()))))));

drop policy if exists "Job posters can update application status" on "public"."applications";
create policy "Job posters can update application status"
  on "public"."applications"
  for update
  using ((EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = applications.job_id) AND (jobs.user_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM jobs
  WHERE ((jobs.id = applications.job_id) AND (jobs.user_id = (select auth.uid()))))));

drop policy if exists "Hirers can read bids on own listings" on "public"."bids";
create policy "Hirers can read bids on own listings"
  on "public"."bids"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM gigs
  WHERE ((gigs.id = bids.listing_id) AND (gigs.user_id = (select auth.uid()))))));

drop policy if exists "Listing owners can update bid status" on "public"."bids";
create policy "Listing owners can update bid status"
  on "public"."bids"
  for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM gigs
  WHERE ((gigs.id = bids.listing_id) AND (gigs.user_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM gigs
  WHERE ((gigs.id = bids.listing_id) AND (gigs.user_id = (select auth.uid()))))));

drop policy if exists "Workers can read own bids" on "public"."bids";
create policy "Workers can read own bids"
  on "public"."bids"
  for select to authenticated
  using (((select auth.uid()) = worker_id));

drop policy if exists "Workers can submit own bids" on "public"."bids";
create policy "Workers can submit own bids"
  on "public"."bids"
  for insert to authenticated
  with check (((select auth.uid()) = worker_id));

drop policy if exists "Users can delete own community comment likes" on "public"."community_comment_likes";
create policy "Users can delete own community comment likes"
  on "public"."community_comment_likes"
  for delete to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own community comment likes" on "public"."community_comment_likes";
create policy "Users can insert own community comment likes"
  on "public"."community_comment_likes"
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can update own community comment likes" on "public"."community_comment_likes";
create policy "Users can update own community comment likes"
  on "public"."community_comment_likes"
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own community comments if not suspended" on "public"."community_comments";
create policy "Users can delete own community comments if not suspended"
  on "public"."community_comments"
  for delete to authenticated
  using ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Users can insert own community comments if not suspended" on "public"."community_comments";
create policy "Users can insert own community comments if not suspended"
  on "public"."community_comments"
  for insert to authenticated
  with check ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Users can update own community comments if not suspended" on "public"."community_comments";
create policy "Users can update own community comments if not suspended"
  on "public"."community_comments"
  for update to authenticated
  using ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))))
  with check ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Users can delete own community post likes" on "public"."community_post_likes";
create policy "Users can delete own community post likes"
  on "public"."community_post_likes"
  for delete to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own community post likes" on "public"."community_post_likes";
create policy "Users can insert own community post likes"
  on "public"."community_post_likes"
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can update own community post likes" on "public"."community_post_likes";
create policy "Users can update own community post likes"
  on "public"."community_post_likes"
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can delete own community posts if not suspended" on "public"."community_posts";
create policy "Users can delete own community posts if not suspended"
  on "public"."community_posts"
  for delete to authenticated
  using ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Users can insert own community posts if not suspended" on "public"."community_posts";
create policy "Users can insert own community posts if not suspended"
  on "public"."community_posts"
  for insert to authenticated
  with check ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Users can update own community posts if not suspended" on "public"."community_posts";
create policy "Users can update own community posts if not suspended"
  on "public"."community_posts"
  for update to authenticated
  using ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))))
  with check ((((select auth.uid()) = user_id) AND (NOT (EXISTS ( SELECT 1
   FROM suspended_users
  WHERE ((suspended_users.user_id = (select auth.uid())) AND ((suspended_users.expires_at IS NULL) OR (suspended_users.expires_at > now()))))))));

drop policy if exists "Admins can read community reports" on "public"."community_reports";
create policy "Admins can read community reports"
  on "public"."community_reports"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = (select auth.uid())) AND ((users.email)::text = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Users can insert own community reports" on "public"."community_reports";
create policy "Users can insert own community reports"
  on "public"."community_reports"
  for insert to authenticated
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "Admins can insert contact replies" on "public"."contact_replies";
create policy "Admins can insert contact replies"
  on "public"."contact_replies"
  for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admins can read contact replies" on "public"."contact_replies";
create policy "Admins can read contact replies"
  on "public"."contact_replies"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admins can delete contact submissions" on "public"."contact_submissions";
create policy "Admins can delete contact submissions"
  on "public"."contact_submissions"
  for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admins can read contact submissions" on "public"."contact_submissions";
create policy "Admins can read contact submissions"
  on "public"."contact_submissions"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admins can update contact submissions" on "public"."contact_submissions";
create policy "Admins can update contact submissions"
  on "public"."contact_submissions"
  for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Buyers can open disputes" on "public"."disputes";
create policy "Buyers can open disputes"
  on "public"."disputes"
  for insert
  with check ((EXISTS ( SELECT 1
   FROM marketplace_orders mo
  WHERE ((mo.id = disputes.order_id) AND (mo.buyer_id = (select auth.uid()))))));

drop policy if exists "Admin can delete contact submissions" on "public"."drew_builds_contacts";
create policy "Admin can delete contact submissions"
  on "public"."drew_builds_contacts"
  for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admin can update contact submissions" on "public"."drew_builds_contacts";
create policy "Admin can update contact submissions"
  on "public"."drew_builds_contacts"
  for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Admin can view contact submissions" on "public"."drew_builds_contacts";
create policy "Admin can view contact submissions"
  on "public"."drew_builds_contacts"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Owners can delete own housing listings" on "public"."housing_listings";
create policy "Owners can delete own housing listings"
  on "public"."housing_listings"
  for delete to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Owners can read own housing listings" on "public"."housing_listings";
create policy "Owners can read own housing listings"
  on "public"."housing_listings"
  for select to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Owners can update own housing listings" on "public"."housing_listings";
create policy "Owners can update own housing listings"
  on "public"."housing_listings"
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own housing listings" on "public"."housing_listings";
create policy "Users can insert own housing listings"
  on "public"."housing_listings"
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "Reporters can read own landlord reports" on "public"."landlord_reports";
create policy "Reporters can read own landlord reports"
  on "public"."landlord_reports"
  for select to authenticated
  using (((select auth.uid()) = reporter_id));

drop policy if exists "Users can insert own landlord reports" on "public"."landlord_reports";
create policy "Users can insert own landlord reports"
  on "public"."landlord_reports"
  for insert to authenticated
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "Users can delete their own listings" on "public"."marketplace_listings";
create policy "Users can delete their own listings"
  on "public"."marketplace_listings"
  for delete
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert their own listings" on "public"."marketplace_listings";
create policy "Users can insert their own listings"
  on "public"."marketplace_listings"
  for insert
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can update their own listings" on "public"."marketplace_listings";
create policy "Users can update their own listings"
  on "public"."marketplace_listings"
  for update
  using (((select auth.uid()) = user_id));

drop policy if exists "Authenticated users can insert orders" on "public"."marketplace_orders";
create policy "Authenticated users can insert orders"
  on "public"."marketplace_orders"
  for insert
  with check (((select auth.uid()) = buyer_id));

drop policy if exists "Buyers and sellers can view their marketplace orders" on "public"."marketplace_orders";
create policy "Buyers and sellers can view their marketplace orders"
  on "public"."marketplace_orders"
  for select
  using ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)));

drop policy if exists "Buyers can create marketplace orders" on "public"."marketplace_orders";
create policy "Buyers can create marketplace orders"
  on "public"."marketplace_orders"
  for insert
  with check (((select auth.uid()) = buyer_id));

drop policy if exists "Participants can update their marketplace orders" on "public"."marketplace_orders";
create policy "Participants can update their marketplace orders"
  on "public"."marketplace_orders"
  for update
  using ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)))
  with check ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)));

drop policy if exists "Users can view their own orders" on "public"."marketplace_orders";
create policy "Users can view their own orders"
  on "public"."marketplace_orders"
  for select
  using ((((select auth.uid()) = buyer_id) OR ((select auth.uid()) = seller_id)));

drop policy if exists "Thread members can read messages" on "public"."messages";
create policy "Thread members can read messages"
  on "public"."messages"
  for select to authenticated
  using ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)));

drop policy if exists "Users can insert own moderation logs" on "public"."moderation_logs";
create policy "Users can insert own moderation logs"
  on "public"."moderation_logs"
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "Admins can read name history" on "public"."name_history";
create policy "Admins can read name history"
  on "public"."name_history"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.email = 'drewnegron95@gmail.com'::text)))));

drop policy if exists "Users can delete own notifications" on "public"."notifications";
create policy "Users can delete own notifications"
  on "public"."notifications"
  for delete to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can read own notifications" on "public"."notifications";
create policy "Users can read own notifications"
  on "public"."notifications"
  for select to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own notifications" on "public"."notifications";
create policy "Users can update own notifications"
  on "public"."notifications"
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "Order members can read orders" on "public"."orders";
create policy "Order members can read orders"
  on "public"."orders"
  for select to authenticated
  using ((((select auth.uid()) = hirer_id) OR ((select auth.uid()) = worker_id)));

drop policy if exists "Workers can mark orders complete" on "public"."orders";
create policy "Workers can mark orders complete"
  on "public"."orders"
  for update to authenticated
  using (((select auth.uid()) = worker_id))
  with check (((select auth.uid()) = worker_id));

drop policy if exists "Users can insert own profile" on "public"."profiles";
create policy "Users can insert own profile"
  on "public"."profiles"
  for insert to authenticated
  with check (((select auth.uid()) = id));

drop policy if exists "Users can update own profile" on "public"."profiles";
create policy "Users can update own profile"
  on "public"."profiles"
  for update to authenticated
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));

drop policy if exists "Users can submit reports" on "public"."reports";
create policy "Users can submit reports"
  on "public"."reports"
  for insert
  with check (((select auth.uid()) = reporter_id));

drop policy if exists "Users can view own reports" on "public"."reports";
create policy "Users can view own reports"
  on "public"."reports"
  for select
  using (((select auth.uid()) = reporter_id));

drop policy if exists "Authenticated users can insert reviews" on "public"."reviews";
create policy "Authenticated users can insert reviews"
  on "public"."reviews"
  for insert to authenticated
  with check ((((select auth.uid()) = reviewer_id) AND (reviewer_id <> reviewee_id) AND ((rating >= 1) AND (rating <= 5)) AND (length(TRIM(BOTH FROM comment)) > 0)));

drop policy if exists "Admins can insert suspended users" on "public"."suspended_users";
create policy "Admins can insert suspended users"
  on "public"."suspended_users"
  for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

drop policy if exists "Admins can read suspended users" on "public"."suspended_users";
create policy "Admins can read suspended users"
  on "public"."suspended_users"
  for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

drop policy if exists "Admins can update suspended users" on "public"."suspended_users";
create policy "Admins can update suspended users"
  on "public"."suspended_users"
  for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

drop policy if exists "Users can view own suspension status" on "public"."suspended_users";
create policy "Users can view own suspension status"
  on "public"."suspended_users"
  for select
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can insert own 2FA codes" on "public"."two_factor_codes";
create policy "Users can insert own 2FA codes"
  on "public"."two_factor_codes"
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can read own 2FA codes" on "public"."two_factor_codes";
create policy "Users can read own 2FA codes"
  on "public"."two_factor_codes"
  for select to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "Users can update own 2FA codes" on "public"."two_factor_codes";
create policy "Users can update own 2FA codes"
  on "public"."two_factor_codes"
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "Users can manage own blocks" on "public"."user_blocks";
create policy "Users can manage own blocks"
  on "public"."user_blocks" to authenticated
  using (((select auth.uid()) = blocker_id))
  with check (((select auth.uid()) = blocker_id));

drop policy if exists "Users can manage own mutes" on "public"."user_mutes";
create policy "Users can manage own mutes"
  on "public"."user_mutes" to authenticated
  using (((select auth.uid()) = muter_id))
  with check (((select auth.uid()) = muter_id));

drop policy if exists "Authenticated can delete own community photos" on "storage"."objects";
create policy "Authenticated can delete own community photos"
  on "storage"."objects"
  for delete to authenticated
  using (((bucket_id = 'community-photos'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Authenticated can update own community photos" on "storage"."objects";
create policy "Authenticated can update own community photos"
  on "storage"."objects"
  for update to authenticated
  using (((bucket_id = 'community-photos'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])))
  with check (((bucket_id = 'community-photos'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Dispute photo reads by order participants" on "storage"."objects";
create policy "Dispute photo reads by order participants"
  on "storage"."objects"
  for select
  using (((bucket_id = 'dispute-photos'::text) AND (is_dispute_admin() OR (EXISTS ( SELECT 1
   FROM marketplace_orders mo
  WHERE (((mo.id)::text = (storage.foldername(objects.name))[1]) AND ((mo.buyer_id = (select auth.uid())) OR (mo.seller_id = (select auth.uid())))))))));

drop policy if exists "Job posters can read applicant resumes" on "storage"."objects";
create policy "Job posters can read applicant resumes"
  on "storage"."objects"
  for select to authenticated
  using (((bucket_id = 'resumes'::text) AND (EXISTS ( SELECT 1
   FROM (applications a
     JOIN jobs j ON ((j.id = a.job_id)))
  WHERE ((j.user_id = (select auth.uid())) AND (a.resume_url = objects.name))))));

drop policy if exists "Users can delete own avatars" on "storage"."objects";
create policy "Users can delete own avatars"
  on "storage"."objects"
  for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can delete own marketplace photos" on "storage"."objects";
create policy "Users can delete own marketplace photos"
  on "storage"."objects"
  for delete
  using (((bucket_id = 'marketplace-photos'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Users can delete own resumes" on "storage"."objects";
create policy "Users can delete own resumes"
  on "storage"."objects"
  for delete to authenticated
  using (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can delete their profile banners cxt0v7_0" on "storage"."objects";
create policy "Users can delete their profile banners cxt0v7_0"
  on "storage"."objects"
  for delete to authenticated
  using (((bucket_id = 'profile-banners'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Users can delete their profile banners cxt0v7_1" on "storage"."objects";
create policy "Users can delete their profile banners cxt0v7_1"
  on "storage"."objects"
  for select to authenticated
  using (((bucket_id = 'profile-banners'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Users can read own resume" on "storage"."objects";
create policy "Users can read own resume"
  on "storage"."objects"
  for select to authenticated
  using (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can read own resumes" on "storage"."objects";
create policy "Users can read own resumes"
  on "storage"."objects"
  for select to authenticated
  using (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can update own avatars" on "storage"."objects";
create policy "Users can update own avatars"
  on "storage"."objects"
  for update to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)))
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can update own resumes" on "storage"."objects";
create policy "Users can update own resumes"
  on "storage"."objects"
  for update to authenticated
  using (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)))
  with check (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can upload housing images" on "storage"."objects";
create policy "Users can upload housing images"
  on "storage"."objects"
  for insert
  with check (((bucket_id = 'housing-images'::text) AND ((select auth.uid()) IS NOT NULL)));

drop policy if exists "Users can upload own avatars" on "storage"."objects";
create policy "Users can upload own avatars"
  on "storage"."objects"
  for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can upload own profile banners cxt0v7_0" on "storage"."objects";
create policy "Users can upload own profile banners cxt0v7_0"
  on "storage"."objects"
  for insert to authenticated
  with check (((bucket_id = 'profile-banners'::text) AND (((select auth.uid()))::text = (storage.foldername(name))[1])));

drop policy if exists "Users can upload own resume" on "storage"."objects";
create policy "Users can upload own resume"
  on "storage"."objects"
  for insert to authenticated
  with check (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

drop policy if exists "Users can upload own resumes" on "storage"."objects";
create policy "Users can upload own resumes"
  on "storage"."objects"
  for insert to authenticated
  with check (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));

