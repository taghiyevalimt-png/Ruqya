#!/bin/bash
# Run on the build machine with an emulator attached: draws the widget into pictures
# and opens the app from widget taps. Used by .github/workflows/widget-check.yml.
API=$1
P=az.ruqya.zapis
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
sleep 20   # newer emulators keep setting themselves up for a while after "boot completed"
for i in 1 2 3; do
  adb install -r android/app/build/outputs/apk/debug/app-debug.apk
  sleep 5
  adb shell pm path $P | grep -q package: && break
done
adb shell am start -W -n $P/.MainActivity
sleep 8
adb shell pm path $P || echo "PACKAGE MISSING"
J=$(base64 -w0 android/test-widget.json)
shot() { # name width height density data
  adb shell rm -f /data/data/$P/files/widget_test.png 2>/dev/null
  adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_TEST --es b64 '$5' --ei w $2 --ei h $3 --ef density $4"
  sleep 3
  adb exec-out run-as $P cat files/widget_test.png > "$1-$API.png"
}
shot widget 360 380 3.0 "$J"
shot widget-small 250 250 2.0 "$J"
shot widget-big 420 520 2.75 "$J"
shot widget-out 320 340 2.5 "$(printf '{"out":1}' | base64 -w0)"
adb exec-out run-as $P cat files/widget_test.txt > "error-$API.txt" 2>/dev/null || true
# A real widget instance, as a home screen would hold it.
adb shell appwidget grantbind --package $P --user 0 || true
adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_BIND_TEST --es b64 '$J'"
sleep 15
adb exec-out run-as $P cat files/widget_bind.txt > "bind-$API.txt" 2>/dev/null || true
cat "bind-$API.txt"
# An old month the app no longer keeps on the phone.
shot widget-old 360 380 3.0 "$J" 
adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_TEST --es b64 '$J' --ei off -3 --ei w 360 --ei h 380 --ef density 3.0"
sleep 3
adb exec-out run-as $P cat files/widget_test.png > "widget-old-$API.png"
adb shell pm path $P || echo "PACKAGE MISSING"
adb logcat -c
adb shell am start -W -a $P.OPEN -d ruqya://day/2026-11-14 --es what day --es date 2026-11-14 -n $P/.MainActivity
sleep 6
adb shell am start -W -a $P.OPEN -d ruqya://new/ --es what new -n $P/.MainActivity
sleep 4
adb logcat -d | grep -E "FATAL EXCEPTION|E AndroidRuntime" > "crash-$API.txt" || true
ls -la *.png *.txt
