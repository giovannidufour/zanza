#!/usr/bin/env bash
# Renders one video_jobs row (decision 0195), run by ../workflows/render-video.yml.
# Each part = one photo (centre square, 1080, still) for exactly the length of its sample; parts end to end with a
# hard cut (A+B, 0191). H.264 30 fps (stillimage tune) + AAC 192 kbps 48 kHz stereo, faststart.
set -euo pipefail
[[ "$JOB_ID" =~ ^[0-9a-f-]{36}$ ]] || { echo "bad job id"; exit 1; }
work=$(mktemp -d)

token() { curl -fsS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=render-video" | jq -r .value; }
call() { curl -fsS -X POST "$FUNCTION_URL" -H "Authorization: Bearer $(token)" -H 'Content-Type: application/json' -d "$1"; }
fail() { call "$(jq -n --arg id "$JOB_ID" --arg e "$1" '{job_id:$id, action:"failed", error:$e}')" >/dev/null || true; echo "$1"; exit 1; }
trap 'fail "render stopped at line $LINENO"' ERR

start=$(call "$(jq -n --arg id "$JOB_ID" '{job_id:$id, action:"start"}')")
n=$(jq '.parts | length' <<<"$start")
inputs=(); filter=""; joins=""
for ((i = 0; i < n; i++)); do
  curl -fsS -o "$work/a$i" "$(jq -r ".parts[$i].audio" <<<"$start")" || fail "could not read sample $((i + 1))"
  curl -fsS -o "$work/i$i" "$(jq -r ".parts[$i].image" <<<"$start")" || fail "could not read photo $((i + 1))"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$work/a$i")
  inputs+=(-loop 1 -framerate 30 -t "$d" -i "$work/i$i" -i "$work/a$i")
  filter+="[$((2 * i)):v]crop='min(iw,ih)':'min(iw,ih)',scale=1080:1080:flags=lanczos,setsar=1,format=yuv420p,trim=duration=$d,setpts=PTS-STARTPTS[v$i];"
  filter+="[$((2 * i + 1)):a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a$i];"
  joins+="[v$i][a$i]"
done
filter+="${joins}concat=n=$n:v=1:a=1[v][a]"
ffmpeg -nostdin -loglevel error -y "${inputs[@]}" -filter_complex "$filter" -map '[v]' -map '[a]' \
  -c:v libx264 -preset veryfast -tune stillimage -crf 18 -r 30 -g 60 -c:a aac -b:a 192k -movflags +faststart "$work/out.mp4" \
  || fail "ffmpeg could not make the video"
curl -fsS -X PUT -H 'Content-Type: video/mp4' --data-binary @"$work/out.mp4" "$(jq -r .upload_url <<<"$start")" >/dev/null || fail "could not upload the video"
trap - ERR
call "$(jq -n --arg id "$JOB_ID" --arg k "$(jq -r .video_key <<<"$start")" '{job_id:$id, action:"done", video_key:$k}')" >/dev/null
echo "done: $(jq -r .video_key <<<"$start")"
