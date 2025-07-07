<?php
/* Handle CORS */

// Specify domains from which requests are allowed
header('Access-Control-Allow-Origin: *');

// Specify which request methods are allowed
header('Access-Control-Allow-Methods: PUT, GET, POST, DELETE, OPTIONS');

// Additional headers which may be sent along with the CORS request
header('Access-Control-Allow-Headers: Access-Control-Allow-Origin,Origin,X-Requested-With,Authorization,Content-Type,Accept');

// Set the age to 1 day to improve speed/caching.
header('Access-Control-Max-Age: 1');

// Exit early so the page isn't fully loaded for options requests
if (strtolower($_SERVER['REQUEST_METHOD']) == 'options') {
    exit();
}

$store_filename = $_POST['store'] ?? '';
$delete_filename = $_POST['delete'] ?? '';
$key = $_POST['key'] ?? '';
$content = $_POST['content'] ?? '';
$READ_KEY = '$2y$12$GwYjJ3rqN5x7VhMSqvymIedFVpOitwi/Ek1sSmuUuJw9WmKfozo..';
$WRITE_KEY = '$2y$12$1eWJ73da29FN03VRzfXEqO5a2FcsEFQVjksRhCP8sdx36cu5X8LT2';

$ret = ['status' => 'error', 'title' => 'Invalid API call', 'message' => 'No action taken.'. $store_filename . ' ' . $delete_filename . ' ' . $key . ' ' . $content];
if ($store_filename && $content && password_verify($key, $WRITE_KEY)) {
    if (file_put_contents('./mb/'.$store_filename, $content)) {
        $ret = array(
            'status' => 'success',
            'title' => 'Song saved successfully',
            'message' => 'Successfully saved ' . $store_filename . '.',
        );
    } else {
        $ret = array(
            'status' => 'error',
            'title' => 'Error saving file',
            'message' => 'Could not save song file ' . $store_filename . '.',
        );
    }
} elseif ($delete_filename && password_verify($key, $WRITE_KEY)) {
    if (file_exists('./mb/'.$delete_filename)) {
        if (unlink('./mb/'.$delete_filename)) {
            $ret = array(
                'status' => 'success',
                'message' => 'Song deleted successfully.',
            );
        } else {
            $ret = array(
                'status' => 'error',
                'message' => 'Could not delete song file.',
            );
        }
    } else {
        $ret = array(
            'status' => 'error',
            'message' => 'Song file does not exist.',
        );
    }
    exit();
} elseif (password_verify($key, $READ_KEY) && $handle = opendir('./mb')) {
    $ret = array();
    while (false !== ($entry = readdir($handle))) {
        $finfo = pathinfo($entry);
        if ($finfo['extension'] == "mb") {
            $md = file_get_contents('./mb/'.$entry);
            if (preg_match('/#(.+?) - (.+?)( \(.+?\))?\R.*/us', $md, $content) || true) {
                array_push($ret, array(
                    'title' => trim($content[1]),
                    'artist' => trim($content[2]),
                    'md' => $md,
                ));
            } else {
                echo $md;
            }
        }
    }
    closedir($handle);
}
echo json_encode($ret);
?>
