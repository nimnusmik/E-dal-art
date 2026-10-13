#!/bin/zsh
# 생성 결과물 전부를 ref/exhibition/ 한 폴더에 평평하게 모은다 (전시·큐레이션용).
# 원본은 제자리에 두고 하드링크로 비춘다 — 용량 0, 몇 번을 다시 돌려도 안전.
# 새 배치를 뽑은 뒤 `npm run exhibit` 한 번이면 끝.
set -e
cd "$(dirname "$0")/.."
OUT=ref/exhibition
mkdir -p "$OUT"
find ref/results -type f \( -iname '*.jpg' -o -iname '*.png' -o -iname '*.webp' \) \
  ! -path '*input*' ! -iname 'compare-*' ! -iname 'contact-sheet*' | while read -r f; do
  # 경로 → 파일명: ref/results/pilot-coquette/set-01.jpg → pilot-coquette__set-01.jpg
  name=$(echo "${f#ref/results/}" | tr '/' '~' | sed 's/~/__/g')
  [ -e "$OUT/$name" ] || ln "$f" "$OUT/$name"
done
echo "$(ls "$OUT" | wc -l | tr -d ' ')장 → $OUT"
