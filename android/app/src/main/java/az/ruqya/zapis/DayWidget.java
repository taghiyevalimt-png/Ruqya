package az.ruqya.zapis;

/** Owner 23.11: «gündəlik» widget — the bookings of one day in time order (‹ › another day). */
public class DayWidget extends AgendaWidget {
    static final String ACTION_PREV = "az.ruqya.zapis.DAY_PREV";
    static final String ACTION_NEXT = "az.ruqya.zapis.DAY_NEXT";

    @Override
    boolean week() {
        return false;
    }

    @Override
    String prevAction() {
        return ACTION_PREV;
    }

    @Override
    String nextAction() {
        return ACTION_NEXT;
    }

    @Override
    Class<?> self() {
        return DayWidget.class;
    }
}
