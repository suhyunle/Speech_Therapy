#!/usr/bin/env bash
# 말랑말랑 서버 한 번에 세우기 — Ubuntu 22.04/24.04 (Oracle Cloud Always Free ARM 기준, x86도 됨)
# 사용: curl -fsSL https://raw.githubusercontent.com/suhyunle/Speech_Therapy/main/infrastructure/server/setup.sh | bash -s -- 내도메인.duckdns.org
#  또는 저장소를 받은 뒤: bash infrastructure/server/setup.sh 내도메인.duckdns.org
set -euo pipefail
DOMAIN="${1:-}"
REPO="${REPO:-https://github.com/suhyunle/Speech_Therapy.git}"
DIR="${DIR:-$HOME/Speech_Therapy}"

if [ -z "$DOMAIN" ]; then
  IP=$(curl -fsS https://api.ipify.org || true)
  [ -n "$IP" ] || { echo "도메인을 넣어 주세요: bash setup.sh 내도메인.duckdns.org"; exit 1; }
  # 도메인이 없으면 IP로 바로 쓰는 무료 주소 (예: 1-2-3-4.sslip.io)
  DOMAIN="${IP//./-}.sslip.io"
  echo "도메인이 없어 $DOMAIN 를 써요"
fi

echo "== 1. Docker 설치"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
DOCKER="sudo docker"

echo "== 2. 80·443 포트 열기 (Oracle Ubuntu 이미지는 iptables가 기본으로 막아 둠)"
if sudo iptables -L INPUT -n 2>/dev/null | grep -q "REJECT"; then
  for p in 80 443; do sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport $p -j ACCEPT; done
  sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
  (command -v netfilter-persistent >/dev/null && sudo netfilter-persistent save) || true
fi

echo "== 3. 코드 받기"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$DIR"; fi
cd "$DIR"

echo "== 4. 비밀값 만들기 (.env 가 이미 있으면 그대로 둠)"
if [ ! -f .env ]; then
  cp .env.example .env
  set_env() { sed -i "s|^$1=.*|$1=$2|" .env; }
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 16)"
  set_env JWT_SECRET "$(openssl rand -hex 32)"
  set_env RECORDING_KEY "$(openssl rand -base64 32)"
  ADMIN_PW="$(openssl rand -base64 12 | tr -d '/+=')"
  set_env ADMIN_PASSWORD "$ADMIN_PW"
  set_env WEB_ORIGIN "https://$DOMAIN"
  set_env PUBLIC_API_URL "https://$DOMAIN/api"
  set_env OAUTH_REDIRECT_BASE "https://$DOMAIN/auth/callback"
  set_env VAPID_SUBJECT "mailto:admin@$DOMAIN"
  echo "DOMAIN=$DOMAIN" >> .env
  # 웹 푸시 키
  KEYS=$($DOCKER run --rm node:22-bookworm-slim npx -y web-push@3 generate-vapid-keys --json 2>/dev/null || true)
  if [ -n "$KEYS" ]; then
    set_env VAPID_PUBLIC_KEY "$(echo "$KEYS" | sed -E 's/.*"publicKey":"([^"]+)".*/\1/')"
    set_env VAPID_PRIVATE_KEY "$(echo "$KEYS" | sed -E 's/.*"privateKey":"([^"]+)".*/\1/')"
  fi
  chmod 600 .env
  echo "관리자 아이디: admin / 비밀번호: $ADMIN_PW  (.env 에 저장됨, 꼭 따로 적어 두세요)"
  echo "RECORDING_KEY 를 잃어버리면 녹음을 열 수 없어요 → .env 를 안전한 곳에 백업하세요"
fi

echo "== 5. 빌드하고 띄우기 (처음엔 10~20분 걸려요: 음성 인식 모델 받기 포함)"
$DOCKER compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --build

echo "== 끝. 1~2분 뒤 https://$DOMAIN 에서 열려요 (인증서 받는 시간)"
echo "상태: sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
echo "로그: sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api worker"
