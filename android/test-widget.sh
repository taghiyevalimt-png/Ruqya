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
# owner 23.11: the day and week widgets, sample week of 23–29.11.2026 drawn as if today were 25.11
A=$(base64 -w0 android/test-agenda.json)
shotk() { # name width height density kind off
  adb shell rm -f /data/data/$P/files/widget_test.png 2>/dev/null
  adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_TEST --es b64 '$A' --ei w $2 --ei h $3 --ef density $4 --es kind $5 --ei off $6 --es at 2026-11-25"
  sleep 3
  adb exec-out run-as $P cat files/widget_test.png > "$1-$API.png"
}
shotk widget-day 320 250 2.75 day 0
shotk widget-day-small 250 140 2.0 day -2
shotk widget-week 360 420 2.75 week 0
shotk widget-week-small 250 250 2.0 week 0
A=$(sed 's/"t": *"dark"/"t":"light"/' android/test-agenda.json | base64 -w0); shotk widget-week-light 360 420 2.75 week 0
shotk widget-day-tomorrow 320 250 2.75 day 1
A=$(printf '{"out":1}' | base64 -w0); shotk widget-week-out 360 420 2.75 week 0
adb shell appwidget grantbind --package $P --user 0 || true
for k in day week; do
  adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_BIND_TEST --es kind $k"
  sleep 12
  adb exec-out run-as $P cat files/widget_bind_$k.txt > "bind-$k-$API.txt" 2>/dev/null || true
