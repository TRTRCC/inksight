#include "storage.h"
#include "config.h"
#include <LittleFS.h>
#include <ArduinoJson.h>

static bool fsReady = false;

static void ensureFS() {
    if (fsReady) return;
    if (!LittleFS.begin()) {
        Serial.println("[FS] LittleFS mount failed");
        fsReady = false;
        return;
    }
    fsReady = true;
}

// Config version — bump when schema changes
static const int CONFIG_VERSION = 1;

// ── Runtime config variables ────────────────────────────────
String cfgSSID;
String cfgPass;
String cfgServer;
int    cfgSleepMin;
String cfgConfigJson;
String cfgDeviceToken;
String cfgPendingPairCode;

// ── Load config from LittleFS ─────────────────────────────────

void loadConfig() {
    ensureFS();

    cfgSSID = "";
    cfgPass = "";
    cfgServer = DEFAULT_SERVER;
    cfgSleepMin = 60;
    cfgConfigJson = "";
    cfgDeviceToken = "";
    cfgPendingPairCode = "";

    if (!fsReady) {
        Serial.println("[FS] No config file, using defaults");
        return;
    }

    File file = LittleFS.open("/config.json", "r");
    if (!file) {
        Serial.println("[FS] No config file, using defaults");
        return;
    }

    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, file);
    file.close();

    if (err) {
        Serial.printf("[FS] JSON parse error: %s\n", err.c_str());
        return;
    }

    int version = doc["cfg_version"] | 0;
    if (version != CONFIG_VERSION) {
        Serial.printf("[FS] Config version mismatch (%d != %d), using defaults\n",
                      version, CONFIG_VERSION);
        return;
    }

    cfgSSID         = doc["ssid"] | "";
    cfgPass         = doc["pass"] | "";
    cfgServer       = doc["server"] | DEFAULT_SERVER;
    cfgSleepMin     = doc["sleep_min"] | 60;
    cfgConfigJson   = doc["config_json"] | "";
    cfgDeviceToken  = doc["device_token"] | "";
    cfgPendingPairCode = doc["pair_code"] | "";

    // Sanity checks
    if (cfgSleepMin < 10 || cfgSleepMin > 1440) {
        cfgSleepMin = 60;
    }
    if (cfgServer.length() > 200) {
        cfgServer = DEFAULT_SERVER;
    }

    Serial.println("[FS] Config loaded from LittleFS");
}

// ── Save config to LittleFS ──────────────────────────────────

void saveConfig() {
    ensureFS();
    if (!fsReady) return;

    File file = LittleFS.open("/config.json", "w");
    if (!file) {
        Serial.println("[FS] Failed to open config file for writing");
        return;
    }

    StaticJsonDocument<2048> doc;
    doc["cfg_version"]    = CONFIG_VERSION;
    doc["ssid"]           = cfgSSID;
    doc["pass"]           = cfgPass;
    doc["server"]         = cfgServer;
    doc["sleep_min"]      = cfgSleepMin;
    doc["config_json"]    = cfgConfigJson;
    doc["device_token"]   = cfgDeviceToken;
    doc["pair_code"]      = cfgPendingPairCode;

    serializeJson(doc, file);
    file.close();
    Serial.println("[FS] Config saved to LittleFS");
}

// ── Retry counter ───────────────────────────────────────────

int getRetryCount() {
    ensureFS();
    if (!fsReady) return 0;

    File file = LittleFS.open("/retry.txt", "r");
    if (!file) return 0;
    int count = file.parseInt();
    file.close();
    return count;
}

void setRetryCount(int count) {
    ensureFS();
    if (!fsReady) return;

    File file = LittleFS.open("/retry.txt", "w");
    if (!file) return;
    file.print(count);
    file.close();
}

void resetRetryCount() {
    setRetryCount(0);
}

bool isFirstInstallLiveModePending() {
    ensureFS();
    if (!fsReady) return true;

    return !LittleFS.exists("/liveboot_done.txt");
}

void markFirstInstallLiveModeDone() {
    ensureFS();
    if (!fsReady) return;

    File file = LittleFS.open("/liveboot_done.txt", "w");
    if (!file) return;
    file.print("done");
    file.close();
}

// ── Save WiFi credentials ───────────────────────────────────

void saveWiFiConfig(const String &ssid, const String &pass) {
    cfgSSID = ssid;
    cfgPass = pass;
    saveConfig();
}

// ── Save server URL ─────────────────────────────────────────

void saveServerUrl(const String &url) {
    cfgServer = url;
    saveConfig();
}

// ── Save user config JSON ───────────────────────────────────

void saveUserConfig(const String &configJson) {
    cfgConfigJson = configJson;

    // Extract refreshInterval from JSON and persist as sleep_min
    int idx = configJson.indexOf("\"refreshInterval\"");
    if (idx >= 0) {
        int colon = configJson.indexOf(':', idx);
        if (colon >= 0) {
            int val = configJson.substring(colon + 1).toInt();
            if (val < 10)   val = 10;    // minimum 10 minutes
            if (val > 1440) val = 1440;  // maximum 24 hours
            cfgSleepMin = val;
            Serial.printf("[FS] refreshInterval -> sleep_min = %d min\n", val);
        }
    }

    saveConfig();
    Serial.println("[FS] User config saved to LittleFS");
}

void saveSleepMin(int minutes) {
    if (minutes < 10) minutes = 10;
    if (minutes > 1440) minutes = 1440;
    if (cfgSleepMin == minutes) return;
    cfgSleepMin = minutes;
    saveConfig();
}

// ── Device token ────────────────────────────────────────────

void saveDeviceToken(const String &token) {
    cfgDeviceToken = token;
    saveConfig();
}

void clearDeviceToken() {
    cfgDeviceToken = "";
    saveConfig();
}

void savePendingPairCode(const String &code) {
    cfgPendingPairCode = code;
    saveConfig();
}

void clearPendingPairCode() {
    cfgPendingPairCode = "";
    saveConfig();
}