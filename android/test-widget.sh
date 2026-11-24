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
A=$(sed 's/"t": *"dark"/"t":"sand"/' android/test-agenda.json | base64 -w0); shotk widget-week-sand 360 420 2.75 week 0
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
  for f in widget-day widget-day-small widget-week widget-week-small widget-week-sand widget-week-out; do
    s=$(stat -c%s "$f-$API.png" 2>/dev/null || echo 0); echo "$f $s bytes"
    head -c 4 "$f-$API.png" 2>/dev/null | od -An -tx1 | grep -q "89 50 4e 47" || ok=0
    [ "$s" -gt 3000 ] || ok=0
  done
  # 24.11 (evening): two looks — night (default) and sand draw different pictures
  cmp -s widget-week-$API.png widget-week-sand-$API.png && { echo "sand == night (must differ)"; ok=0; }
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
# 24.11 (owner): notifications. The server's answer applied on the phone (no network): a notice for a new booking at once;
# a reminder by an exact alarm 1 minute before a session 75 s away (= in 15 s); the 15-minute check is kept while
# something is on; {"gone":true} (a token the server no longer knows) stops the check and the alarms.
adb shell pm grant $P android.permission.POST_NOTIFICATIONS 2>/dev/null || true
NJ=$(printf '%s' '{"remind_min":1,"on_new":true,"news":[{"id":"n-1","text":"Sizə seans yazıldı: 25 noyabr, 14:00 — TEST YENI"}],"upcoming":[{"id":"u-1","in_s":75,"text":"1 dəqiqə sonra seans: 14:00 — TEST XATIRLAT"},{"id":"u-2","in_s":-30,"text":"OLD — must not show"}]}' | base64 -w0)
adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.NOTIFY_TEST --es b64 '$NJ'" > /dev/null
sleep 4
N1=$(adb shell dumpsys notification --noredact 2>/dev/null | tr -d '\r' | grep -E "TEST YENI|TEST XATIRLAT|must not show" | sort -u)
A1=$(adb shell dumpsys alarm 2>/dev/null | tr -d '\r' | grep -c "$P" || true)
J1=$(adb shell dumpsys jobscheduler 2>/dev/null | tr -d '\r' | grep -c "JOB #.*$P/.NotifyJob" || true)
sleep 22
N2=$(adb shell dumpsys notification --noredact 2>/dev/null | tr -d '\r' | grep -E "TEST YENI|TEST XATIRLAT|must not show" | sort -u)
adb shell "am broadcast -f 32 -n $P/.WidgetTest -a $P.NOTIFY_TEST --es b64 '$(printf '{"gone":true}' | base64 -w0)'" > /dev/null
sleep 3
J2=$(adb shell dumpsys jobscheduler 2>/dev/null | tr -d '\r' | grep -c "JOB #.*$P/.NotifyJob" || true)
NE=$(adb exec-out run-as $P cat files/notify_test.txt 2>/dev/null | tr -d '\r')
{ echo "notifications (API $API)"
  echo "after 4 s:  $(echo "$N1" | grep -c 'TEST YENI') new, $(echo "$N1" | grep -c 'TEST XATIRLAT') reminder; alarms of the app: $A1; check scheduled: $J1"
  echo "after 26 s: $(echo "$N2" | grep -c 'TEST YENI') new, $(echo "$N2" | grep -c 'TEST XATIRLAT') reminder, $(echo "$N2" | grep -c 'must not show') old"
  echo "after gone: check scheduled: $J2 $NE"
  if echo "$N1" | grep -q "TEST YENI" && ! echo "$N1" | grep -q "TEST XATIRLAT" && echo "$N2" | grep -q "TEST XATIRLAT" && ! echo "$N2" | grep -q "must not show" \
     && [ "$J1" -ge 1 ] && [ "$J2" = "0" ] && [ -z "$NE" ]; then echo "PASS: a new booking at once, the reminder on time by its alarm, nothing for a past session; gone stops the check"; else echo "FAIL"; fi
} > "notify-$API.txt"
cat "notify-$API.txt"
# 24.11 (owner, evening): two looks — night (#303147, default) and sand (#CEBBA0), chosen in the app (Ayarlar →
# Görünüş → Vidcetin rəngi) and sent as "t". "sand" draws sand; "night", an old "dark", or nothing draws night.
JL=$(sed 's/"u":/"t":"sand","u":/' android/test-widget.json | base64 -w0)
JD=$(sed 's/"u":/"t":"night","u":/' android/test-widget.json | base64 -w0)
JO=$(sed 's/"u":/"t":"dark","u":/' android/test-widget.json | base64 -w0)
shot widget-sand 360 380 3.0 "$JL"
shot widget-night 360 380 3.0 "$JD"
shot widget-olddark 360 380 3.0 "$JO"
shot widget-auto 360 380 3.0 "$J"
shot widget-out-sand 320 340 2.5 "$(printf '{"out":1,"t":"sand"}' | base64 -w0)"
shot widget-out-night 320 340 2.5 "$(printf '{"out":1,"t":"night"}' | base64 -w0)"
{ echo "F-02 widget colour (API $API)"
  for f in sand night olddark auto out-sand out-night; do echo "$f $(md5sum < widget-$f-$API.png | cut -c1-32) $(stat -c%s widget-$f-$API.png) bytes"; done
  if [ -s widget-sand-$API.png ] && [ -s widget-night-$API.png ] && ! cmp -s widget-sand-$API.png widget-night-$API.png && cmp -s widget-auto-$API.png widget-night-$API.png && cmp -s widget-olddark-$API.png widget-night-$API.png && ! cmp -s widget-out-sand-$API.png widget-out-night-$API.png; then echo "PASS: two looks — sand and night differ; no choice or an old one is night"; else echo "FAIL"; fi
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
