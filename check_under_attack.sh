#!/bin/bash
cf_zone="be8b5ff3e3cb676840a2be26c19adef5"
cf_token="dhrz4Q7Pj1p2hCfDkd7p888w0wsULtmlTRNW3WM8"
limit=1000

if [[ $(
  echo '{
      "query": "query HourlyUniques($zoneTag: string, $start: Time, $end: Time) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1hGroups(limit:1, filter: {datetime_gt:$start, datetime_leq:$end}, orderBy: [datetime_DESC]) {
              uniq {uniques}
              dimensions{datetime}
            }
          }
        }
      }",
      "variables": {
        "zoneTag": "'"$cf_zone"'",
        "start": "'"$(date -u -d "yesterday" +"%Y-%m-%dT%H:%M:%SZ")"'",
        "end": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"
      }
    }' \
    | tr -d '\n' \
    | curl --silent "https://api.cloudflare.com/client/v4/graphql" -H "Authorization: Bearer $cf_token" -H "Content-Type: application/json" --data @- \
    | jq '.data.viewer.zones[0].httpRequests1hGroups[0].uniq.uniques'
  ) -gt $limit ]]
then
  if ! [ -f "under_attack" ]; then
    touch under_attack
    echo "$(date): Enabling Under Attack mode on Cloudflare."
  curl --silent -X PATCH "https://api.cloudflare.com/client/v4/zones/$cf_zone/settings/security_level" \
    -H "Authorization: Bearer $cf_token" \
    -H "Content-Type: application/json" \
    --data '{"value":"under_attack"}'
  fi
else
  if [ -f "under_attack" ]; then
    sleep 1
    rm under_attack
    echo "$(date): Disabling Under Attack mode on Cloudflare."
  curl --silent -X PATCH "https://api.cloudflare.com/client/v4/zones/$cf_zone/settings/security_level" \
    -H "Authorization: Bearer $cf_token" \
    -H "Content-Type: application/json" \
    --data '{"value":"essentially_off"}'
  fi
fi
