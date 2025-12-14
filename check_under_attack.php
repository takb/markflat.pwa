<?php
header('Content-Type: text/plain');
$lock_file = __DIR__ . '/under_attack';
$cf_zone = "be8b5ff3e3cb676840a2be26c19adef5";
$cf_token = "dhrz4Q7Pj1p2hCfDkd7p888w0wsULtmlTRNW3WM8";
$start_ts = date("c", strtotime("-1 day"));
$end_ts = date("c");
$limit = 1000;
$query = '{
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
        "zoneTag": "' . $cf_zone . '",
        "start": "' . $start_ts . '",
        "end": "' . $end_ts . '"
    }
}';
// replace line breaks and tabs with spaces
$query = str_replace("\n", " ", $query);
$query = str_replace("\r", " ", $query);
$query = str_replace("\t", " ", $query);
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://api.cloudflare.com/client/v4/graphql");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $query);
$headers = array();
$headers[] = "Content-Type: application/json";
$headers[] = "Authorization: Bearer " . $cf_token;
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
} else {
    $data = json_decode($result, true);
    if (isset($data['errors']) && count($data['errors']) > 0) {
        echo "GraphQL errors occurred:\n";
        foreach ($data['errors'] as $error) {
            echo "- " . $error['message'] . "\n";
        }
        echo $query;
    } else {
        $uniques = $data['data']['viewer']['zones'][0]['httpRequests1hGroups'][0]['uniq']['uniques'];
        $output = "Current: " . $uniques . ", limit: " . $limit;
        if ($uniques > $limit) {
            echo "UNDER ATTACK ";
            if (!file_exists($lock_file)) {
                $ch2 = curl_init();
                curl_setopt($ch2, CURLOPT_URL, "https://api.cloudflare.com/client/v4/zones/" . $cf_zone . "/settings/security_level");
                curl_setopt($ch2, CURLOPT_RETURNTRANSFER, 1);
                curl_setopt($ch2, CURLOPT_CUSTOMREQUEST, "PATCH");
                $headers2 = array();
                $headers2[] = "Content-Type: application/json";
                $headers2[] = "Authorization: Bearer " . $cf_token;
                curl_setopt($ch2, CURLOPT_HTTPHEADER, $headers2);
                $data2 = '{"value":"under_attack"}';
                curl_setopt($ch2, CURLOPT_POSTFIELDS, $data2);
                $result2 = curl_exec($ch2);
                if (curl_errno($ch2)) {
                    echo 'Error:' . curl_error($ch2);
                } else {
                    $data2 = json_decode($result2, true);
                    if (isset($data2["errors"]) && count($data2["errors"]) > 0) {
                        echo "Error enabling Under Attack mode:\n";
                        echo $result2 . "\n";
                    }
                    file_put_contents($lock_file, date("c"));
                }
                curl_close($ch2);
            }
            $to = 'takara.baumbach@gmx.de';
            $subject = 'Under Attack mode enabled';
            $message = $output;
            $headers = 'From: KofK alert system' . "\r\n" .
                       'Reply-To: no-reply@kingdomofknuffel.com' . "\r\n" .
                       'X-Mailer: PHP/' . phpversion();
            mail($to, $subject, $message, $headers);
        } else {
            if (file_exists($lock_file)) {
                $ch2 = curl_init();
                curl_setopt($ch2, CURLOPT_URL, "https://api.cloudflare.com/client/v4/zones/" . $cf_zone . "/settings/security_level");
                curl_setopt($ch2, CURLOPT_RETURNTRANSFER, 1);
                curl_setopt($ch2, CURLOPT_CUSTOMREQUEST, "PATCH");
                $headers2 = array();
                $headers2[] = "Content-Type: application/json";
                $headers2[] = "Authorization: Bearer " . $cf_token;
                curl_setopt($ch2, CURLOPT_HTTPHEADER, $headers2);
                $data2 = '{"value":"essentially_off"}';
                curl_setopt($ch2, CURLOPT_POSTFIELDS, $data2);
                $result2 = curl_exec($ch2);
                if (curl_errno($ch2)) {
                    echo 'Error:' . curl_error($ch2);
                } else {
                    $data2 = json_decode($result2, true);
                    if (isset($data2["errors"]) && count($data2["errors"]) > 0) {
                        echo "Error disabling Under Attack mode:\n";
                        echo $result2 . "\n";
                    }
                    unlink($lock_file);
                }
                curl_close($ch2);
            }
        }
        echo $output . ", status: " . (file_exists($lock_file) ? "UNDER ATTACK" : "normal") . "\n";
    }
}
curl_close($ch);
?>
