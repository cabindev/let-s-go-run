#!/usr/bin/env bash
# deploy runludtong.com บน Plesk VPS — รันด้วย root บนเซิร์ฟเวอร์ (ดู DEPLOY.md)
#
#   bash /var/www/vhosts/runludtong.com/httpdocs/scripts/deploy-plesk.sh           deploy จริง
#   bash /var/www/vhosts/runludtong.com/httpdocs/scripts/deploy-plesk.sh --check   ตรวจอย่างเดียว ไม่แก้อะไร
#
# ขั้นตอน: Plesk Git ดึงโค้ดจาก GitHub ลง httpdocs → npm ci → prisma migrate deploy → npm run build → รีสตาร์ท Passenger
# ค่า env (DATABASE_URL, Stripe, Google ฯลฯ) อยู่ใน Plesk (Node.js → Custom environment variables)
# สคริปต์อ่านจาก config ของ Plesk ตอนรัน — ไม่เก็บลงไฟล์ถาวรและไม่พิมพ์ค่าออกมา
set -euo pipefail

DOMAIN=runludtong.com
REPO=let-s-go-run
APP=/var/www/vhosts/$DOMAIN/httpdocs
CONF=/var/www/vhosts/system/$DOMAIN/conf/nginx.conf
NODE_BIN=/opt/plesk/node/26/bin
CHECK=${1:-}

[ "$(id -u)" = 0 ] || { echo "ต้องรันด้วย root"; exit 1; }
APP_USER=$(stat -c %U "$APP")

# env ของแอปจาก Plesk → ไฟล์ชั่วคราวสิทธิ์ 600 ของ user แอป (ลบทิ้งตอนจบเสมอ)
ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
python3 - "$CONF" > "$ENV_FILE" <<'PY'
import re, shlex, sys
seen = {}
for k, v in re.findall(r'passenger_env_var "([A-Z0-9_]+)" "((?:[^"\\]|\\.)*)";', open(sys.argv[1]).read()):
    seen[k] = v.replace('\\"', '"').replace("\\\\", "\\")
for k, v in seen.items():
    print(f"export {k}={shlex.quote(v)}")
PY
chmod 600 "$ENV_FILE"
chown "$APP_USER" "$ENV_FILE"
echo "env จาก Plesk: $(grep -c '^export ' "$ENV_FILE") ตัว"

# คำสั่งที่รันในฐานะ user ของแอป (ไม่ใช่ root — ไฟล์ที่สร้างต้องเป็นของ user ที่ Passenger ใช้)
as_app() {
    su -s /bin/bash "$APP_USER" -c "set -a; . '$ENV_FILE'; set +a
        export PATH=$NODE_BIN:\$PATH
        # IPv6 ของ VPS ใช้ไม่ได้เป็นบางช่วง (เช่นหลังรีบูต) — ให้ npm/node ต่อผ่าน IPv4
        export NODE_OPTIONS=--dns-result-order=ipv4first
        cd '$APP' && $1"
}

echo "== ดึงโค้ดล่าสุดจาก GitHub"
plesk ext git --fetch -domain "$DOMAIN" -name "$REPO" >/dev/null
echo "commit ล่าสุดบน GitHub: $(plesk ext git --get-last-commit -domain "$DOMAIN" -name "$REPO" 2>/dev/null | head -1)"

if [ "$CHECK" = "--check" ]; then
    echo "== ตรวจ migration ที่ค้าง (ของโค้ดที่อยู่ใน httpdocs ตอนนี้)"
    as_app "npx prisma migrate status 2>&1 | tail -4" || true
    echo "== --check: ไม่ได้แก้อะไร"
    exit 0
fi

echo "== คัดลอกโค้ดลง httpdocs"
plesk ext git --deploy -domain "$DOMAIN" -name "$REPO" >/dev/null

echo "== npm ci"
as_app "npm ci --no-audit --no-fund 2>&1 | tail -2"

echo "== prisma migrate deploy"
as_app "npx prisma migrate deploy 2>&1 | tail -3"

echo "== build"
as_app "npm run build 2>&1 | tail -5"

echo "== รีสตาร์ท"
as_app "mkdir -p tmp && touch tmp/restart.txt"

sleep 3
CODE=$(curl -s -m 30 -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
echo "deploy เสร็จ — https://$DOMAIN ตอบ $CODE"
[ "$CODE" = 200 ]
