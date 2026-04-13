#ifndef Fries_PORTAL_H
#define Fries_PORTAL_H

#include <Arduino.h>

// Portal state
extern bool portalActive;
extern bool wifiConnected;

// Start the captive portal (AP mode + web server)
void startCaptivePortal();

// Process pending portal HTTP/DNS requests (call in loop)
void handlePortalClients();

#endif // Fries_PORTAL_H
