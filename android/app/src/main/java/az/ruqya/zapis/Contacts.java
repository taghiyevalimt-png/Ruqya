package az.ruqya.zapis;

import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.provider.ContactsContract;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.HashSet;

/**
 * Owner 18.11: the patients' names and phone numbers go straight into the phone's contacts (no file to open).
 * Only name and number; a number the phone already has in its contacts is skipped, so a second import adds nothing.
 * Needs READ_CONTACTS and WRITE_CONTACTS (asked by MainActivity before calling).
 */
final class Contacts {
    private Contacts() { }

    /** Digits of a number, the last 9 (Azerbaijani numbers with or without +994 / 0 compare equal). */
    static String core(String phone) {
        String d = phone == null ? "" : phone.replaceAll("\\D", "");
        return d.length() > 9 ? d.substring(d.length() - 9) : d;
    }

    /** Numbers already in the phone's contacts. */
    static HashSet<String> existing(ContentResolver cr) {
        HashSet<String> have = new HashSet<>();
        Cursor c = null;
        try {
            c = cr.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER}, null, null, null);
            while (c != null && c.moveToNext()) {
                String k = core(c.getString(0));
                if (k.length() >= 5) have.add(k);
            }
        } finally {
            if (c != null) c.close();
        }
        return have;
    }

    /**
     * [[name, phone], …] → {added, skipped}. Written in batches of 100 contacts; a contact without a number or a
     * name is skipped.
     */
    static int[] importAll(Context ctx, JSONArray list) throws Exception {
        ContentResolver cr = ctx.getContentResolver();
        HashSet<String> have = existing(cr);
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        int added = 0, skipped = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONArray it = list.optJSONArray(i);
            String name = it == null ? "" : it.optString(0, "").trim();
            String phone = it == null ? "" : it.optString(1, "").trim();
            String k = core(phone);
            if (name.isEmpty() || k.length() < 5 || have.contains(k)) {
                skipped++;
                continue;
            }
            have.add(k);
            int back = ops.size();
            ops.add(ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                    .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null).build());
            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, back)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name).build());
            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, back)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                    .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE).build());
            added++;
            if (ops.size() >= 300) {
                cr.applyBatch(ContactsContract.AUTHORITY, ops);
                ops.clear();
            }
        }
        if (!ops.isEmpty()) cr.applyBatch(ContactsContract.AUTHORITY, ops);
        return new int[]{added, skipped};
    }
}
