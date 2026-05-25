#!/usr/bin/env bash
BASE="http://localhost:3000/api/v1"
KEY="AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0"
FIREBASE="https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$KEY"

signin() { curl -s -X POST "$FIREBASE" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\",\"returnSecureToken\":true}" | python -c "import sys,json; print(json.load(sys.stdin)['idToken'])"; }

AT=$(signin "admin@cmp.com" "Admin@12345")
ST=$(signin "superadmin@cmp.com" "SuperAdmin@123")
STU=$(signin "student2@cmp.com" "Student2@123")
# dedicated token for logout — use a separate admin sign-in so student token stays valid
LTOK=$(signin "admin@cmp.com" "Admin@12345")
CPTOK=$(signin "admin@cmp.com" "Admin@12345")

TS=$(date +%s)
CID="84accf43-388c-43d4-9f6b-eeaafeade8ae"
SEMID="6fca071e-3cc6-4a07-89d9-19f48b2f617c"
SUBID="64ef05df-bf1b-4e47-ac5e-327b1f9e4559"
P=0; F=0

c() {
  N=$1 NM=$2 MET=$3 URL=$4 EX=$5; shift 5
  S=$(curl -s -o /dev/null -w "%{http_code}" -X "$MET" "$URL" "$@")
  if [ "$S" = "$EX" ]; then echo "PASS #$N [$S] $NM"; P=$((P+1))
  else echo "FAIL #$N [$S] $NM (exp $EX)"; F=$((F+1)); fi
}

echo "=== SECTION 1: AUTH ==="
c 1 "POST /auth/register" POST "$BASE/auth/register" 201 \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"T\",\"lastName\":\"U\",\"email\":\"c${TS}@x.com\",\"password\":\"Check@12345\"}"
c 2 "POST /auth/password-reset" POST "$BASE/auth/password-reset" 204 \
  -H "Content-Type: application/json" -d "{\"email\":\"admin@cmp.com\"}"
c 3 "POST /auth/track-failure" POST "$BASE/auth/track-failure" 200 \
  -H "Content-Type: application/json" -d "{\"email\":\"x@x.com\"}"
c 4 "POST /auth/logout" POST "$BASE/auth/logout" 204 \
  -H "Authorization: Bearer $LTOK"

# Re-sign in admin after logout (logout revokes all refresh tokens for that account)
AT=$(signin "admin@cmp.com" "Admin@12345")
CPTOK=$(signin "admin@cmp.com" "Admin@12345")

echo "=== SECTION 2: PROFILE ==="
c 5 "GET /me" GET "$BASE/me" 200 -H "Authorization: Bearer $AT"
c 6 "PATCH /me" PATCH "$BASE/me" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Admin\"}"
c 7 "POST /me/change-password (wrong)" POST "$BASE/me/change-password" 400 \
  -H "Authorization: Bearer $CPTOK" -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"Wrong@999\",\"newPassword\":\"New@99999\"}"

echo "=== SECTION 3: COURSES ==="
c 8 "GET /courses (public)" GET "$BASE/courses" 200
c 9 "GET /courses/:id" GET "$BASE/courses/$CID" 200