done
{ echo "day / week widgets (API $API)"
  ok=1
  for f in widget-day widget-day-small widget-week widget-week-small widget-week-light widget-week-out; do
    s=$(stat -c%s "$f-$API.png" 2>/dev/null || echo 0); echo "$f $s bytes"
    head -c 4 "$f-$API.png" 2>/dev/null | od -An -tx1 | grep -q "89 50 4e 47" || ok=0
    [ "$s" -gt 3000 ] || ok=0
  done
  cmp -s widget-week-$API.png widget-week-light-$API.png && { echo "light = dark"; ok=0; }
  for k in day week; do cat "bind-$k-$API.txt"; grep -q "^bound=true" "bind-$k-$API.txt" || ok=0; grep -q "FAIL" "bind-$k-$API.txt" && ok=0; [ "$(grep -c ': ok' "bind-$k-$API.txt")" = "9" ] || ok=0; done
  # the drawing error file, if any (a missing file must not count: «cat: No such file» comes on the same output)
  DE=$(adb shell "run-as $P sh -c 'cat files/widget_test.txt 2>/dev/null'" | tr -d '\r')
  if [ -n "$DE" ]; then echo "drawing error:"; echo "$DE"; ok=0; fi
  [ $ok = 1 ] && echo "PASS: day and week widgets drawn (6 pictures), placed on a real home-screen slot at 6 sizes, ‹ › 300 times, signed out / broken / no data" || echo "FAIL"
} > "agenda-$API.txt"
cat "agenda-$API.txt"
# B-06: the widget applies the app's 7-day sign-out itself. Same data, drawn 1 hour and 8 days after the
# app handed it over: the first shows the month, the second must be the signed-out picture.
U=$(grep -o '"u":[0-9]*' android/test-widget.json | cut -d: -f2)
shotat() { # name now [b64 data]
  adb shell rm -f /data/data/$P/files/widget_test.png 2>/dev/null
  adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.WIDGET_TEST --es b64 '${3:-$J}' --ei w 320 --ei h 340 --ef density 2.5 --el now $2"
  sleep 3
  adb exec-out run-as $P cat files/widget_test.png > "$1-$API.png"
}
shotat widget-1h $((U + 3600000))
shotat widget-13h $((U + 691200000))   # 8 days (file name kept)
# R2-7: data handed over just now, but the app was last used 8 days ago ("s") — must be the signed-out picture
JS=$(sed "s/\"u\":$U/\"u\":$U,\"s\":$((U - 691200000))/" android/test-widget.json | base64 -w0)
shotat widget-seen13h $((U + 3600000)) "$JS"
{ echo "B-06 widget sign-out rule, 7 days (API $API)"
  echo "out      $(md5sum < widget-out-$API.png | cut -c1-32)"
  echo "after1h  $(md5sum < widget-1h-$API.png | cut -c1-32)"
  echo "after13h $(md5sum < widget-13h-$API.png | cut -c1-32)"
  echo "seen13h  $(md5sum < widget-seen13h-$API.png | cut -c1-32)"
  if cmp -s widget-13h-$API.png widget-out-$API.png && cmp -s widget-seen13h-$API.png widget-out-$API.png && ! cmp -s widget-1h-$API.png widget-out-$API.png; then echo "PASS: 8 days after the hand-over or after the last use the signed-out picture, 1 h old data the month"; else echo "FAIL"; fi
} > "idle-$API.txt"
cat "idle-$API.txt"
adb exec-out run-as $P cat files/widget_test.txt > "error-$API.txt" 2>/dev/null || true
# Owner 18.11: patients into the phone's contacts. The app's own import (permissions granted like a «Allow» tap),
# twice: the first adds 2 (one without a number, one number already given), the second adds nothing.
adb shell pm grant $P android.permission.READ_CONTACTS || true
adb shell pm grant $P android.permission.WRITE_CONTACTS || true
CJ=$(printf '%s' '[["Test Pasiyent Bir","+994 55 111 22 33"],["Test Iki","0501112244"],["Nomresiz",""],["Bir tekrar","0551112233"]]' | base64 -w0)
cimport() {
  adb shell rm -f /data/data/$P/files/contacts_test.txt 2>/dev/null
  adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.CONTACTS_TEST --es b64 '$CJ'" > /dev/null
  sleep 4
  adb exec-out run-as $P cat files/contacts_test.txt 2>/dev/null | tr -d '\r'
}
C1=$(cimport); C2=$(cimport)
CQ=$(adb shell content query --uri content://com.android.contacts/data/phones --projection display_name:data1 2>/dev/null | tr -d '\r')
{ echo "contacts import (API $API)"
  echo "first:  $C1"
  echo "second: $C2"
  echo "$CQ" | grep -E "Test Pasiyent Bir|Test Iki|Bir tekrar|Nomresiz" || true
  if [ "$C1" = "added=2 skipped=2" ] && [ "$C2" = "added=0 skipped=4" ] && echo "$CQ" | grep -q "display_name=Test Pasiyent Bir, data1=+994 55 111 22 33" && echo "$CQ" | grep -q "display_name=Test Iki, data1=0501112244" && ! echo "$CQ" | grep -q "Bir tekrar"; then echo "PASS: names and numbers in the phone's contacts, a number already there is not added twice"; else echo "FAIL"; fi
} > "contacts-$API.txt"
cat "contacts-$API.txt"
# F-02 (owner 17.11): the widget in white or black, as chosen in the app ("t"); without "t" it follows the phone
# (the emulator runs in light mode, so it must be the white picture). Signed out keeps the colour too.
JL=$(sed 's/"u":/"t":"light","u":/' android/test-widget.json | base64 -w0)
JD=$(sed 's/"u":/"t":"dark","u":/' android/test-widget.json | base64 -w0)
shot widget-light 360 380 3.0 "$JL"
shot widget-dark 360 380 3.0 "$JD"
shot widget-auto 360 380 3.0 "$J"
shot widget-out-light 320 340 2.5 "$(printf '{"out":1,"t":"light"}' | base64 -w0)"
shot widget-out-dark 320 340 2.5 "$(printf '{"out":1,"t":"dark"}' | base64 -w0)"
{ echo "F-02 widget colour (API $API)"
  for f in light dark auto out-light out-dark; do echo "$f $(md5sum < widget-$f-$API.png | cut -c1-32) $(stat -c%s widget-$f-$API.png) bytes"; done
  if [ -s widget-light-$API.png ] && [ -s widget-dark-$API.png ] && ! cmp -s widget-light-$API.png widget-dark-$API.png && cmp -s widget-auto-$API.png widget-light-$API.png && ! cmp -s widget-out-light-$API.png widget-out-dark-$API.png; then echo "PASS: white and black pictures differ; without a choice the light phone gets the white one; signed-out keeps the colour"; else echo "FAIL"; fi
} > "theme-$API.txt"
cat "theme-$API.txt"
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
