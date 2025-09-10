import machine
import os
import utime
from network import WLAN
import pycom
import ubinascii

# Suppress verbose output during boot
pycom.heartbeat(False)

def connect_wifi():
    """Connect to WiFi using credentials from keys.py."""
    wlan = WLAN(mode=WLAN.STA)
    nets = wlan.scan()

    try:
        from keys import wifi_ssid, wifi_ssid_2, wifi_ssid_3, wifi_ssid_4, wifi_password
        ssids = [wifi_ssid, wifi_ssid_2, wifi_ssid_3, wifi_ssid_4]
    except ImportError:
        print("Error: keys.py not found or missing WiFi credentials.")
        return False

    for net in nets:
        if net.ssid in ssids:
            print(f"Connecting to {net.ssid}...")
            wlan.connect(net.ssid, auth=(net.sec, wifi_password), timeout=50000)
            while not wlan.isconnected():
                utime.sleep(1)
            print(f"Connected to {net.ssid} with IP {wlan.ifconfig()[0]}")
            return True

    print("Error: No known WiFi network found.")
    return False

def mount_sd_card():
    """Mount the SD card if available."""
    try:
        sd = machine.SDCard(slot=2, sck=machine.Pin(18), cs=machine.Pin(5), miso=machine.Pin(19), mosi=machine.Pin(23))
        os.mount(sd, "/sd")
        print("SD card mounted at /sd")
        print("Files on SD:", os.listdir("/sd"))
    except Exception as e:
        print("Error mounting SD card:", e)

def main():
    """Main boot sequence."""
    # Mount SD card
    mount_sd_card()

    # Connect to WiFi
    if not connect_wifi():
        print("Failed to connect to WiFi. Continuing without network.")

    # Initialize UART
    uart = machine.UART(1, baudrate=115200)
    print("UART1 initialized at 115200 baud")

    # Start main application
    try:
        machine.main('main.py')
    except Exception as e:
        print("Error in main.py:", e)

if __name__ == "__main__":
    main()