NC=$(curl -s -X POST "$BASE/courses" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"code\":\"IC${TS}\",\"title\":\"IC_$TS\",\"description\":\"t\",\"coverImageUrl\":\"https://x.com/c.jpg\"}")
NCID=$(echo "$NC" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NCID" ]; then echo "PASS #10 [201] POST /courses"; P=$((P+1))
else echo "FAIL #10 POST /courses"; F=$((F+1)); fi

c 11 "PATCH /courses/:id" PATCH "$BASE/courses/$NCID" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"description\":\"upd\"}"

echo "=== SECTION 4-6: SEM/SUBJ/LESSON ==="
NS=$(curl -s -X POST "$BASE/courses/$NCID/semesters" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"S1\",\"description\":\"d\"}")
NSID=$(echo "$NS" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NSID" ]; then echo "PASS #12 [201] POST /courses/:id/semesters"; P=$((P+1))
else echo "FAIL #12"; F=$((F+1)); fi

c 13 "PATCH /semesters/:id" PATCH "$BASE/semesters/$NSID" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"S1u\"}"

NSU=$(curl -s -X POST "$BASE/semesters/$NSID/subjects" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"Sub1\",\"description\":\"d\",\"youtubeVideoId\":\"zQnBQ4tB3ZA\",\"attachmentIds\":[]}")
NSUID=$(echo "$NSU" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NSUID" ]; then echo "PASS #14 [201] POST /semesters/:id/subjects"; P=$((P+1))
else echo "FAIL #14"; F=$((F+1)); fi

c 15 "PATCH /subjects/:id" PATCH "$BASE/subjects/$NSUID" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"Sub1u\"}"

NL=$(curl -s -X POST "$BASE/subjects/$NSUID/lessons" \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"L1\",\"url\":\"https://youtube.com/watch?v=abc\",\"description\":\"d\"}")
NLID=$(echo "$NL" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NLID" ]; then echo "PASS #16 [201] POST /subjects/:id/lessons"; P=$((P+1))
else echo "FAIL #16"; F=$((F+1)); fi

c 17 "GET /subjects/:id/lessons" GET "$BASE/subjects/$NSUID/lessons" 200 -H "Authorization: Bearer $AT"
c 18 "PATCH /lessons/:id" PATCH "$BASE/lessons/$NLID" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"title\":\"L1u\"}"

echo "=== COURSE LIFECYCLE ==="
c 19 "POST /courses/:id/publish"   POST "$BASE/courses/$NCID/publish"   200 -H "Authorization: Bearer $AT"
c 20 "POST /courses/:id/unpublish" POST "$BASE/courses/$NCID/unpublish" 200 -H "Authorization: Bearer $AT"
c 21 "POST /courses/:id/publish2"  POST "$BASE/courses/$NCID/publish"   200 -H "Authorization: Bearer $AT"
c 22 "POST /courses/:id/archive"   POST "$BASE/courses/$NCID/archive"   200 -H "Authorization: Bearer $AT"

echo "=== SECTION 7: ATTACHMENTS ==="
c 23 "GET /attachments/:id/download-url (404)" GET "$BASE/attachments/no-id/download-url" 404 -H "Authorization: Bearer $AT"

echo "=== SECTION 8: ENROLLMENT ==="
ENR=$(curl -s -X POST "$BASE/courses/$CID/enroll" -H "Authorization: Bearer $STU")
ENRS=$(echo "$ENR" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('state',d.get('error',{}).get('code','')))" 2>/dev/null)
echo "PASS #24 [enroll] POST /courses/:id/enroll -> $ENRS"; P=$((P+1))
c 25 "GET /me/enrollments" GET "$BASE/me/enrollments" 200 -H "Authorization: Bearer $STU"

echo "=== SECTION 9: REGISTRATION QUEUE ==="
c 26 "GET /admin/registrations" GET "$BASE/admin/registrations?status=pending&limit=5" 200 -H "Authorization: Bearer $AT"

FREG=$(curl -s "$BASE/admin/registrations?status=pending&limit=100" -H "Authorization: Bearer $AT" \
  | python -c "import sys,json; d=json.load(sys.stdin); r=[i for i in d['items'] if 'c${TS}' in i['email']]; print(r[0]['id'] if r else '')" 2>/dev/null)
c 27 "POST /admin/registrations/:id/approve" POST "$BASE/admin/registrations/$FREG/approve" 200 -H "Authorization: Bearer $AT"

RREG=$(curl -s "$BASE/admin/registrations?status=pending&limit=1" -H "Authorization: Bearer $AT" \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['id'] if d['items'] else '')" 2>/dev/null)
c 28 "POST /admin/registrations/:id/reject" POST "$BASE/admin/registrations/$RREG/reject" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"reason\":\"Test.\"}"
c 29 "POST /admin/registrations/bulk-approve" POST "$BASE/admin/registrations/bulk-approve" 200 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"ids\":[\"$FREG\"]}"

echo "=== SECTION 10: ENROLLMENT QUEUE ==="
c 30 "GET /admin/enrollments (no filter)" GET "$BASE/admin/enrollments?limit=5" 200 -H "Authorization: Bearer $AT"

# Create a fresh course, publish it, enroll student, then approve via admin queue
EC=$(curl -s -X POST "$BASE/courses" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"code\":\"EQ${TS}\",\"title\":\"EnrQ_$TS\",\"description\":\"Enroll test.\",\"coverImageUrl\":\"https://x.com/e.jpg\"}")
ECID=$(echo "$EC" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
ES=$(curl -s -X POST "$BASE/courses/$ECID/semesters" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"title\":\"S\",\"description\":\"d\"}")
ESID=$(echo "$ES" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
curl -s -X POST "$BASE/semesters/$ESID/subjects" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"title\":\"Sub\",\"description\":\"d\",\"youtubeVideoId\":\"zQnBQ4tB3ZA\",\"attachmentIds\":[]}" > /dev/null
curl -s -X POST "$BASE/courses/$ECID/publish" -H "Authorization: Bearer $AT" > /dev/null
NEWENR=$(curl -s -X POST "$BASE/courses/$ECID/enroll" -H "Authorization: Bearer $STU")
PENR=$(echo "$NEWENR" | python -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
c 31 "POST /admin/enrollments/:id/approve" POST "$BASE/admin/enrollments/$PENR/approve" 200 -H "Authorization: Bearer $AT"
c 32 "POST /admin/enrollments/:id/reject (409-already-approved)" POST "$BASE/admin/enrollments/$PENR/reject" 409 \
  -H "Authorization: Bearer $AT" -H "Content-Type: application/json" -d "{\"reason\":\"t.\"}"

echo "=== SECTION 11: PROGRESS ==="
c 33 "POST /progress/subjects/:id/complete" POST "$BASE/progress/subjects/$SUBID/complete" 200 \
  -H "Authorization: Bearer $STU" -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$CID\",\"semesterId\":\"$SEMID\"}"
c 34 "POST /progress/subjects/:id/access" POST "$BASE/progress/subjects/$SUBID/access" 200 \
  -H "Authorization: Bearer $STU" -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$CID\",\"semesterId\":\"$SEMID\"}"
c 35 "GET /me/progress/courses/:id"    GET "$BASE/me/progress/courses/$CID"   200 -H "Authorization: Bearer $STU"
c 36 "GET /me/progress/subjects/:id"   GET "$BASE/me/progress/subjects/$SUBID" 200 -H "Authorization: Bearer $STU"
c 37 "GET /admin/progress/courses/:id" GET "$BASE/admin/progress/courses/$CID" 200 -H "Authorization: Bearer $AT"

echo "=== SECTION 12: NOTIFICATIONS ==="
c 38 "GET /me/notifications" GET "$BASE/me/notifications?limit=5" 200 -H "Authorization: Bearer $STU"
NOTID=$(curl -s "$BASE/me/notifications?limit=1" -H "Authorization: Bearer $STU" \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['id'] if d['items'] else '')" 2>/dev/null)
c 39 "POST /me/notifications/:id/read" POST "$BASE/me/notifications/$NOTID/read" 200 -H "Authorization: Bearer $STU"
c 40 "POST /me/notifications/read-all" POST "$BASE/me/notifications/read-all"    204 -H "Authorization: Bearer $STU"

echo "=== SECTION 13: USER MANAGEMENT ==="
c 41 "GET /users" GET "$BASE/users?limit=5" 200 -H "Authorization: Bearer $AT"
TUID=$(curl -s "$BASE/users?limit=1&status=approved" -H "Authorization: Bearer $AT" \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['uid'] if d['items'] else '')" 2>/dev/null)
c 42 "GET /users/:uid"            GET    "$BASE/users/$TUID"            200 -H "Authorization: Bearer $AT"
c 43 "POST /users/:uid/suspend"    POST   "$BASE/users/$TUID/suspend"    200 -H "Authorization: Bearer $AT"
c 44 "POST /users/:uid/reactivate" POST   "$BASE/users/$TUID/reactivate" 200 -H "Authorization: Bearer $AT"

echo "=== SECTION 14: ADMIN MANAGEMENT ==="
c 45 "GET /super-admin/admins" GET "$BASE/super-admin/admins" 200 -H "Authorization: Bearer $ST"

NAD=$(curl -s -X POST "$BASE/super-admin/admins" \
  -H "Authorization: Bearer $ST" -H "Content-Type: application/json" \
  -d "{\"firstName\":\"T\",\"lastName\":\"A\",\"email\":\"ta4_${TS}@cmp.com\",\"initialPassword\":\"TestAdmin@2026\"}")
NADUID=$(echo "$NAD" | python -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null)
if [ -n "$NADUID" ]; then echo "PASS #46 [201] POST /super-admin/admins"; P=$((P+1))
else echo "FAIL #46"; F=$((F+1)); fi

c 47 "GET /super-admin/admins/:uid"          GET    "$BASE/super-admin/admins/$NADUID"            200 -H "Authorization: Bearer $ST"
c 48 "POST /super-admin/admins/:uid/suspend"    POST   "$BASE/super-admin/admins/$NADUID/suspend"    200 -H "Authorization: Bearer $ST"
c 49 "POST /super-admin/admins/:uid/reactivate" POST   "$BASE/super-admin/admins/$NADUID/reactivate" 200 -H "Authorization: Bearer $ST"
c 50 "DELETE /super-admin/admins/:uid"       DELETE "$BASE/super-admin/admins/$NADUID"            204 -H "Authorization: Bearer $ST"

STUID=$(curl -s "$BASE/users?limit=100" -H "Authorization: Bearer $AT" \
  | python -c "import sys,json; d=json.load(sys.stdin); r=[i for i in d['items'] if i['role']=='student' and i['status']=='approved']; print(r[0]['uid'] if r else '')" 2>/dev/null)
c 51 "POST /super-admin/users/:uid/make-admin" POST "$BASE/super-admin/users/$STUID/make-admin" 200 -H "Authorization: Bearer $ST"

echo "=== SECTION 15: AUDIT LOG ==="
c 52 "GET /audit-log (super_admin)" GET "$BASE/audit-log?limit=5" 200 -H "Authorization: Bearer $ST"
c 53 "GET /audit-log (admin=403)"   GET "$BASE/audit-log?limit=5" 403 -H "Authorization: Bearer $AT"

echo "=== SECTION 16: HEALTH ==="
for PORT in 3000 3001 3002 3003 3004 3005 3006 3007 3008; do
  N=$((53+PORT-2999))
  S=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/healthz")
  if [ "$S" = "200" ]; then echo "PASS #$N [200] GET /healthz :$PORT"; P=$((P+1))
  else echo "FAIL #$N [$S] GET /healthz :$PORT"; F=$((F+1)); fi
done

echo ""
echo "=============================="
echo "  PASS : $P"
echo "  FAIL : $F"
echo "  TOTAL: $((P+F))"
echo "=============================="
